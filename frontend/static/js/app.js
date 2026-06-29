const API = "";

// ── 共用 fetch ────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── 狀態顏色對照 ─────────────────────────────────────────
const STATUS_BADGE = {
  "製作中":  "bg-warning text-dark",
  "待出貨":  "bg-info text-dark",
  "已完成":  "bg-success",
  "取消":    "bg-secondary",
};
const PROD_BADGE = {
  "未開始":  "bg-secondary",
  "製作中":  "bg-warning text-dark",
  "待檢驗":  "bg-info text-dark",
  "完成":    "bg-success",
};
const URGENCY_BADGE = {
  urgent: "badge-urgent",
  soon:   "badge-soon",
  ok:     "badge-ok",
  done:   "badge-done",
};
const DOT_CLASS = {
  "未開始": "dot-pending",
  "製作中": "dot-wip",
  "待檢驗": "dot-check",
  "完成":   "dot-done",
};

// ── 總覽 ─────────────────────────────────────────────────
async function loadDashboard() {
  const orders = await api("GET", "/api/orders");
  const active = orders.filter(o => o.status !== "已完成");
  const done   = orders.filter(o => o.status === "已完成");
  const wip    = active.filter(o => o.status === "製作中");
  const urgent = active.filter(o => o.days_left <= 7);

  document.getElementById("kpi-total").textContent = orders.length;
  document.getElementById("kpi-urgent").textContent = urgent.length;
  document.getElementById("kpi-wip").textContent = wip.length;
  document.getElementById("kpi-done").textContent = done.length;

  const tbody = document.getElementById("dashboard-tbody");
  tbody.innerHTML = "";
  urgent.slice(0, 10).forEach(o => {
    const pct = Math.round(
      (o.production.filter(p => p.status === "完成").length / (o.production.length || 1)) * 100
    );
    tbody.innerHTML += `
      <tr>
        <td><a href="javascript:void(0)" onclick="openOrder(${o.id})" class="text-decoration-none fw-semibold">${o.order_number}</a></td>
        <td>${o.customer_name} ${o.branch_name ? `<span class="branch-tag">${o.branch_name}</span>` : ""}</td>
        <td>${o.delivery_date}</td>
        <td><span class="badge ${URGENCY_BADGE[o.urgency]} rounded-pill">${o.days_left} 天</span></td>
        <td><div class="progress" style="height:8px;width:120px"><div class="progress-bar" style="width:${pct}%"></div></div></td>
      </tr>`;
  });
}

// ── 訂單列表 ─────────────────────────────────────────────
let allOrders = [];
async function loadOrders() {
  allOrders = await api("GET", "/api/orders");
  filterOrders();
}

function renderOrders(list) {
  const tbody = document.getElementById("orders-tbody");
  tbody.innerHTML = "";
  list.forEach(o => {
    const itemSummary = o.items.map(i => {
      const qty = i.sizes.reduce((s, x) => s + x.quantity, 0);
      return `${i.product_name}×${qty}`;
    }).join("、");
    tbody.innerHTML += `
      <tr>
        <td><span class="fw-semibold">${o.order_number}</span></td>
        <td>${o.customer_name} ${o.branch_name ? `<span class="branch-tag">${o.branch_name}</span>` : ""}</td>
        <td>${itemSummary}</td>
        <td>${o.delivery_date}</td>
        <td><span class="badge ${URGENCY_BADGE[o.urgency] || "badge-ok"} rounded-pill">${o.urgency === "done" ? "–" : (o.days_left >= 0 ? o.days_left + " 天" : "已逾期")}</span></td>
        <td><span class="badge ${STATUS_BADGE[o.status] || "bg-secondary"}">${o.status}</span></td>
        <td><div class="d-flex gap-1"><a href="javascript:void(0)" onclick="openOrder(${o.id})" class="btn btn-sm btn-outline-secondary">查看</a>${o.status !== "已完成" ? `<a href="javascript:void(0)" onclick="setOrderStatus(${o.id}, '已完成')" class="btn btn-sm btn-outline-success">完成</a>` : `<a href="javascript:void(0)" onclick="setOrderStatus(${o.id}, '製作中')" class="btn btn-sm btn-outline-secondary">重啟</a>`}<a href="javascript:void(0)" onclick="deleteOrder(${o.id})" class="btn btn-sm btn-outline-danger">刪除</a></div></td>
      </tr>`;
  });
}

let customerOrderFilter = null; // { id, name }

function filterOrders() {
  const kw = document.getElementById("order-search").value.toLowerCase();
  const st = document.getElementById("order-status-filter").value;
  renderOrders(allOrders.filter(o => {
    const matchKw  = !kw || o.order_number.toLowerCase().includes(kw) || o.customer_name.toLowerCase().includes(kw);
    const matchSt  = !st || o.status === st;
    const matchCust = !customerOrderFilter ||
      (o.customer_id === customerOrderFilter.id && o.status !== "已完成");
    return matchKw && matchSt && matchCust;
  }));
}

function viewCustomerOrders(cid, name) {
  customerOrderFilter = { id: cid, name };
  document.getElementById("order-search").value = "";
  document.getElementById("order-status-filter").value = "";
  const bar = document.getElementById("order-filter-bar");
  bar.classList.remove("d-none");
  document.getElementById("order-filter-label").textContent = `${name} 的未完成訂單`;
  showPage("orders");
  filterOrders();
}

function clearCustomerFilter() {
  customerOrderFilter = null;
  document.getElementById("order-filter-bar").classList.add("d-none");
  filterOrders();
}

