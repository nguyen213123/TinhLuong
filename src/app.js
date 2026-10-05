const $ = (s) => document.querySelector(s),
  money = (n) => new Intl.NumberFormat("vi-VN").format(Number(n) || 0) + "đ",
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    ),
  fmtDate = (s) => {
    if (!s) return "—";
    const [y, m, d] = String(s).slice(0, 10).split("-");
    return `${d}/${m}/${y}`;
  },
  shortName = (s) =>
    String(s || "?")
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((x) => x[0])
      .join("")
      .toUpperCase(),
  today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
let db = {
    workers: [],
    products: [],
    production: [],
    debts: [],
    payments: [],
    periods: [],
    audit: [],
  },
  page = "dashboard",
  selectedWorker = "",
  selectedDetail = "",
  query = "",
  dashboardMonth = today().slice(0, 7),
  debtDirection = "WORKER_OWES",
  prodDate = today(),
  prodWorker = "",
  busy = false;
const api = window.api;
async function reload() {
  const result = await api.getData();
  db = result.data;
  render();
}
function toast(message, error = false) {
  const el = document.createElement("div");
  el.className = "toast" + (error ? " error" : "");
  el.textContent = message;
  $("#toast-root").append(el);
  setTimeout(() => el.remove(), 3300);
}
function navTo(p) {
  page = p;
  document
    .querySelectorAll(".nav[data-page]")
    .forEach((x) => x.classList.toggle("active", x.dataset.page === p));
  $("#page-title").textContent = {
    dashboard: "Tổng quan",
    production: "Nhập sản lượng",
    workers: "Kỹ sư",
    products: "Sản phẩm",
    debts: "Khoản nợ",
    payments: "Thanh toán",
    history: "Lịch sử thanh toán",
  }[p];
  render();
}
function act(title, desc, body, buttons) {
  $("#modal-root").innerHTML =
    `<div class="modal-backdrop" data-close><div class="modal ${body.includes("table-wrap") ? "wide" : ""}" role="dialog"><button class="close-x" data-close>×</button><h2>${title}</h2><p class="modal-desc">${desc || ""}</p>${body}<div class="modal-actions">${buttons}</div></div></div>`;
  $("#modal-root").onclick = (e) => {
    if (e.target.dataset.close !== undefined) $("#modal-root").innerHTML = "";
  };
}
const cancel = `<button class="btn" data-close>Hủy</button>`;
async function run(fn, success) {
  try {
    await fn();
    $("#modal-root").innerHTML = "";
    await reload();
    if (success) toast(success);
  } catch (e) {
    toast(e.message || "Đã có lỗi xảy ra.", true);
  }
}
function workerSelect(value = "") {
  return `<select id="f-worker"><option value="">Chọn kỹ sư</option>${db.workers
    .filter((w) => w.status === "ACTIVE")
    .map(
      (w) =>
        `<option value="${esc(w.id)}" ${w.id === value ? "selected" : ""}>${esc(w.name)}</option>`,
    )
    .join("")}</select>`;
}
function pageHead(title, description, button = "") {
  return `<div><h2 class="section-title">${title}</h2><p class="section-description">${description}</p></div>${button}`;
}
function person(w) {
  return `<div class="person"><div class="person-avatar">${esc(shortName(w.name))}</div><b>${esc(w.name)}</b></div>`;
}
function unpaid(workerId) {
  return db.production
    .filter((x) => x.workerId === workerId && x.status === "UNPAID")
    .reduce((s, x) => s + Number(x.totalAmount), 0);
}
function monthlyPayments(workerId, month) {
  return db.payments
    .filter(
      (x) => x.workerId === workerId && String(x.paymentDate || "").slice(0, 7) === month,
    )
    .reduce(
      (totals, x) => ({
        wage: totals.wage + (Number(x.productionTotal) || 0),
        debt: totals.debt + (Number(x.debtDeducted) || 0),
        companyDebt: totals.companyDebt + (Number(x.companyDebtAdded) || 0),
        received: totals.received + (Number(x.actualReceived) || 0),
      }),
      { wage: 0, debt: 0, companyDebt: 0, received: 0 },
    );
}
function render() {
  const node = $("#content");
  if (!node) return;
  (
    ({
      dashboard: dashboard,
      workers: workersPage,
      products: productsPage,
      production: productionPage,
      debts: debtsPage,
      payments: paymentsPage,
      history: historyPage,
    })[page] || dashboard
  )(node);
}
function dashboard(root) {
  const active = db.workers.filter((x) => x.status === "ACTIVE"),
    dashboardWorkers = db.workers.filter(
      (w) => w.status === "ACTIVE" || db.payments.some((p) => p.workerId === w.id),
    ),
    products = db.products.filter((x) => x.status === "ACTIVE"),
    total = active.reduce((s, w) => s + unpaid(w.id), 0);
  root.innerHTML = `<div class="welcome"><div><p>Tình hình công việc và tiền lương chưa thanh toán.</p></div><div class="actions"><button class="btn" data-go="workers">＋ Kỹ sư</button><button class="btn" data-go="products">＋ Sản phẩm</button><button class="btn primary" data-go="production">＋ Nhập sản lượng</button></div></div><div class="stats"><div class="card stat"><span class="stat-icon">₫</span><div class="stat-label">TỔNG CHƯA THANH TOÁN</div><div class="stat-value">${money(total)}</div><div class="stat-sub">Tất cả Kỹ sư</div></div><div class="card stat"><span class="stat-icon">♙</span><div class="stat-label">Kỹ sư</div><div class="stat-value">${active.length}</div><div class="stat-sub">Đang hoạt động</div></div><div class="card stat"><span class="stat-icon">▦</span><div class="stat-label">SẢN PHẨM</div><div class="stat-value">${products.length}</div><div class="stat-sub">Đang áp dụng</div></div><div class="card stat"><span class="stat-icon">◷</span><div class="stat-label">ĐỢT ĐANG MỞ</div><div class="stat-value">${db.periods.filter((x) => x.status === "OPEN").length}</div><div class="stat-sub">Chờ thanh toán</div></div></div><div class="dashboard-grid"><section class="card panel"><div class="panel-head"><div><h3>Tổng kết thanh toán theo Kỹ sư</h3><div class="subhead">Thống kê theo tháng; gồm lương, nợ Kỹ sư bị trừ và nợ Công ty cộng thêm.</div></div><input class="search" id="dashboard-month" type="month" value="${esc(dashboardMonth)}" aria-label="Chọn tháng thống kê"></div><div class="table-wrap"><table><thead><tr><th>KỸ SƯ</th><th>ĐỢT ĐANG MỞ</th><th>CHƯA THANH TOÁN</th><th>LƯƠNG ĐÃ THANH TOÁN</th><th>NỢ ĐÃ TRỪ</th><th>NỢ CÔNG TY CỘNG</th><th>THỰC NHẬN TRONG THÁNG</th><th>TRẠNG THÁI</th></tr></thead><tbody>${
    dashboardWorkers.length
      ? dashboardWorkers
          .map((w) => {
            const amount = unpaid(w.id),
              paymentTotals = monthlyPayments(w.id, dashboardMonth),
              period = db.periods.find(
                (p) => p.workerId === w.id && p.status === "OPEN",
              );
            return `<tr><td>${person(w)}</td><td class="muted">${period ? fmtDate(period.startDate) + " – " + fmtDate(period.endDate) : "—"}</td><td><button class="link-money" data-detail="${w.id}">${money(amount)}</button></td><td class="money">${money(paymentTotals.wage)}</td><td>${money(paymentTotals.debt)}</td><td>${money(paymentTotals.companyDebt)}</td><td class="money">${money(paymentTotals.received)}</td><td><span class="badge ${amount ? "unpaid" : "closed"}">${amount ? "Chưa trả" : "Đã thanh toán"}</span></td></tr>`;
          })
          .join("")
      : `<tr><td colspan="8"><div class="empty"><div class="empty-icon">♙</div>Chưa có Kỹ sư. Hãy thêm Kỹ sư để bắt đầu.</div></td></tr>`
  }</tbody></table></div></section><section class="card panel"><div class="panel-head"><div><h3>Thao tác nhanh</h3><div class="subhead">Quản lý công việc hằng ngày</div></div></div><div class="quick-list"><button class="quick" data-go="production"><span>＋</span><div><b>Nhập sản lượng</b><small>Ghi nhận công việc theo ngày</small></div><i>›</i></button><button class="quick" data-go="payments"><span>₫</span><div><b>Thanh toán lương</b><small>Thanh toán toàn bộ đợt đang mở</small></div><i>›</i></button><button class="quick" data-go="debts"><span>↗</span><div><b>Ghi nhận khoản nợ</b><small>Thêm khoản ứng hoặc chi phí</small></div><i>›</i></button><div class="notice" style="margin-top:16px">📁 Excel là nguồn dữ liệu chính. Workbook được lưu trên máy tính này và tự đọc lại khi mở ứng dụng.</div></div></section></div>`;
  root
    .querySelectorAll("[data-go]")
    .forEach((b) => (b.onclick = () => navTo(b.dataset.go)));
  root.querySelector("#dashboard-month").onchange = (event) => {
    if (!event.target.value) return;
    dashboardMonth = event.target.value;
    dashboard(root);
  };
  root.querySelectorAll("[data-detail]").forEach(
    (b) =>
      (b.onclick = () => {
        selectedWorker = b.dataset.detail;
        workerDetail(selectedWorker);
      }),
  );
}
function workerDetail(workerId) {
  const w = db.workers.find((x) => x.id === workerId);
  if (!w) return;
  const rows = db.production
      .filter((x) => x.workerId === workerId && x.status === "UNPAID")
      .reduce((a, x) => {
        a[x.date] = (a[x.date] || 0) + Number(x.totalAmount);
        return a;
      }, {}),
    dates = Object.keys(rows).sort().reverse();
  act(
    esc(w.name),
    "Chi tiết các ngày chưa thanh toán",
    `<div class="detail-line"><b>Tổng chưa thanh toán</b><b class="money">${money(unpaid(workerId))}</b></div><div style="margin-top:10px">${dates.length ? dates.map((d) => `<div class="detail-line"><span>${fmtDate(d)}</span><span class="money">${money(rows[d])}</span></div>`).join("") : '<div class="empty">Không có khoản lương chưa thanh toán.</div>'}</div>`,
    `<button class="btn" data-close>Đóng</button><button class="btn primary" id="pay-this">Thanh toán →</button>`,
  );
  $("#pay-this").onclick = () => {
    selectedWorker = workerId;
    navTo("payments");
    paymentModal(workerId);
  };
}
function workersPage(root) {
  const arr = db.workers.filter(
    (w) =>
      w.status === "ACTIVE" &&
      w.name.toLowerCase().includes(query.toLowerCase()),
  );
  root.innerHTML = `<div class="page-tools">${pageHead("Danh sách Kỹ sư", "Theo dõi Kỹ sư và tổng tiền lương chưa thanh toán.", `<button class="btn primary" id="add-worker">＋ Thêm Kỹ sư</button>`)}</div><section class="card panel"><div class="panel-head"><h3>${arr.length} Kỹ sư</h3><input class="search" id="search" placeholder="⌕  Tìm tên Kỹ sư" value="${esc(query)}"></div><div class="table-wrap"><table><thead><tr><th>KỸ SƯ</th><th>NGÀY THAM GIA</th><th>ĐỢT ĐANG MỞ</th><th>CHƯA THANH TOÁN</th><th></th></tr></thead><tbody>${
    arr.length
      ? arr
          .map((w) => {
            const p = db.periods.find(
              (x) => x.workerId === w.id && x.status === "OPEN",
            );
            return `<tr><td>${person(w)}</td><td>${fmtDate(w.createdAt.slice(0, 10))}</td><td>${p ? `${fmtDate(p.startDate)} – ${fmtDate(p.endDate)}` : "—"}</td><td><button class="link-money" data-detail="${w.id}">${money(unpaid(w.id))}</button></td><td><button class="icon-btn" data-remove="${w.id}">Xóa</button></td></tr>`;
          })
          .join("")
      : '<tr><td colspan="5"><div class="empty">Chưa có Kỹ sư phù hợp.</div></td></tr>'
  }</tbody></table></div></section>`;
  $("#search").oninput = (e) => {
    query = e.target.value;
    workersPage(root);
  };
  $("#add-worker").onclick = addWorkerModal;
  root
    .querySelectorAll("[data-detail]")
    .forEach((b) => (b.onclick = () => workerDetail(b.dataset.detail)));
  root
    .querySelectorAll("[data-remove]")
    .forEach((b) => (b.onclick = () => confirmWorkerDelete(b.dataset.remove)));
}
function addWorkerModal() {
  act(
    "Thêm Kỹ sư",
    "Nhập tên để thêm Kỹ sư mới vào danh sách.",
    `<div class="field"><label>TÊN KỸ SƯ *</label><input id="worker-name" placeholder="Ví dụ: Nguyễn Văn A" autofocus></div>`,
    `${cancel}<button class="btn primary" id="save-worker">Thêm Kỹ sư</button>`,
  );
  $("#save-worker").onclick = () =>
    run(() => api.addWorker($("#worker-name").value), "Đã thêm Kỹ sư");
}
function confirmWorkerDelete(id) {
  const w = db.workers.find((x) => x.id === id);
  act(
    "Xóa Kỹ sư?",
    `Bạn có chắc muốn xóa ${esc(w.name)}? Dữ liệu sản xuất, thanh toán và khoản nợ liên quan có thể được giữ lại trong lịch sử.`,
    `<div class="notice">Kỹ sư có thể có dữ liệu sản xuất, lịch sử thanh toán và khoản nợ liên quan. Hồ sơ sẽ được ngừng hoạt động.</div>`,
    `${cancel}<button class="btn danger" id="confirm-delete">Xác nhận xóa</button>`,
  );
  $("#confirm-delete").onclick = () =>
    run(() => api.deleteWorker(id), "Đã ngừng hoạt động Kỹ sư");
}
function productsPage(root) {
  const arr = db.products.filter((p) => p.status === "ACTIVE");
  root.innerHTML = `<div class="page-tools">${pageHead("Danh mục sản phẩm", "Giá mới chỉ áp dụng cho sản lượng phát sinh sau thời điểm cập nhật.", `<button class="btn primary" id="add-product">＋ Thêm sản phẩm</button>`)}</div><section class="card panel"><div class="panel-head"><h3>${arr.length} sản phẩm đang áp dụng</h3><span class="muted" style="font-size:10px">Đơn giá lịch sử được lưu riêng theo từng ngày sản xuất</span></div><div class="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>ĐƠN GIÁ HIỆN TẠI</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody>${arr.length ? arr.map((p) => `<tr><td><div class="person"><div class="person-avatar">▦</div><b>${esc(p.name)}</b></div></td><td class="money">${money(p.currentPrice)}</td><td><span class="badge active">Đang áp dụng</span></td><td><div class="row-actions"><button class="icon-btn" data-edit="${p.id}">Sửa giá</button><button class="icon-btn" data-remove="${p.id}">Xóa</button></div></td></tr>`).join("") : '<tr><td colspan="4"><div class="empty">Chưa có sản phẩm.</div></td></tr>'}</tbody></table></div></section>`;
  $("#add-product").onclick = () => productModal();
  root
    .querySelectorAll("[data-edit]")
    .forEach((b) => (b.onclick = () => productModal(b.dataset.edit)));
  root
    .querySelectorAll("[data-remove]")
    .forEach((b) => (b.onclick = () => productDelete(b.dataset.remove)));
}
function productModal(id) {
  const p = db.products.find((x) => x.id === id);
  act(
    p ? "Cập nhật sản phẩm" : "Thêm sản phẩm",
    p
      ? "Sửa tên hoặc đơn giá áp dụng từ những lần nhập tiếp theo."
      : "Khai báo sản phẩm và đơn giá hiện tại.",
    `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>TÊN SẢN PHẨM *</label><input id="p-name" value="${esc(p?.name || "")}" placeholder="Ví dụ: Mô hình xe A"></div><div class="field"><label>ĐƠN GIÁ (VNĐ) *</label><input id="p-price" type="number" min="1" step="100" value="${p?.currentPrice || ""}" placeholder="10000"></div></div>`,
    `${cancel}<button class="btn primary" id="save-product">${p ? "Lưu thay đổi" : "Thêm sản phẩm"}</button>`,
  );
  $("#save-product").onclick = () => {
    const payload = { name: $("#p-name").value, price: $("#p-price").value };
    run(
      () =>
        p
          ? api.updateProduct({ ...payload, id: p.id })
          : api.addProduct(payload),
      p ? "Đã cập nhật sản phẩm" : "Đã thêm sản phẩm",
    );
  };
}
function productDelete(id) {
  const p = db.products.find((x) => x.id === id);
  act(
    "Ngừng áp dụng sản phẩm?",
    `Bạn có chắc muốn ngừng áp dụng “${esc(p.name)}”? Dữ liệu lịch sử sẽ giữ nguyên tên và giá đã ghi nhận.`,
    `<div class="notice">Các bản ghi sản xuất cũ được giữ nguyên. Sản phẩm sẽ không còn xuất hiện trong danh sách nhập mới.</div>`,
    `${cancel}<button class="btn danger" id="confirm-delete">Xác nhận</button>`,
  );
  $("#confirm-delete").onclick = () =>
    run(() => api.deleteProduct(id), "Đã ngừng áp dụng sản phẩm");
}
function productionPage(root) {
  const products = db.products.filter((p) => p.status === "ACTIVE");
  root.innerHTML = `${pageHead("Ghi nhận sản lượng", "Chọn ngày và Kỹ sư, sau đó nhập số lượng. Thành tiền được tính tự động.")}<div class="production-top"><div class="field"><label>NGÀY SẢN XUẤT</label><input id="prod-date" type="date" value="${prodDate}"></div><div class="field"><label>KỸ SƯ</label>${workerSelect(prodWorker)}</div></div><section class="card panel"><div class="panel-head"><div><h3>Sản phẩm trong ngày</h3><div class="subhead">Đơn giá được chụp tại thời điểm lưu dữ liệu</div></div></div>${!db.workers.some((w) => w.status === "ACTIVE") ? '<div class="empty">Vui lòng tạo Kỹ sư trước.</div>' : !products.length ? '<div class="empty">Vui lòng tạo sản phẩm trước.</div>' : `<div class="table-wrap"><table class="production-table input-table"><thead><tr><th>SẢN PHẨM</th><th>ĐƠN GIÁ</th><th class="right">SỐ LƯỢNG</th><th class="right">THÀNH TIỀN</th></tr></thead><tbody>${products.map((p) => `<tr data-product="${p.id}" data-price="${p.currentPrice}"><td><b>${esc(p.name)}</b></td><td class="muted">${money(p.currentPrice)}</td><td class="right"><input class="quantity" type="number" min="0" step="1" value="0" aria-label="Số lượng ${esc(p.name)}"></td><td class="right money line-total">0đ</td></tr>`).join("")}</tbody></table></div><div class="total-box"><span>TỔNG TIỀN NGÀY</span><b id="grand-total">0đ</b></div><div class="form-footer"><button class="btn" id="reset-production">Đặt lại</button><button class="btn primary" id="review-production">Kiểm tra &amp; xác nhận</button></div>`}</section>`;
  $("#prod-date").onchange = (e) => (prodDate = e.target.value);
  $("#f-worker").onchange = (e) => (prodWorker = e.target.value);
  root
    .querySelectorAll(".quantity")
    .forEach((i) => (i.oninput = calcProduction));
  $("#reset-production")?.addEventListener(
    "click",
    () =>
      root.querySelectorAll(".quantity").forEach((i) => (i.value = 0)) &&
      calcProduction(),
  );
  $("#review-production")?.addEventListener("click", reviewProduction);
}
function calcProduction() {
  let sum = 0;
  document.querySelectorAll("tr[data-product]").forEach((row) => {
    let q = Math.max(0, Number(row.querySelector(".quantity").value) || 0),
      line = q * Number(row.dataset.price);
    sum += line;
    row.querySelector(".line-total").textContent = money(line);
  });
  const out = $("#grand-total");
  if (out) out.textContent = money(sum);
}
function reviewProduction() {
  const worker = db.workers.find((x) => x.id === prodWorker),
    date = $("#prod-date").value,
    lines = [...document.querySelectorAll("tr[data-product]")]
      .map((r) => ({
        productId: r.dataset.product,
        quantity: Number(r.querySelector(".quantity").value) || 0,
        price: Number(r.dataset.price),
        name: r.children[0].innerText,
      }))
      .filter((x) => x.quantity > 0);
  if (!worker) return toast("Vui lòng chọn Kỹ sư.", true);
  if (!date) return toast("Vui lòng chọn ngày sản xuất.", true);
  if (!lines.length)
    return toast("Vui lòng nhập số lượng ít nhất một sản phẩm.", true);
  if (lines.some((x) => !Number.isInteger(x.quantity)))
    return toast("Số lượng phải là số nguyên không âm.", true);
  const existing = db.production.filter(
    (x) => x.workerId === worker.id && x.date === date,
  );
  if (existing.some((x) => x.status === "PAID"))
    return toast("Ngày này thuộc đợt đã thanh toán và bị khóa.", true);
  if (existing.length) {
    act(
      "Kỹ sư đã có dữ liệu trong ngày này",
      `${esc(worker.name)} · ${fmtDate(date)}. Chọn cách xử lý dữ liệu hiện có.`,
      `<div class="notice">${existing.map((x) => `${esc(x.productName)} × ${x.quantity} = ${money(x.totalAmount)}`).join("<br>")}</div><div class="detail-line"><b>Dữ liệu nhập lần này</b><span>${money(lines.reduce((s, x) => s + x.quantity * x.price, 0))}</span></div>`,
      `${cancel}<button class="btn" id="replace">Thay thế</button><button class="btn primary" id="add">Cộng thêm</button>`,
    );
    $("#replace").onclick = () =>
      confirmProduction(worker, date, lines, "REPLACE");
    $("#add").onclick = () => confirmProduction(worker, date, lines, "ADD");
  } else confirmProduction(worker, date, lines, "REPLACE");
}
function confirmProduction(w, date, lines, mode) {
  let shown = lines.map((x) => ({ ...x }));
  if (mode === "ADD") {
    const old = db.production.filter(
      (x) => x.workerId === w.id && x.date === date,
    );
    shown = lines.map((x) => {
      const prev = old.find((y) => y.productId === x.productId);
      return prev
        ? {
            ...x,
            quantity: x.quantity + Number(prev.quantity),
            price: Number(prev.unitPrice),
          }
        : { ...x };
    });
    old
      .filter((o) => !lines.some((x) => x.productId === o.productId))
      .forEach((o) =>
        shown.push({
          productId: o.productId,
          name: o.productName,
          quantity: Number(o.quantity),
          price: Number(o.unitPrice),
        }),
      );
  }
  const sum = shown.reduce((s, x) => s + x.quantity * x.price, 0);
  act(
    "Xác nhận sản lượng",
    `${esc(w.name)} · ${fmtDate(date)} · ${mode === "ADD" ? "Cộng vào dữ liệu hiện tại" : "Lưu sản lượng ngày"}`,
    `<div>${shown.map((x) => `<div class="detail-line"><span>${esc(x.name)}<small class="muted"> · ${x.quantity} × ${money(x.price)}</small></span><b>${money(x.quantity * x.price)}</b></div>`).join("")}<div class="total-box"><span>TỔNG TIỀN</span><b>${money(sum)}</b></div></div>`,
    `<button class="btn" data-close>Hủy</button><button class="btn primary" id="confirm-save">Xác nhận lưu</button>`,
  );
  $("#confirm-save").onclick = () =>
    run(
      () =>
        api.saveProduction({
          workerId: w.id,
          date,
          mode,
          lines: lines.map((x) => ({
            productId: x.productId,
            quantity: x.quantity,
          })),
        }),
      "Đã lưu sản lượng",
    );
}
function debtsPage(root) {
  const arr = db.debts.slice().sort((a, b) => b.date.localeCompare(a.date));
  root.innerHTML = `<div class="page-tools">${pageHead("Quản lý công nợ", "Theo dõi công nợ hai chiều giữa Kỹ sư và Công ty.", `<button class="btn primary" id="add-debt">＋ Ghi nhận công nợ</button>`)}</div><section class="card panel"><div class="panel-head"><div class="filter-row"><button class="btn primary" data-debt-direction="WORKER_OWES">Kỹ sư nợ Công ty</button><button class="btn" data-debt-direction="COMPANY_OWES">Công ty nợ Kỹ sư</button></div><select id="debt-filter"><option value="ALL">Tất cả trạng thái</option><option value="OPEN">Còn nợ</option><option value="CLOSED">Đã tất toán</option></select></div><div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>KỸ SƯ</th><th>GHI CHÚ</th><th>SỐ TIỀN</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody id="debt-rows"></tbody></table></div></section>`;
  const draw = () => {
    const isCompanyOwes = debtDirection === "COMPANY_OWES",
      openStatus = isCompanyOwes ? "CHUA_TRA" : "CHUA_TRU",
      closedStatus = isCompanyOwes ? "DA_TRA" : "DA_TRU",
      filtered = arr.filter((x) => {
        const itemDirection = x.direction || "WORKER_OWES";
        return (
          itemDirection === debtDirection &&
          ($( "#debt-filter").value === "ALL" ||
            ($( "#debt-filter").value === "OPEN" && x.status === openStatus) ||
            ($( "#debt-filter").value === "CLOSED" && x.status === closedStatus))
        );
      });
    root.querySelectorAll("[data-debt-direction]").forEach((button) => {
      button.classList.toggle("primary", button.dataset.debtDirection === debtDirection);
    });
    $("#debt-rows").innerHTML =
      filtered.map((x) => {
        const isSettled = x.status === closedStatus;
        return `<tr><td>${fmtDate(x.date)}</td><td>${esc(db.workers.find((w) => w.id === x.workerId)?.name || "—")}</td><td>${esc(x.note || "—")}</td><td class="money">${money(x.amount)}</td><td><span class="badge ${isSettled ? "paid" : "unpaid"}">${isSettled ? (isCompanyOwes ? "Đã trả" : "Đã trừ") : (isCompanyOwes ? "Còn phải trả" : "Còn phải thu")}</span></td><td>${isCompanyOwes && !isSettled ? `<button class="icon-btn" data-settle-debt="${x.id}">Đánh dấu đã trả</button>` : ""}</td></tr>`;
      }).join("") ||
      '<tr><td colspan="6"><div class="empty">Không có khoản công nợ phù hợp.</div></td></tr>';
    root.querySelectorAll("[data-settle-debt]").forEach((button) => {
      button.onclick = () => {
        const debt = db.debts.find((x) => x.id === button.dataset.settleDebt);
        act("Xác nhận đã trả khoản nợ?", "Khoản nợ Công ty cần trả cho Kỹ sư sẽ được tất toán.", `<div class="detail-line"><span>Kỹ sư</span><b>${esc(db.workers.find((w) => w.id === debt.workerId)?.name || "—")}</b></div><div class="detail-line"><span>Số tiền</span><b class="money">${money(debt.amount)}</b></div><div class="detail-line"><span>Ghi chú</span><span>${esc(debt.note || "—")}</span></div>`, `<button class="btn" data-close>Hủy</button><button class="btn primary" id="confirm-settle-debt">Xác nhận đã trả</button>`);
        $("#confirm-settle-debt").onclick = () => run(() => api.settleDebt(debt.id), "Đã tất toán khoản nợ với Kỹ sư.");
      };
    });
  };
  $("#debt-filter").onchange = draw;
  root.querySelectorAll("[data-debt-direction]").forEach((button) => {
    button.onclick = () => { debtDirection = button.dataset.debtDirection; draw(); };
  });
  draw();
  $("#add-debt").onclick = () => addDebtModal(debtDirection);
}
function addDebtModal(direction = "WORKER_OWES") {
  if (!db.workers.some((w) => w.status === "ACTIVE"))
    return toast("Vui lòng thêm Kỹ sư trước.", true);
  const isCompanyOwes = direction === "COMPANY_OWES";
  act(
    isCompanyOwes ? "Ghi nhận Công ty nợ Kỹ sư" : "Ghi nhận Kỹ sư nợ Công ty",
    isCompanyOwes ? "Khoản này sẽ được theo dõi đến khi Công ty đánh dấu đã trả." : "Khoản này có thể được chọn để trừ vào lương khi thanh toán.",
    `<div class="form-grid"><div class="field" style="grid-column:1/-1"><label>KỸ SƯ *</label>${workerSelect()}</div><div class="field"><label>NGÀY *</label><input id="debt-date" type="date" value="${today()}"></div><div class="field"><label>SỐ TIỀN (VNĐ) *</label><input id="debt-amount" type="number" min="1" step="1000" placeholder="200000"></div><div class="field" style="grid-column:1/-1"><label>GHI CHÚ</label><input id="debt-note" placeholder="${isCompanyOwes ? "Thưởng, hoàn chi phí, phụ cấp..." : "Ứng tiền, mua vật tư..."}"></div></div>`,
    `${cancel}<button class="btn primary" id="save-debt">Lưu công nợ</button>`,
  );
  $("#save-debt").onclick = () =>
    run(
      () =>
        api.addDebt({
          workerId: $("#f-worker").value,
          date: $("#debt-date").value,
          amount: $("#debt-amount").value,
          note: $("#debt-note").value,
          direction,
        }),
      "Đã lưu khoản nợ",
    );
}
function paymentsPage(root) {
  const workers = db.workers.filter(
    (w) => w.status === "ACTIVE" && unpaid(w.id) > 0,
  );
  root.innerHTML = `${pageHead("Thanh toán lương", "Thanh toán toàn bộ lương chưa trả của Kỹ sư. Tự chọn từng khoản nợ muốn trừ.")}<section class="card panel"><div class="panel-head"><div><h3>Chọn Kỹ sư</h3><div class="subhead">Mỗi giao dịch sẽ thanh toán toàn bộ đợt đang mở</div></div><span class="badge unpaid">${workers.length} chờ thanh toán</span></div><div class="table-wrap"><table><thead><tr><th>KỸ SƯ</th><th>ĐỢT</th><th>SỐ NGÀY</th><th>TỔNG LƯƠNG CHƯA TRẢ</th><th></th></tr></thead><tbody>${
    workers.length
      ? workers
          .map((w) => {
            const period = db.periods.find(
                (p) => p.workerId === w.id && p.status === "OPEN",
              ),
              dates = new Set(
                db.production
                  .filter((x) => x.workerId === w.id && x.status === "UNPAID")
                  .map((x) => x.date),
              );
            return `<tr><td>${person(w)}</td><td>${period ? fmtDate(period.startDate) + " – " + fmtDate(period.endDate) : "—"}</td><td>${dates.size}</td><td class="money">${money(unpaid(w.id))}</td><td><button class="btn primary small" data-pay="${w.id}">Thanh toán →</button></td></tr>`;
          })
          .join("")
      : '<tr><td colspan="5"><div class="empty"><div class="empty-icon">✓</div>Không có khoản lương nào đang chờ thanh toán.</div></td></tr>'
  }</tbody></table></div></section>`;
  root
    .querySelectorAll("[data-pay]")
    .forEach((b) => (b.onclick = () => paymentModal(b.dataset.pay)));
}
function paymentModal(workerId) {
  const w = db.workers.find((x) => x.id === workerId),
    rows = db.production.filter(
      (x) => x.workerId === workerId && x.status === "UNPAID",
    ),
    wage = rows.reduce((s, x) => s + Number(x.totalAmount), 0),
    debtsToDeduct = db.debts.filter(
      (x) => x.workerId === workerId && (x.direction || "WORKER_OWES") === "WORKER_OWES" && x.status === "CHUA_TRU",
    ),
    debtsToAdd = db.debts.filter(
      (x) => x.workerId === workerId && x.direction === "COMPANY_OWES" && x.status === "CHUA_TRA",
    );
  if (!wage) return toast("Không có lương cần thanh toán.", true);
  act(
    "Thanh toán lương",
    `Kỹ sư: ${esc(w.name)} · Đợt này sẽ được khóa sau khi xác nhận.`,
    `<div class="summary-box"><span>TIỀN LƯƠNG CHƯA TRẢ</span><b>${money(wage)}</b></div><div class="panel-head" style="margin:18px 0 8px"><div><h3>Nợ Kỹ sư cần trừ</h3><div class="subhead">Chọn khoản Kỹ sư đang nợ Công ty để khấu trừ.</div></div></div><div class="table-wrap"><table><thead><tr><th></th><th>NGÀY</th><th>GHI CHÚ</th><th>SỐ TIỀN</th></tr></thead><tbody>${debtsToDeduct.length ? debtsToDeduct.map((d) => `<tr><td><input class="debt-select" type="checkbox" value="${d.id}" data-direction="WORKER_OWES" data-amount="${d.amount}"></td><td>${fmtDate(d.date)}</td><td>${esc(d.note || "—")}</td><td class="money">${money(d.amount)}</td></tr>`).join("") : '<tr><td colspan="4" class="muted">Không có khoản Kỹ sư nợ cần trừ.</td></tr>'}</tbody></table></div><div class="panel-head" style="margin:18px 0 8px"><div><h3>Nợ Công ty cần cộng</h3><div class="subhead">Chọn khoản Công ty đang nợ Kỹ sư để cộng vào tiền thực nhận.</div></div></div><div class="table-wrap"><table><thead><tr><th></th><th>NGÀY</th><th>GHI CHÚ</th><th>SỐ TIỀN</th></tr></thead><tbody>${debtsToAdd.length ? debtsToAdd.map((d) => `<tr><td><input class="debt-select" type="checkbox" value="${d.id}" data-direction="COMPANY_OWES" data-amount="${d.amount}"></td><td>${fmtDate(d.date)}</td><td>${esc(d.note || "—")}</td><td class="money">${money(d.amount)}</td></tr>`).join("") : '<tr><td colspan="4" class="muted">Không có khoản Công ty nợ cần cộng.</td></tr>'}</tbody></table></div><div class="payment-summary"><div class="summary-box"><span>NỢ KỸ SƯ ĐƯỢC TRỪ</span><b id="deduct-total">0đ</b></div><div class="summary-box"><span>NỢ CÔNG TY ĐƯỢC CỘNG</span><b id="add-total">0đ</b></div><div class="summary-box highlight"><span>TIỀN THỰC NHẬN</span><b id="receive-total">${money(wage)}</b></div></div><div id="payment-warning"></div>`,
    `<button class="btn" data-close>Hủy</button><button class="btn primary" id="confirm-payment">Xác nhận thanh toán</button>`,
  );
  const recalc = () => {
    const checks = [...document.querySelectorAll(".debt-select:checked")],
      deduct = checks.filter((c) => c.dataset.direction === "WORKER_OWES").reduce((s, c) => s + Number(c.dataset.amount), 0),
      add = checks.filter((c) => c.dataset.direction === "COMPANY_OWES").reduce((s, c) => s + Number(c.dataset.amount), 0);
    $("#deduct-total").textContent = money(deduct);
    $("#add-total").textContent = money(add);
    $("#receive-total").textContent = money(wage - deduct + add);
    $("#payment-warning").innerHTML =
      deduct > wage
        ? '<div class="warning">Không thể thanh toán. Tổng nợ được chọn lớn hơn tiền lương. Vui lòng bỏ chọn một hoặc nhiều khoản nợ.</div>'
        : "";
    $("#confirm-payment").disabled = deduct > wage;
    $("#confirm-payment").style.opacity = deduct > wage ? ".5" : "1";
  };
  document
    .querySelectorAll(".debt-select")
    .forEach((c) => (c.onchange = recalc));
  $("#confirm-payment").onclick = () => {
    const debtIds = [...document.querySelectorAll(".debt-select:checked")].map(
        (x) => x.value,
      ),
      deduct = debtIds.reduce(
        (s, id) => s + Number(debtsToDeduct.find((d) => d.id === id)?.amount || 0),
        0,
      ),
      add = debtIds.reduce(
        (s, id) => s + Number(debtsToAdd.find((d) => d.id === id)?.amount || 0),
        0,
      );
    act(
      "Xác nhận thanh toán?",
      `${esc(w.name)} · ${fmtDate(today())}`,
      `<div class="detail-line"><span>Tổng tiền sản xuất</span><b>${money(wage)}</b></div><div class="detail-line"><span>Nợ Kỹ sư được trừ</span><b>− ${money(deduct)}</b></div><div class="detail-line"><span>Nợ Công ty được cộng</span><b>+ ${money(add)}</b></div><div class="detail-line"><b>Tiền thực nhận</b><b class="money">${money(wage - deduct + add)}</b></div><div class="notice" style="margin-top:14px">Sau xác nhận: đợt lương sẽ bị khóa; các khoản công nợ đã chọn được tất toán.</div>`,
      `<button class="btn" data-close>Quay lại</button><button class="btn primary" id="do-payment">Xác nhận thanh toán</button>`,
    );
    $("#do-payment").onclick = () =>
      run(
        () => api.pay({ workerId, date: today(), debtIds }),
        "Thanh toán thành công. Đợt đã khóa.",
      );
  };
}
function historyPage(root) {
  const rows = db.payments
    .slice()
    .sort((a, b) => b.paymentDate.localeCompare(a.paymentDate));
  root.innerHTML = `${pageHead("Lịch sử thanh toán", "Các đợt lương đã thanh toán và khóa. Chọn để xem chi tiết hoặc xuất Excel.")}<section class="card panel"><div class="panel-head"><h3>${rows.length} giao dịch</h3></div><div class="table-wrap"><table><thead><tr><th>NGÀY THANH TOÁN</th><th>MÃ GIAO DỊCH</th><th>Kỹ sư</th><th>TỔNG LƯƠNG</th><th>NỢ KỸ SƯ ĐÃ TRỪ</th><th>NỢ CÔNG TY ĐÃ CỘNG</th><th>THỰC NHẬN</th><th></th></tr></thead><tbody>${rows.length ? rows.map((x) => `<tr><td>${fmtDate(x.paymentDate)}</td><td class="muted">${esc(x.id)}</td><td>${esc(db.workers.find((w) => w.id === x.workerId)?.name || "—")}</td><td class="money">${money(x.productionTotal)}</td><td>${money(x.debtDeducted)}</td><td>${money(x.companyDebtAdded)}</td><td class="money">${money(x.actualReceived)}</td><td><button class="icon-btn" data-history="${x.id}">Chi tiết</button></td></tr>`).join("") : '<tr><td colspan="8"><div class="empty">Lịch sử thanh toán sẽ xuất hiện tại đây.</div></td></tr>'}</tbody></table></div></section>`;
  root
    .querySelectorAll("[data-history]")
    .forEach((b) => (b.onclick = () => paymentDetail(b.dataset.history)));
}
function paymentDetail(id) {
  const p = db.payments.find((x) => x.id === id),
    w = db.workers.find((x) => x.id === p.workerId),
    period = db.periods.find((x) => x.id === p.periodId),
    prods = db.production.filter((x) => x.periodId === p.periodId),
    debts = db.debts.filter((x) => x.paymentId === p.id);
  act(
    `Thanh toán ${esc(p.id)}`,
    `${esc(w?.name || "")} · ${fmtDate(p.paymentDate)} · Đợt ${fmtDate(period?.startDate)} – ${fmtDate(period?.endDate)}`,
    `<div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>SẢN PHẨM</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th></tr></thead><tbody>${prods.map((x) => `<tr><td>${fmtDate(x.date)}</td><td>${esc(x.productName)}</td><td>${x.quantity}</td><td>${money(x.unitPrice)}</td><td class="money">${money(x.totalAmount)}</td></tr>`).join("")}</tbody></table></div><div class="detail-line"><span>Tổng tiền sản xuất</span><b>${money(p.productionTotal)}</b></div><div class="detail-line"><span>Nợ Kỹ sư đã trừ ${debts.some((x) => (x.direction || "WORKER_OWES") === "WORKER_OWES") ? `(${debts.filter((x) => (x.direction || "WORKER_OWES") === "WORKER_OWES").map((x) => esc(x.note || money(x.amount))).join(", ")})` : ""}</span><b>− ${money(p.debtDeducted)}</b></div><div class="detail-line"><span>Nợ Công ty đã cộng ${debts.some((x) => x.direction === "COMPANY_OWES") ? `(${debts.filter((x) => x.direction === "COMPANY_OWES").map((x) => esc(x.note || money(x.amount))).join(", ")})` : ""}</span><b>+ ${money(p.companyDebtAdded)}</b></div><div class="detail-line"><b>Thực nhận</b><b class="money">${money(p.actualReceived)}</b></div>`,
    `<button class="btn" data-close>Đóng</button><button class="btn primary" id="export-payment">Xuất Excel</button>`,
  );
  $("#export-payment").onclick = () =>
    run(() => api.exportPayment(id), "Đã xuất file đợt lương");
}
function dayDetails(workerId, date) {
  const rows = db.production.filter(
      (x) => x.workerId === workerId && x.date === date,
    ),
    w = db.workers.find((x) => x.id === workerId);
  if (!rows.length) return;
  act(
    `${esc(w?.name || "")} · ${fmtDate(date)}`,
    rows[0].status === "PAID"
      ? "Đợt này đã khóa. Dữ liệu chỉ xem được."
      : "Sản lượng theo sản phẩm.",
    `<div class="table-wrap"><table><thead><tr><th>SẢN PHẨM</th><th>SỐ LƯỢNG</th><th>ĐƠN GIÁ</th><th>THÀNH TIỀN</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${esc(x.productName)}</td><td>${x.quantity}</td><td>${money(x.unitPrice)}</td><td class="money">${money(x.totalAmount)}</td></tr>`).join("")}</tbody></table></div><div class="detail-line"><b>Tổng ngày</b><b class="money">${money(rows.reduce((s, x) => s + Number(x.totalAmount), 0))}</b></div>`,
    rows[0].status === "UNPAID"
      ? `<button class="btn" data-close>Đóng</button><button class="btn danger" id="delete-day">Xóa ngày</button><button class="btn primary" id="edit-day">Sửa sản lượng</button>`
      : `<button class="btn" data-close>Đóng</button>`,
  );
  $("#edit-day")?.addEventListener("click", () => {
    const quantities = Object.fromEntries(
      rows.map((x) => [x.productId, x.quantity]),
    );
    prodWorker = workerId;
    prodDate = date;
    $("#modal-root").innerHTML = "";
    navTo("production");
    document.querySelectorAll("tr[data-product]").forEach((r) => {
      const old = rows.find((x) => x.productId === r.dataset.product);
      if (old) {
        r.querySelector(".quantity").value = old.quantity;
        r.dataset.price = old.unitPrice;
        r.children[1].textContent = money(old.unitPrice);
      }
    });
    calcProduction();
  });
  $("#delete-day")?.addEventListener("click", () => {
    act(
      "Xóa sản lượng ngày?",
      `Xóa toàn bộ sản lượng của ${esc(w?.name || "")} ngày ${fmtDate(date)}?`,
      `<div class="notice">Thao tác này chỉ áp dụng cho dữ liệu chưa thanh toán. Đợt lương có thể tiếp tục được cập nhật.</div>`,
      `${cancel}<button class="btn danger" id="confirm-day-delete">Xóa dữ liệu ngày</button>`,
    );
    $("#confirm-day-delete").onclick = () =>
      run(
        () => api.deleteProduction({ workerId, date }),
        "Đã xóa sản lượng ngày",
      );
  });
}
function productionPageWithLedger(root) {
  productionPageBase(root);
  const products = db.products.filter((p) => p.status === "ACTIVE"),
    rows = db.production.slice().sort((a, b) => b.date.localeCompare(a.date));
  const ledger = document.createElement("section");
  ledger.className = "card panel";
  ledger.style.marginTop = "16px";
  ledger.innerHTML = `<div class="panel-head"><div><h3>Lịch sử sản lượng</h3><div class="subhead">Sửa hoặc xóa dữ liệu chưa thanh toán. Đợt đã thanh toán chỉ xem được.</div></div></div><div class="filter-row" style="margin-bottom:13px"><input class="search" id="prod-search" placeholder="⌕ Tìm kỹ sư" style="min-width:160px"><input id="prod-filter-date" type="date" aria-label="Lọc ngày"><input id="prod-filter-month" type="month" aria-label="Lọc tháng"><input id="prod-filter-year" type="number" placeholder="Năm" min="2000" max="2100" style="width:90px"><select id="prod-filter-status"><option value="ALL">Mọi trạng thái</option><option value="UNPAID">Chưa thanh toán</option><option value="PAID">Đã thanh toán</option></select></div><div class="table-wrap"><table><thead><tr><th>NGÀY</th><th>Kỹ sư</th><th>SẢN PHẨM</th><th>TỔNG TIỀN</th><th>TRẠNG THÁI</th><th></th></tr></thead><tbody id="prod-ledger"></tbody></table></div>`;
  root.append(ledger);
  const draw = () => {
    const name = $("#prod-search").value.toLowerCase(),
      day = $("#prod-filter-date").value,
      month = $("#prod-filter-month").value,
      year = $("#prod-filter-year").value,
      status = $("#prod-filter-status").value;
    const daily = {};
    rows.forEach((x) => {
      const w = db.workers.find((y) => y.id === x.workerId),
        key = x.workerId + "|" + x.date;
      if (w && !w.name.toLowerCase().includes(name) && name) return;
      if (day && x.date !== day) return;
      if (month && !x.date.startsWith(month)) return;
      if (year && !x.date.startsWith(year)) return;
      if (status !== "ALL" && x.status !== status) return;
      if (!daily[key])
        daily[key] = {
          workerId: x.workerId,
          date: x.date,
          total: 0,
          status: x.status,
          names: [],
        };
      daily[key].total += Number(x.totalAmount);
      daily[key].names.push(x.productName);
    });
    const vals = Object.values(daily);
    $("#prod-ledger").innerHTML = vals.length
      ? vals
          .map(
            (x) =>
              `<tr><td>${fmtDate(x.date)}</td><td>${esc(db.workers.find((w) => w.id === x.workerId)?.name || "—")}</td><td>${esc([...new Set(x.names)].join(", "))}</td><td class="money">${money(x.total)}</td><td><span class="badge ${x.status === "PAID" ? "paid" : "unpaid"}">${x.status === "PAID" ? "Đã thanh toán" : "Chưa thanh toán"}</span></td><td><button class="icon-btn" data-day="${x.workerId}" data-date="${x.date}">Chi tiết</button></td></tr>`,
          )
          .join("")
      : '<tr><td colspan="6"><div class="empty">Không có dữ liệu sản lượng phù hợp.</div></td></tr>';
    $("#prod-ledger")
      .querySelectorAll("[data-day]")
      .forEach(
        (b) => (b.onclick = () => dayDetails(b.dataset.day, b.dataset.date)),
      );
  };
  [
    "prod-search",
    "prod-filter-date",
    "prod-filter-month",
    "prod-filter-year",
    "prod-filter-status",
  ].forEach((id) =>
    $("#" + id).addEventListener(
      id === "prod-search" ? "input" : "change",
      draw,
    ),
  );
  draw();
}
const productionPageBase = productionPage;
productionPage = productionPageWithLedger;
function setTodayLabel() {
  $("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
    .format(new Date())
    .toLocaleUpperCase("vi-VN");
}
document.addEventListener("click", (e) => {
  const nav = e.target.closest(".nav[data-page]");
  if (nav) {
    navTo(nav.dataset.page);
    return;
  }
  const go = e.target.closest("[data-go]");
  if (go) navTo(go.dataset.go);
});
$("#open-folder").onclick = () => api.openFolder();
window.addEventListener("error", (e) => {
  const status = $("#app-status");
  if (status) status.textContent = "Lỗi giao diện";
  toast(`Lỗi giao diện: ${e.message}`, true);
});
window.addEventListener("unhandledrejection", (e) => {
  const status = $("#app-status");
  if (status) status.textContent = "Lỗi xử lý";
  toast(`Lỗi xử lý: ${e.reason?.message || e.reason}`, true);
});
setTodayLabel();
render();
$("#app-status").textContent = "Giao diện sẵn sàng";
reload().catch((e) => toast(e.message, true));
