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
        <td><a href="#" onclick="openOrder(${o.id})" class="text-decoration-none fw-semibold">${o.order_number}</a></td>
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
  renderOrders(allOrders);
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
        <td><span class="badge ${URGENCY_BADGE[o.urgency]} rounded-pill">${o.days_left >= 0 ? o.days_left + " 天" : "已逾期"}</span></td>
        <td><span class="badge ${STATUS_BADGE[o.status] || "bg-secondary"}">${o.status}</span></td>
        <td><a href="#" onclick="openOrder(${o.id})" class="btn btn-sm btn-outline-secondary">查看</a></td>
      </tr>`;
  });
}

function filterOrders() {
  const kw = document.getElementById("order-search").value.toLowerCase();
  const st = document.getElementById("order-status-filter").value;
  renderOrders(allOrders.filter(o => {
    const matchKw = !kw || o.order_number.toLowerCase().includes(kw) || o.customer_name.toLowerCase().includes(kw);
    const matchSt = !st || o.status === st;
    return matchKw && matchSt;
  }));
}

// ── 訂單詳情 ─────────────────────────────────────────────
let currentOrder = null;
async function openOrder(id) {
  currentOrder = await api("GET", `/api/orders/${id}`);
  renderDetail(currentOrder);
  showPage("detail");
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
      `<div class="timeline-note"><div class="text-muted" style="font-size:.8rem">${n.created_at}</div><div>${n.content}</div></div>`
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

// ── 新增訂單 ─────────────────────────────────────────────
async function submitOrder() {
  const customerSelect = document.getElementById("customerSelect");
  const branchSelect   = document.getElementById("branchSelect");
  const deliveryDate   = document.getElementById("order-delivery").value;
  const reminderDays   = parseInt(document.getElementById("order-reminder").value) || 7;
  const notes          = document.getElementById("order-notes").value;

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

  try {
    await api("POST", "/api/orders", {
      customer_id: parseInt(customerSelect.value),
      branch_id: branchSelect.value ? parseInt(branchSelect.value) : null,
      delivery_date: deliveryDate,
      reminder_days: reminderDays,
      notes, items,
    });
    bootstrap.Modal.getInstance(document.getElementById("newOrderModal")).hide();
    loadOrders();
    loadDashboard();
  } catch(e) {
    alert("建立失敗：" + e.message);
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
      `<span class="branch-tag" style="cursor:pointer" onclick="editBranch(${b.id})">${b.name} <i class="bi bi-pencil" style="font-size:.65rem"></i></span>`).join("");
    container.innerHTML += `
      <div class="col-12">
        <div class="card p-4">
          <div class="d-flex justify-content-between align-items-start mb-3">
            <div><div class="fw-bold fs-6 mb-1">${c.name}</div><span class="badge bg-light text-dark border">${c.order_count} 筆訂單</span></div>
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

function openAddBranch(cid) {
  addBranchCustomerId = cid;
  editBranchId = null;
  new bootstrap.Modal(document.getElementById("newBranchModal")).show();
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
    new bootstrap.Modal(document.getElementById("newBranchModal")).show();
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
    bootstrap.Modal.getInstance(document.getElementById("newBranchModal")).hide();
    loadCustomers();
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
        <td><button class="btn btn-sm btn-outline-secondary" onclick="editStaff(${s.id})">編輯</button></td>
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

// ── 通訊錄新增聯絡人 ─────────────────────────────────────
async function submitContact() {
  const type = document.querySelector('input[name="contactType"]:checked').value;
  if (type === "客戶") {
    await submitCustomer();
  } else if (type === "院區") {
    const cid = parseInt(document.querySelector("#ctFields-院區 select").value);
    if (!cid) return alert("請選擇所屬客戶");
    addBranchCustomerId = cid;
    await submitBranch();
  } else {
    await submitStaff();
  }
  bootstrap.Modal.getInstance(document.getElementById("newContactModal")).hide();
  loadPhonebook();
}

// ── 初始化 ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  document.getElementById("newBranchModal").addEventListener("hidden.bs.modal", () => {
    editBranchId = null;
    document.querySelector("#newBranchModal .modal-title").textContent = "新增院區 / 分點";
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
});