// ── 訂單詳情 ─────────────────────────────────────────────
let currentOrder = null;
async function openOrder(id) {
  try {
    currentOrder = await api("GET", `/api/orders/${id}`);
    renderDetail(currentOrder);
    showPage("detail");
  } catch(e) {
    alert("載入訂單失敗：" + e.message);
  }
}

function renderDetail(o) {
  document.getElementById("detail-number").textContent = o.order_number;
  document.getElementById("detail-status-badge").className = `badge ${STATUS_BADGE[o.status] || "bg-secondary"} ms-1`;
  document.getElementById("detail-status-badge").textContent = o.status;
  document.getElementById("detail-days").textContent = `交貨剩 ${o.days_left} 天`;
  document.getElementById("detail-days").className = `badge ${URGENCY_BADGE[o.urgency]} rounded-pill fs-6`;
  document.getElementById("detail-customer").textContent =
    o.customer_name + (o.branch_name ? ` ／ 院區：${o.branch_name}` : "");
  document.getElementById("detail-delivery").textContent = o.delivery_date;
  document.getElementById("detail-reminder").textContent = `${o.reminder_days} 天前`;
  document.getElementById("detail-notes").textContent = o.notes || "–";
  document.getElementById("detail-actions").innerHTML = `
    ${o.status !== "已完成"
      ? `<button class="btn btn-sm btn-success" onclick="setOrderStatus(${o.id}, '已完成')"><i class="bi bi-check-circle"></i> 標記完成</button>`
      : `<button class="btn btn-sm btn-outline-secondary" onclick="setOrderStatus(${o.id}, '製作中')"><i class="bi bi-arrow-counterclockwise"></i> 重啟訂單</button>`
    }
    <button class="btn btn-sm btn-outline-primary" onclick="editCurrentOrder()"><i class="bi bi-pencil"></i> 編輯</button>
    <button class="btn btn-sm btn-outline-danger" onclick="deleteCurrentOrder()"><i class="bi bi-trash"></i> 刪除</button>
  `;

  const itemsHtml = o.items.map(i => {
    const sizes = i.sizes.map(s => `<span class="badge bg-light text-dark border me-1">${s.size || "–"} × ${s.quantity}</span>`).join("");
    return `<div class="mb-1"><span class="fw-semibold">${i.product_name}</span> ${sizes}</div>`;
  }).join("");
  document.getElementById("detail-items").innerHTML = itemsHtml || "–";

  renderProduction(o.production);
}

function renderProduction(items) {
  const container = document.getElementById("production-container");
  container.innerHTML = "";
  items.forEach(p => {
    const notesHtml = p.notes.map(n =>
      `<div class="timeline-note d-flex justify-content-between align-items-start">
        <div>
          <div class="text-muted" style="font-size:.8rem">${n.created_at}</div>
          <div>${n.content}</div>
        </div>
        <button class="btn btn-sm btn-link text-danger p-0 ms-2" onclick="deleteProductionNote(${n.id})" title="刪除備註"><i class="bi bi-x-circle" style="font-size:.85rem"></i></button>
      </div>`
    ).join("");
    const isActive = p.status !== "完成";
    const border = p.status === "製作中" ? " border border-warning" : "";
    container.innerHTML += `
      <div class="card mb-3${border}">
        <div class="card-body">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <div><span class="status-dot ${DOT_CLASS[p.status] || "dot-pending"}"></span><span class="fw-semibold">${p.name}</span></div>
            <div class="d-flex gap-2 align-items-center">
              <select class="form-select form-select-sm" style="width:auto" onchange="updateProdStatus(${p.id}, this.value)">
                ${["未開始","製作中","待檢驗","完成"].map(s =>
                  `<option${s === p.status ? " selected" : ""}>${s}</option>`).join("")}
              </select>
              <span class="badge ${PROD_BADGE[p.status] || "bg-secondary"}">${p.status}</span>
              <button class="btn btn-sm btn-outline-danger py-0 px-1" onclick="deleteProductionItem(${p.id})" title="刪除此品項"><i class="bi bi-trash"></i></button>
            </div>
          </div>
          ${p.staff_name ? `<div class="d-flex align-items-center gap-2 mb-2"><div class="text-muted small">負責：</div><div class="avatar avatar-sm">${p.staff_name[0]}</div><div class="small">${p.staff_name}</div></div>` : ""}
          <div class="text-muted small mb-2">預計完成：${p.expected_date || "–"}${p.actual_date ? " ／ 實際：" + p.actual_date : ""}</div>
          ${notesHtml}
          ${isActive ? `
          <div class="mt-3">
            <div class="input-group input-group-sm">
              <input type="text" class="form-control" placeholder="新增備註..." id="note-input-${p.id}">
              <button class="btn btn-outline-secondary" onclick="addNote(${p.id})">新增</button>
            </div>
          </div>` : ""}
        </div>
      </div>`;
  });
}

async function deleteProductionItem(pid) {
  if (!confirm("確定刪除此半成品品項？備註也會一併刪除，此操作無法復原。")) return;
  try {
    await api("DELETE", `/api/orders/production/${pid}`);
    await openOrder(currentOrder.id);
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

async function deleteProductionNote(nid) {
  if (!confirm("確定刪除此備註？")) return;
  try {
    await api("DELETE", `/api/orders/production/notes/${nid}`);
    await openOrder(currentOrder.id);
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

async function updateProdStatus(pid, status) {
  await api("PUT", `/api/orders/production/${pid}/status`, { status });
  await openOrder(currentOrder.id);
}

async function addNote(pid) {
  const input = document.getElementById(`note-input-${pid}`);
  const content = input.value.trim();
  if (!content) return;
  await api("POST", `/api/orders/production/${pid}/notes`, { content });
  await openOrder(currentOrder.id);
}

// ── 訂單編輯 / 刪除 ──────────────────────────────────────
let editOrderId = null;

function editCurrentOrder() {
  if (!currentOrder) return;
  editOrderId = currentOrder.id;
  document.querySelector("#newOrderModal .modal-title").textContent = "編輯訂單";
  document.querySelector("#newOrderModal .modal-footer .btn-primary").textContent = "儲存變更";
  document.getElementById("order-number").value   = currentOrder.order_number;
  document.getElementById("order-delivery").value = currentOrder.delivery_date;
  document.getElementById("order-reminder").value = currentOrder.reminder_days;
  document.getElementById("order-notes").value    = currentOrder.notes || "";
  document.getElementById("customerSelect").value = currentOrder.customer_id;
  updateBranches();
  document.getElementById("branchSelect").value   = currentOrder.branch_id || "";
  populateOrderItems(currentOrder.items);
  new bootstrap.Modal(document.getElementById("newOrderModal")).show();
}

async function deleteCurrentOrder() {
  if (!currentOrder) return;
  if (!confirm(`確定刪除訂單 ${currentOrder.order_number}？此操作無法復原。`)) return;
  try {
    await api("DELETE", `/api/orders/${currentOrder.id}`);
    currentOrder = null;
    showPage("orders");
    loadOrders();
    loadDashboard();
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

async function setOrderStatus(id, status) {
  try {
    await api("PUT", `/api/orders/${id}/status`, { status });
    loadOrders();
    loadDashboard();
    if (currentOrder?.id === id) await openOrder(id);
  } catch(e) {
    alert("更新失敗：" + e.message);
  }
}

async function deleteOrder(id) {
  const order = allOrders.find(o => o.id === id);
  if (!confirm(`確定刪除訂單 ${order?.order_number || id}？此操作無法復原。`)) return;
  try {
    await api("DELETE", `/api/orders/${id}`);
    loadOrders();
    loadDashboard();
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

function populateOrderItems(items) {
  const container = document.getElementById('orderItems');
  container.innerHTML = '';
  itemCount = 0;
  const list = items && items.length ? items : [{ product_name: '', sizes: [] }];
  list.forEach(item => {
    itemCount++;
    const div = document.createElement('div');
    div.className = 'order-item border rounded p-3 mb-3 bg-light';
    div.innerHTML = `
      <div class="d-flex justify-content-between align-items-center mb-2">
        <div class="fw-semibold text-primary small">品項 ${itemCount}</div>
        <button type="button" class="btn btn-sm btn-outline-danger py-0" onclick="removeItem(this)">移除品項</button>
      </div>
      <div class="row g-2 mb-2">
        <div class="col-md-6"><label class="form-label small">品名</label><input type="text" class="form-control form-control-sm" placeholder="e.g. 手術衣"></div>
      </div>
      <div class="size-list"></div>
      <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addSize(this)"><i class="bi bi-plus"></i> 新增尺寸</button>
    `;
    div.querySelector('input[type=text]').value = item.product_name || '';
    const sizeList = div.querySelector('.size-list');
    const sizes = item.sizes && item.sizes.length ? item.sizes : [{ size: '', quantity: 0 }];
    sizes.forEach(s => {
      const row = document.createElement('div');
      row.className = 'row g-2 align-items-center mb-1 size-row';
      row.innerHTML = `
        <div class="col-md-4"><label class="form-label small">尺寸</label><input type="text" class="form-control form-control-sm" placeholder="e.g. M"></div>
        <div class="col-md-3"><label class="form-label small">數量</label><input type="number" class="form-control form-control-sm" placeholder="e.g. 100"></div>
        <div class="col-md-2 pt-4"><button type="button" class="btn btn-sm btn-outline-danger py-0" onclick="removeSize(this)"><i class="bi bi-x"></i></button></div>
      `;
      row.querySelector('input[type=text]').value = s.size || '';
      row.querySelector('input[type=number]').value = s.quantity || 0;
      sizeList.appendChild(row);
    });
    container.appendChild(div);
    refreshSizeRemoveButtons(sizeList);
  });
  refreshRemoveButtons();
}

// ── 新增訂單 ─────────────────────────────────────────────
async function submitOrder() {
  const orderNumber    = document.getElementById("order-number").value.trim();
  const customerSelect = document.getElementById("customerSelect");
  const branchSelect   = document.getElementById("branchSelect");
  const deliveryDate   = document.getElementById("order-delivery").value;
  const reminderDays   = parseInt(document.getElementById("order-reminder").value) || 7;
  const notes          = document.getElementById("order-notes").value;

  if (!orderNumber) return alert("請填寫採購單號");
  if (!customerSelect.value) return alert("請選擇客戶");
  if (!deliveryDate) return alert("請填寫交貨日期");

  const items = [];
  document.querySelectorAll(".order-item").forEach(el => {
    const name = el.querySelector("input[type=text]").value.trim();
    if (!name) return;
    const sizes = [];
    el.querySelectorAll(".size-row").forEach(row => {
      const inputs = row.querySelectorAll("input");
      sizes.push({ size: inputs[0].value, quantity: parseInt(inputs[1].value) || 0 });
    });
    items.push({ product_name: name, sizes });
  });

  const payload = {
    order_number: orderNumber,
    customer_id: parseInt(customerSelect.value),
    branch_id: branchSelect.value ? parseInt(branchSelect.value) : null,
    delivery_date: deliveryDate,
    reminder_days: reminderDays,
    notes, items,
  };
  try {
    if (editOrderId) {
      await api("PUT", `/api/orders/${editOrderId}`, payload);
    } else {
      await api("POST", "/api/orders", payload);
    }
    bootstrap.Modal.getInstance(document.getElementById("newOrderModal")).hide();
    if (editOrderId && currentOrder?.id === editOrderId) {
      await openOrder(editOrderId);
    }
    loadOrders();
    loadDashboard();
  } catch(e) {
    alert("儲存失敗：" + e.message);
  }
}

// ── 客戶管理 ─────────────────────────────────────────────
let allCustomers = [];
async function loadCustomers() {
  allCustomers = await api("GET", "/api/customers");
  renderCustomers();
  populateCustomerSelects();
}

function renderCustomers() {
  const container = document.getElementById("customers-container");
  container.innerHTML = "";
  allCustomers.forEach(c => {
    const branchTags = c.branches.map(b =>
      `<span class="branch-tag d-inline-flex align-items-center gap-1">
        <span style="cursor:pointer" onclick="editBranch(${b.id})">${b.name} <i class="bi bi-pencil" style="font-size:.65rem"></i></span>
        <button class="btn btn-link p-0 text-danger" onclick="deleteBranch(${b.id})" title="刪除院區" style="font-size:.7rem;line-height:1"><i class="bi bi-x-circle-fill"></i></button>
      </span>`).join("");
    container.innerHTML += `
      <div class="col-12">
        <div class="card p-4">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div><div class="fw-bold fs-6 mb-1">${c.name}</div><span class="badge bg-light text-dark border" style="cursor:pointer" onclick="viewCustomerOrders(${c.id}, '${c.name.replace(/'/g, "\\'")}')" title="查看未完成訂單">${c.order_count} 筆訂單 <i class="bi bi-box-arrow-up-right" style="font-size:.7rem"></i></span></div>
            <button class="btn btn-sm btn-outline-secondary" onclick="editCustomer(${c.id})">編輯</button>
          </div>
          <div class="row g-2 mb-3">
            <div class="col-md-3"><div class="text-muted small">聯絡人</div><div class="small">${c.contact_name || "–"}</div></div>
            <div class="col-md-3"><div class="text-muted small">電話</div><div class="small">${c.phone || "–"}</div></div>
            <div class="col-md-3"><div class="text-muted small">Email</div><div class="small">${c.email || "–"}</div></div>
            <div class="col-md-3"><div class="text-muted small">LINE</div><div class="small">${c.line_id || "–"}</div></div>
            <div class="col-12"><div class="text-muted small">地址</div><div class="small">${c.address || "–"}</div></div>
          </div>
          <div class="d-flex align-items-center flex-wrap gap-2">
            <div class="text-muted small me-1">院區：</div>
            ${branchTags || '<span class="text-muted small">（無）</span>'}
            <button class="btn btn-sm btn-outline-secondary py-0 px-2" style="font-size:.75rem"
              onclick="openAddBranch(${c.id})">+ 新增院區</button>
          </div>
        </div>
      </div>`;
  });
}

function populateCustomerSelects() {
  ["customerSelect"].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = '<option value="">— 選擇客戶 —</option>';
    allCustomers.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
    sel.value = cur;
  });
  const pbSel = document.querySelector("#ctFields-院區 select");
  if (pbSel) {
    pbSel.innerHTML = '<option value="">— 選擇客戶 —</option>';
    allCustomers.forEach(c => {
      pbSel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
    });
  }
}

function updateBranches() {
  const cid = parseInt(document.getElementById("customerSelect").value);
  const sel = document.getElementById("branchSelect");
  sel.innerHTML = '<option value="">（無院區）</option>';
  const c = allCustomers.find(x => x.id === cid);
  if (c) c.branches.forEach(b => {
    sel.innerHTML += `<option value="${b.id}">${b.name}</option>`;
  });
}

let editCustomerId = null;

function editCustomer(id) {
  try {
    const c = allCustomers.find(x => x.id === id);
    if (!c) { alert("找不到客戶 id=" + id); return; }
    editCustomerId = id;
    document.getElementById("cust-name").value    = c.name || "";
    document.getElementById("cust-contact").value = c.contact_name || "";
    document.getElementById("cust-phone").value   = c.phone || "";
    document.getElementById("cust-email").value   = c.email || "";
    document.getElementById("cust-line").value    = c.line_id || "";
    document.getElementById("cust-address").value = c.address || "";
    document.getElementById("cust-notes").value   = c.notes || "";
    document.querySelector("#newCustomerModal .modal-title").textContent = "編輯客戶";
    new bootstrap.Modal(document.getElementById("newCustomerModal")).show();
  } catch(e) { alert("editCustomer 錯誤：" + e.message); }
}

async function submitCustomer() {
  const fields = ["cust-name","cust-contact","cust-phone","cust-email","cust-line","cust-address","cust-notes"];
  const [name, contact_name, phone, email, line_id, address, notes] = fields.map(id =>
    document.getElementById(id)?.value.trim() || "");
  if (!name) return alert("公司名稱必填");
  try {
    if (editCustomerId) {
      await api("PUT", `/api/customers/${editCustomerId}`, { name, contact_name, phone, email, line_id, address, notes });
    } else {
      await api("POST", "/api/customers", { name, contact_name, phone, email, line_id, address, notes });
    }
    bootstrap.Modal.getInstance(document.getElementById("newCustomerModal")).hide();
    loadCustomers();
  } catch (e) {
    alert("儲存失敗：" + e.message);
  }
}

let addBranchCustomerId = null;
let editBranchId = null;

async function deleteBranch(bid) {
  let branchName = "";
  allCustomers.forEach(c => {
    const b = c.branches.find(x => x.id === bid);
    if (b) branchName = b.name;
  });
  if (!confirm(`確定刪除院區「${branchName}」？此操作無法復原。`)) return;
  try {
    await api("DELETE", `/api/customers/branches/${bid}`);
    await loadCustomers();
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

function openAddBranch(cid) {
  addBranchCustomerId = cid;
  editBranchId = null;
  ["branch-name","branch-contact","branch-phone","branch-email","branch-line","branch-address","branch-notes"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.querySelector("#newBranchModal .modal-title").textContent = "新增院區 / 分點";
  document.querySelector("#newBranchModal .modal-footer .btn-primary").textContent = "新增";
  bootstrap.Modal.getOrCreateInstance(document.getElementById("newBranchModal")).show();
}

function editBranch(bid) {
  try {
    let branch = null;
    allCustomers.forEach(c => {
      const b = c.branches.find(x => x.id === bid);
      if (b) { branch = b; addBranchCustomerId = c.id; }
    });
    if (!branch) { alert("找不到院區 id=" + bid); return; }
    editBranchId = bid;
    document.getElementById("branch-name").value    = branch.name || "";
    document.getElementById("branch-contact").value = branch.contact_name || "";
    document.getElementById("branch-phone").value   = branch.phone || "";
    document.getElementById("branch-email").value   = branch.email || "";
    document.getElementById("branch-line").value    = branch.line_id || "";
    document.getElementById("branch-address").value = branch.address || "";
    document.getElementById("branch-notes").value   = branch.notes || "";
    document.querySelector("#newBranchModal .modal-title").textContent = "編輯院區 / 分點";
    document.querySelector("#newBranchModal .modal-footer .btn-primary").textContent = "儲存變更";
    bootstrap.Modal.getOrCreateInstance(document.getElementById("newBranchModal")).show();
  } catch(e) { alert("editBranch 錯誤：" + e.message); }
}

async function submitBranch() {
  const fields = ["branch-name","branch-contact","branch-phone","branch-email","branch-line","branch-address","branch-notes"];
  const [name, contact_name, phone, email, line_id, address, notes] = fields.map(id =>
    document.getElementById(id)?.value.trim() || "");
  if (!name) return alert("院區名稱必填");
  if (!addBranchCustomerId) return alert("未指定客戶");
  try {
    if (editBranchId) {
      await api("PUT", `/api/customers/branches/${editBranchId}`,
        { customer_id: addBranchCustomerId, name, contact_name, phone, email, line_id, address, notes });
    } else {
      await api("POST", `/api/customers/${addBranchCustomerId}/branches`,
        { customer_id: addBranchCustomerId, name, contact_name, phone, email, line_id, address, notes });
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById("newBranchModal")).hide();
    await loadCustomers();
  } catch(e) {
    alert("儲存失敗：" + e.message);
  }
}

// ── 人員管理 ─────────────────────────────────────────────
let allStaff = [];
async function loadStaff() {
  allStaff = await api("GET", "/api/staff");
  renderStaff();
  populateStaffSelects();
}

function renderStaff() {
  const tbody = document.getElementById("staff-tbody");
  tbody.innerHTML = "";
  allStaff.forEach(s => {
    tbody.innerHTML += `
      <tr>
        <td><div class="d-flex align-items-center gap-2"><div class="avatar">${s.name[0]}</div>${s.name}</div></td>
        <td>${s.title || "–"}</td>
        <td>${s.phone || "–"}</td>
        <td><span class="badge bg-light text-dark border">${s.active_items} 項進行中</span></td>
        <td><div class="d-flex gap-1">
          <button class="btn btn-sm btn-outline-secondary" onclick="editStaff(${s.id})">編輯</button>
          <button class="btn btn-sm btn-outline-danger" onclick="deleteStaff(${s.id})">刪除</button>
        </div></td>
      </tr>`;
  });
}

function populateStaffSelects() {
  document.querySelectorAll(".staff-select").forEach(sel => {
    const cur = sel.value;
    sel.innerHTML = '<option value="">— 選擇人員 —</option>';
    allStaff.forEach(s => {
      sel.innerHTML += `<option value="${s.id}">${s.name}${s.title ? "（" + s.title + "）" : ""}</option>`;
    });
    sel.value = cur;
  });
}

let editStaffId = null;

function editStaff(id) {
  try {
    const s = allStaff.find(x => x.id === id);
    if (!s) { alert("找不到人員 id=" + id); return; }
    editStaffId = id;
    document.getElementById("staff-name").value  = s.name || "";
    document.getElementById("staff-title").value = s.title || "";
    document.getElementById("staff-phone").value = s.phone || "";
    document.getElementById("staff-notes").value = s.notes || "";
    document.querySelector("#newStaffModal .modal-title").textContent = "編輯人員";
    new bootstrap.Modal(document.getElementById("newStaffModal")).show();
  } catch(e) { alert("editStaff 錯誤：" + e.message); }
}

async function submitStaff() {
  const fields = ["staff-name","staff-title","staff-phone","staff-email","staff-line","staff-address","staff-notes"];
  const [name, title, phone, email, line_id, address, notes] = fields.map(id =>
    document.getElementById(id)?.value.trim() || "");
  if (!name) return alert("姓名必填");
  try {
    if (editStaffId) {
      await api("PUT", `/api/staff/${editStaffId}`, { name, title, phone, email, line_id, address, notes });
    } else {
      await api("POST", "/api/staff", { name, title, phone, email, line_id, address, notes });
    }
    bootstrap.Modal.getInstance(document.getElementById("newStaffModal")).hide();
    loadStaff();
  } catch (e) {
    alert("儲存失敗：" + e.message);
  }
}

async function deleteStaff(id) {
  const s = allStaff.find(x => x.id === id);
  if (s && s.active_items > 0) {
    if (!confirm(`「${s.name}」目前有 ${s.active_items} 個進行中品項，確定仍要刪除？`)) return;
  } else {
    if (!confirm(`確定刪除人員「${s?.name || id}」？此操作無法復原。`)) return;
  }
  try {
    await api("DELETE", `/api/staff/${id}`);
    await loadStaff();
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

// ── 庫存管理 ─────────────────────────────────────────────
let allInventory = [];

async function loadInventory() {
  allInventory = await api("GET", "/api/inventory");
  renderInventory();
}

function renderInventory() {
  const kw       = (document.getElementById("inv-search").value || "").toLowerCase();
  const category = document.getElementById("inv-category-filter").value;
  const lowOnly  = document.getElementById("inv-low-only").checked;

  let list = allInventory.filter(it => {
    const matchKw  = !kw || it.name.toLowerCase().includes(kw);
    const matchCat = !category || it.category === category;
    const matchLow = !lowOnly || it.low;
    return matchKw && matchCat && matchLow;
  });

  // 頂部警告橫幅：列出所有低庫存品項
  const lows = allInventory.filter(it => it.low);
  const alertBox = document.getElementById("inv-alert");
  if (lows.length) {
    document.getElementById("inv-alert-text").textContent =
      `有 ${lows.length} 項庫存不足：` + lows.map(it => `${it.name}（剩 ${it.quantity} ${it.unit}）`).join("、");
    alertBox.classList.remove("d-none");
  } else {
    alertBox.classList.add("d-none");
  }

  const tbody = document.getElementById("inventory-tbody");
  tbody.innerHTML = "";
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted py-4">尚無品項</td></tr>`;
    return;
  }
  list.forEach(it => {
    const statusBadge = it.low
      ? `<span class="badge badge-urgent rounded-pill">庫存不足</span>`
      : `<span class="badge badge-ok rounded-pill">正常</span>`;
    const catBadge = it.category === "布"
      ? `<span class="badge bg-primary-subtle text-primary">布</span>`
      : `<span class="badge bg-secondary-subtle text-secondary">副料</span>`;
    tbody.innerHTML += `
      <tr class="${it.low ? 'table-warning' : ''}">
        <td>${catBadge}</td>
        <td><span class="fw-semibold">${it.name}</span>${it.notes ? `<div class="text-muted small">${it.notes}</div>` : ""}</td>
        <td class="text-end fw-bold ${it.low ? 'text-danger' : ''}">${it.quantity} <span class="text-muted fw-normal small">${it.unit}</span></td>
        <td class="text-center text-muted">${it.low_threshold}</td>
        <td>${statusBadge}</td>
        <td class="text-end">
          <div class="input-group input-group-sm justify-content-end" style="max-width:240px;margin-left:auto">
            <input type="number" min="1" value="1" class="form-control text-center" id="inv-step-${it.id}" style="max-width:70px">
            <button class="btn btn-outline-success" onclick="adjustInventory(${it.id}, 1)" title="補貨"><i class="bi bi-plus-lg"></i> 補</button>
            <button class="btn btn-outline-danger" onclick="adjustInventory(${it.id}, -1)" title="用掉"><i class="bi bi-dash-lg"></i> 用</button>
          </div>
        </td>
        <td class="text-end">
          <button class="btn btn-sm btn-link text-muted p-0 me-2" onclick="showInventoryLog(${it.id})" title="異動歷史"><i class="bi bi-clock-history"></i></button>
          <button class="btn btn-sm btn-link text-muted p-0 me-2" onclick="openInventoryModal(${it.id})" title="編輯"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-link text-danger p-0" onclick="deleteInventory(${it.id})" title="刪除"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  });
}

function invSyncUnit() {
  const unit = document.getElementById("inv-unit");
  if (!unit.value || unit.value === "支" || unit.value === "個") {
    unit.value = document.getElementById("inv-category").value === "布" ? "支" : "個";
  }
}

function openInventoryModal(id) {
  const modal = new bootstrap.Modal(document.getElementById("invItemModal"));
  const qtyHint = document.querySelector(".inv-qty-hint");
  if (id) {
    const it = allInventory.find(x => x.id === id);
    document.getElementById("inv-modal-title").textContent = "編輯品項";
    document.getElementById("inv-id").value = it.id;
    document.getElementById("inv-category").value = it.category;
    document.getElementById("inv-name").value = it.name;
    document.getElementById("inv-unit").value = it.unit;
    document.getElementById("inv-qty").value = it.quantity;
    document.getElementById("inv-qty").disabled = true;       // 編輯時數量請用補貨/用掉
    qtyHint.textContent = "數量請用列表的「補/用」按鈕調整";
    document.getElementById("inv-threshold").value = it.low_threshold;
    document.getElementById("inv-notes").value = it.notes || "";
  } else {
    document.getElementById("inv-modal-title").textContent = "新增品項";
    document.getElementById("inv-id").value = "";
    document.getElementById("inv-category").value = "布";
    document.getElementById("inv-name").value = "";
    document.getElementById("inv-unit").value = "支";
    document.getElementById("inv-qty").value = 0;
    document.getElementById("inv-qty").disabled = false;
    qtyHint.textContent = "僅新增時可填";
    document.getElementById("inv-threshold").value = 4;
    document.getElementById("inv-notes").value = "";
  }
  modal.show();
}

async function submitInventory() {
  const id = document.getElementById("inv-id").value;
  const name = document.getElementById("inv-name").value.trim();
  if (!name) { alert("請輸入品項名稱"); return; }
  const payload = {
    category: document.getElementById("inv-category").value,
    name,
    unit: document.getElementById("inv-unit").value.trim() || "個",
    quantity: parseInt(document.getElementById("inv-qty").value) || 0,
    low_threshold: parseInt(document.getElementById("inv-threshold").value) || 0,
    notes: document.getElementById("inv-notes").value.trim() || null,
  };
  try {
    if (id) await api("PUT", `/api/inventory/${id}`, payload);
    else    await api("POST", "/api/inventory", payload);
    bootstrap.Modal.getInstance(document.getElementById("invItemModal")).hide();
    await loadInventory();
  } catch(e) {
    alert("儲存失敗：" + e.message);
  }
}

async function adjustInventory(id, sign) {
  const step = parseInt(document.getElementById(`inv-step-${id}`).value) || 1;
  const change = Math.abs(step) * sign;
  try {
    const res = await api("POST", `/api/inventory/${id}/adjust`, { change });
    await loadInventory();
    if (res.low) {
      const it = allInventory.find(x => x.id === id);
      alert(`⚠️ ${it.name} 已低於警告值，目前剩 ${res.quantity} ${it.unit}`);
    }
  } catch(e) {
    alert(e.message);
  }
}

function showInventoryLog(id) {
  const it = allInventory.find(x => x.id === id);
  document.getElementById("inv-log-name").textContent = it.name;
  const tbody = document.getElementById("inv-log-tbody");
  tbody.innerHTML = "";
  if (!it.logs.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-3">尚無異動紀錄</td></tr>`;
  } else {
    it.logs.forEach(lg => {
      const sign = lg.change > 0
        ? `<span class="text-success">+${lg.change}</span>`
        : `<span class="text-danger">${lg.change}</span>`;
      tbody.innerHTML += `
        <tr>
          <td class="small text-muted">${lg.created_at}</td>
          <td class="text-end fw-semibold">${sign}</td>
          <td class="text-end">${lg.balance_after}</td>
          <td class="small">${lg.note || ""}</td>
        </tr>`;
    });
  }
  new bootstrap.Modal(document.getElementById("invLogModal")).show();
}

async function deleteInventory(id) {
  const it = allInventory.find(x => x.id === id);
  if (!confirm(`確定刪除「${it.name}」？所有異動紀錄會一併刪除。`)) return;
  try {
    await api("DELETE", `/api/inventory/${id}`);
    await loadInventory();
  } catch(e) {
    alert("刪除失敗：" + e.message);
  }
}

// ── 通訊錄 ───────────────────────────────────────────────
async function loadPhonebook() {
  const list = await api("GET", "/api/phonebook");
  const container = document.getElementById("phonebookList");
  container.innerHTML = "";
  list.forEach(entry => {
    const colorMap = { "客戶": "#0ea5e9", "院區": "#6366f1", "人員": "#3b82f6" };
    const labelClass = { "客戶": "text-primary", "院區": "", "人員": "text-success" };
    container.innerHTML += `
      <div class="col-md-4 pb-card" data-type="${entry.type}"
           data-search="${[entry.name, entry.contact_name, entry.phone, entry.email, entry.address, entry.parent].filter(Boolean).join(" ").toLowerCase()}">
        <div class="card p-3 h-100">
          <div class="d-flex align-items-center gap-2 mb-2">
            <div class="avatar" style="background:${colorMap[entry.type]};width:36px;height:36px;font-size:.85rem">${entry.name[0]}</div>
            <div>
              <div class="fw-semibold">${entry.name}</div>
              <span class="badge bg-light border ${labelClass[entry.type]}" style="font-size:.7rem">
                ${entry.type}${entry.parent ? " · " + entry.parent : ""}
              </span>
            </div>
          </div>
          ${entry.contact_name && entry.contact_name !== entry.name ? `<div class="small text-muted mb-1"><i class="bi bi-person me-1"></i>${entry.contact_name}</div>` : ""}
          <div class="small mb-1"><i class="bi bi-telephone me-1 text-muted"></i>${entry.phone || "–"}
            ${entry.phone ? `<button class="btn btn-link btn-sm p-0 ms-1 text-muted" onclick="copyText('${entry.phone}')"><i class="bi bi-copy" style="font-size:.7rem"></i></button>` : ""}
          </div>
          <div class="small mb-1"><i class="bi bi-envelope me-1 text-muted"></i>${entry.email || "–"}</div>
          <div class="small mb-1"><i class="bi bi-chat me-1 text-muted"></i>${entry.line_id || "–"}</div>
          <div class="small text-muted"><i class="bi bi-geo-alt me-1"></i>${entry.address || "–"}</div>
        </div>
      </div>`;
  });
}

// ── 新增半成品品項 ────────────────────────────────────────
async function submitItem() {
  const name = document.getElementById("item-name")?.value.trim();
  if (!name) return alert("品項名稱必填");
  if (!currentOrder) return alert("未開啟訂單");
  const staffId     = document.getElementById("item-staff")?.value;
  const expectedDate = document.getElementById("item-date")?.value;
  const status      = document.getElementById("item-status")?.value || "未開始";
  try {
    await api("POST", `/api/orders/${currentOrder.id}/production`, {
      name,
      staff_id: staffId ? parseInt(staffId) : null,
      expected_date: expectedDate || null,
      status,
    });
    bootstrap.Modal.getInstance(document.getElementById("newItemModal")).hide();
    await openOrder(currentOrder.id);
  } catch(e) {
    alert("新增失敗：" + e.message);
  }
}

// ── 通訊錄新增聯絡人 ─────────────────────────────────────
async function submitContact() {
  const type = document.querySelector('input[name="contactType"]:checked').value;
  const g = id => document.getElementById(id)?.value.trim() || "";
  try {
    if (type === "客戶") {
      if (!g("ct-cust-name")) return alert("公司名稱必填");
      await api("POST", "/api/customers", {
        name: g("ct-cust-name"), contact_name: g("ct-cust-contact"),
        phone: g("ct-cust-phone"), email: g("ct-cust-email"),
        line_id: g("ct-cust-line"), address: g("ct-cust-address"), notes: g("ct-cust-notes"),
      });
    } else if (type === "院區") {
      const cid = parseInt(document.querySelector("#ctFields-院區 select").value);
      if (!cid) return alert("請選擇所屬客戶");
      if (!g("ct-branch-name")) return alert("院區名稱必填");
      await api("POST", `/api/customers/${cid}/branches`, {
        customer_id: cid, name: g("ct-branch-name"), contact_name: g("ct-branch-contact"),
        phone: g("ct-branch-phone"), email: g("ct-branch-email"),
        line_id: g("ct-branch-line"), address: g("ct-branch-address"), notes: g("ct-branch-notes"),
      });
    } else {
      if (!g("ct-staff-name")) return alert("姓名必填");
      await api("POST", "/api/staff", {
        name: g("ct-staff-name"), title: g("ct-staff-title"),
        phone: g("ct-staff-phone"), email: g("ct-staff-email"),
        line_id: g("ct-staff-line"), address: g("ct-staff-address"), notes: g("ct-staff-notes"),
      });
    }
    bootstrap.Modal.getInstance(document.getElementById("newContactModal")).hide();
    loadPhonebook();
    loadCustomers();
    loadStaff();
  } catch(e) {
    alert("新增失敗：" + e.message);
  }
}

// ── 初始化 ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("newOrderModal").addEventListener("hidden.bs.modal", () => {
    editOrderId = null;
    document.querySelector("#newOrderModal .modal-title").textContent = "新增訂單";
    document.querySelector("#newOrderModal .modal-footer .btn-primary").textContent = "建立訂單";
    document.getElementById("order-number").value   = "";
    document.getElementById("order-delivery").value = "";
    document.getElementById("order-reminder").value = "7";
    document.getElementById("order-notes").value    = "";
    document.getElementById("customerSelect").value = "";
    document.getElementById("branchSelect").innerHTML = '<option value="">— 先選客戶 —</option>';
    document.getElementById("orderItems").innerHTML = `
      <div class="order-item border rounded p-3 mb-3 bg-light" data-item="1">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <div class="fw-semibold text-primary small">品項 1</div>
          <button type="button" class="btn btn-sm btn-outline-danger py-0" onclick="removeItem(this)" style="display:none">移除品項</button>
        </div>
        <div class="row g-2 mb-2">
          <div class="col-md-6"><label class="form-label small">品名</label><input type="text" class="form-control form-control-sm" placeholder="e.g. 手術衣"></div>
        </div>
        <div class="size-list">
          <div class="row g-2 align-items-center mb-1 size-row">
            <div class="col-md-4"><label class="form-label small">尺寸</label><input type="text" class="form-control form-control-sm" placeholder="e.g. M"></div>
            <div class="col-md-3"><label class="form-label small">數量</label><input type="number" class="form-control form-control-sm" placeholder="e.g. 100"></div>
            <div class="col-md-2 pt-4"><button type="button" class="btn btn-sm btn-outline-danger py-0" onclick="removeSize(this)" style="display:none"><i class="bi bi-x"></i></button></div>
          </div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-secondary mt-1" onclick="addSize(this)"><i class="bi bi-plus"></i> 新增尺寸</button>
      </div>`;
    itemCount = 1;
  });
  document.getElementById("newBranchModal").addEventListener("hidden.bs.modal", () => {
    editBranchId = null;
    document.querySelector("#newBranchModal .modal-title").textContent = "新增院區 / 分點";
    document.querySelector("#newBranchModal .modal-footer .btn-primary").textContent = "新增";
    ["branch-name","branch-contact","branch-phone","branch-email","branch-line","branch-address","branch-notes"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  });
  document.getElementById("newCustomerModal").addEventListener("hidden.bs.modal", () => {
    editCustomerId = null;
    document.querySelector("#newCustomerModal .modal-title").textContent = "新增客戶";
  });
  document.getElementById("newStaffModal").addEventListener("hidden.bs.modal", () => {
    editStaffId = null;
    document.querySelector("#newStaffModal .modal-title").textContent = "新增人員";
  });

  await loadCustomers();
  await loadStaff();
  await loadOrders();
  await loadDashboard();
  await loadPhonebook();
  await loadInventory();
});
