// ════════════════════════════════════════════════
//  GỬI ĐƠN → GOOGLE SHEET + EMAIL
//  Dán URL Web App của Google Apps Script vào đây
//  (Xem hướng dẫn deploy ở cuối file này).
// ════════════════════════════════════════════════
const BOOKING_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyFsAgdlmNgww65Dtc-CplQo31CtrOxZ-wzA_cGNMpxCgs3MPAqL5MwHIUVsTIuPAo/exec';

function sendBooking(data) {
  data.thoiGian = new Date().toLocaleString('vi-VN');
  data.trang = 'anbinhtour.web';
  if (!BOOKING_ENDPOINT || BOOKING_ENDPOINT.indexOf('http') !== 0) {
    console.warn('[An Bình] Chưa cấu hình BOOKING_ENDPOINT — đơn chưa được gửi đi.');
    return;
  }
  // no-cors: không đọc được phản hồi nhưng dữ liệu vẫn tới Apps Script
  fetch(BOOKING_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(data),
  }).catch(err => console.warn('[An Bình] Lỗi gửi đơn:', err));
}

// ════════════════════════════════════════════════
//  ADMIN — bảng điều khiển đơn (đọc JSON từ Apps Script)
// ════════════════════════════════════════════════
const ADMIN_PASSWORD = 'Anbinh8386';                                  // đổi mật khẩu tại đây
const ADMIN_SECRET   = 'anbinh-key-2026';                             // phải trùng SECRET trong Apps Script
const ADMIN_SHEET_ID = '1NDR3RmTNcUtGmvX_2yssQOkRIDdlH4j7GYy7LTQm8qA';
const ADMIN_SHEET_EDIT = 'https://docs.google.com/spreadsheets/d/' + ADMIN_SHEET_ID + '/edit';

let ADMIN_DATA = [];

function openAdmin() {
  const modal = document.getElementById('adminModal');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (sessionStorage.getItem('ab_admin') === '1') showDash();
  else showLogin();
}
function closeAdmin() {
  document.getElementById('adminModal').classList.remove('open');
  document.body.style.overflow = '';
}
function handleAdminClick(e) {
  if (e.target === document.getElementById('adminModal')) closeAdmin();
}
function showLogin() {
  document.getElementById('adminLoginWrap').style.display = '';
  document.getElementById('adminDashWrap').style.display = 'none';
  document.getElementById('adminTitle').textContent = 'Đăng nhập quản trị';
  document.getElementById('adminSub').textContent = 'Khu vực dành cho quản trị viên An Bình';
  document.getElementById('admin-err').classList.remove('show');
  document.getElementById('admin-pass').value = '';
  setTimeout(() => document.getElementById('admin-pass').focus(), 100);
}
function showDash() {
  document.getElementById('adminLoginWrap').style.display = 'none';
  document.getElementById('adminDashWrap').style.display = '';
  document.getElementById('adminTitle').textContent = 'Bảng điều khiển đơn đặt xe';
  document.getElementById('adminSub').textContent = 'Danh sách đơn • cập nhật trực tiếp';
  document.getElementById('admin-open-sheet').href = ADMIN_SHEET_EDIT;
  loadBookings();
}
function logoutAdmin() {
  sessionStorage.removeItem('ab_admin');
  showLogin();
}
document.getElementById('adminLoginForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const pass = document.getElementById('admin-pass').value;
  if (pass === ADMIN_PASSWORD) {
    sessionStorage.setItem('ab_admin', '1');
    showDash();
  } else {
    document.getElementById('admin-err').classList.add('show');
    document.getElementById('admin-pass').select();
  }
});

// ── Tải & hiển thị đơn ──────────────────────────
function setAdminState(html) { document.getElementById('admin-state').innerHTML = html; }

function loadBookings() {
  const stateEl = document.getElementById('admin-state');
  const listEl  = document.getElementById('admin-list');
  listEl.innerHTML = '';
  document.getElementById('admin-stats').style.display = 'none';
  document.getElementById('admin-search-row').style.display = 'none';

  if (!BOOKING_ENDPOINT || BOOKING_ENDPOINT.indexOf('http') !== 0) {
    setAdminState('<div class="admin-empty"><div class="admin-empty-ico">⚙️</div><p><b>Chưa kết nối dữ liệu.</b><br>Hãy hoàn tất cài đặt Apps Script (xem file <code>HUONG-DAN-NHAN-DON.md</code>) rồi dán URL vào <code>BOOKING_ENDPOINT</code>.</p></div>');
    return;
  }

  setAdminState('<div class="admin-loading"><span class="admin-spinner"></span> Đang tải danh sách đơn…</div>');
  const url = BOOKING_ENDPOINT + (BOOKING_ENDPOINT.indexOf('?') > -1 ? '&' : '?') + 'key=' + encodeURIComponent(ADMIN_SECRET) + '&t=' + Date.now();

  fetch(url, { method: 'GET' })
    .then(r => r.json())
    .then(res => {
      if (!res || res.ok === false) throw new Error(res && res.error ? res.error : 'unauthorized');
      ADMIN_DATA = (res.rows || []).slice().reverse();   // mới nhất lên đầu
      document.getElementById('admin-stats').style.display = '';
      document.getElementById('admin-search-row').style.display = ADMIN_DATA.length ? '' : 'none';
      renderStats(ADMIN_DATA);
      applyAdminFilter();
    })
    .catch(err => {
      console.warn('[An Bình] Lỗi tải đơn:', err);
      setAdminState('<div class="admin-empty"><div class="admin-empty-ico">⚠️</div><p><b>Không tải được danh sách đơn.</b><br>Kiểm tra: (1) đã deploy bản Apps Script mới có <code>doGet</code>; (2) <code>SECRET</code> khớp; (3) quyền truy cập "Anyone".<br>Tạm thời bấm <b>Mở bảng tính đầy đủ</b> để xem trực tiếp.</p></div>');
    });
}

function isToday(d) {
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}
function parseVnDate(s) {
  // "dd/mm/yyyy hh:mm:ss" hoặc ISO
  if (!s) return null;
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})[,\s]+(\d{1,2}):(\d{2})/);
  if (m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]);
  const d = new Date(s); return isNaN(d) ? null : d;
}
function renderStats(rows) {
  const total = rows.length;
  const today = rows.filter(r => { const d = parseVnDate(r.thoiGian); return d && isToday(d); }).length;
  const routes = {};
  rows.forEach(r => { const t = (r.tuyen || '').trim(); if (t) routes[t] = (routes[t]||0)+1; });
  let topRoute = '—', topN = 0;
  Object.keys(routes).forEach(k => { if (routes[k] > topN) { topN = routes[k]; topRoute = k; } });
  document.getElementById('admin-stats').innerHTML =
    statCard(total, 'Tổng số đơn') +
    statCard(today, 'Đơn hôm nay') +
    '<div class="admin-stat"><div class="admin-stat-val" style="font-size:18px;line-height:1.3">' + esc(topRoute) + '</div><div class="admin-stat-lab">Tuyến nhiều nhất' + (topN?' ('+topN+')':'') + '</div></div>';
}
function statCard(v, l) {
  return '<div class="admin-stat"><div class="admin-stat-val">' + v + '</div><div class="admin-stat-lab">' + l + '</div></div>';
}

function applyAdminFilter() {
  const q = (document.getElementById('admin-search').value || '').toLowerCase().trim();
  const rows = q ? ADMIN_DATA.filter(r => JSON.stringify(r).toLowerCase().includes(q)) : ADMIN_DATA;
  renderList(rows);
}

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function telDigits(p) { return String(p || '').replace(/[^0-9+]/g, ''); }
function dash(v) { const s = String(v == null ? '' : v).trim(); return s && !/^\(ch/.test(s) ? s : ''; }

function renderList(rows) {
  const listEl = document.getElementById('admin-list');
  if (!ADMIN_DATA.length) {
    setAdminState('<div class="admin-empty"><div class="admin-empty-ico">📭</div><p><b>Chưa có đơn nào.</b><br>Đơn khách gửi từ website sẽ hiện ở đây theo thời gian thực.</p></div>');
    listEl.innerHTML = '';
    return;
  }
  if (!rows.length) { setAdminState('<div class="admin-empty"><div class="admin-empty-ico">🔍</div><p>Không có đơn khớp từ khóa tìm kiếm.</p></div>'); listEl.innerHTML=''; return; }
  setAdminState('');
  listEl.innerHTML = rows.map(cardHtml).join('');
}

function cardHtml(r) {
  const name = dash(r.hoTen) || 'Khách chưa nêu tên';
  const phone = dash(r.soDienThoai);
  const tel = telDigits(phone);
  const meta = [
    r.dichVu && dash(r.dichVu) ? ['Dịch vụ', r.dichVu] : null,
    (dash(r.ngayDi) || dash(r.gioDi)) ? ['Đi lúc', [dash(r.ngayDi), dash(r.gioDi)].filter(Boolean).join(' · ')] : null,
    dash(r.soLuong) ? ['Số người/kiện', r.soLuong] : null,
    dash(r.diemDon) ? ['Điểm đón', r.diemDon] : null,
    dash(r.diemTra) ? ['Điểm trả', r.diemTra] : null,
  ].filter(Boolean);
  const note = dash(r.ghiChu);
  const source = dash(r.nguon);
  return '' +
  '<div class="ord-card">' +
    '<div class="ord-top">' +
      '<div class="ord-cust">' +
        '<div class="ord-name">' + esc(name) + (source ? '<span class="ord-src">'+esc(source)+'</span>' : '') + '</div>' +
        (phone ? '<a class="ord-phone" href="tel:'+esc(tel)+'">'+esc(phone)+'</a>' : '<span class="ord-phone muted">Không có SĐT</span>') +
      '</div>' +
      '<div class="ord-time">' + esc(dash(r.thoiGian)) + '</div>' +
    '</div>' +
    (dash(r.tuyen) ? '<div class="ord-route">🛣️ ' + esc(r.tuyen) + '</div>' : '') +
    (meta.length ? '<div class="ord-meta">' + meta.map(m => '<div class="ord-meta-i"><span>'+esc(m[0])+'</span><b>'+esc(m[1])+'</b></div>').join('') + '</div>' : '') +
    (note ? '<div class="ord-note">📝 ' + esc(note) + '</div>' : '') +
    '<div class="ord-actions">' +
      (tel ? '<a class="ord-btn call" href="tel:'+esc(tel)+'">📞 Gọi</a>' +
             '<a class="ord-btn zalo" href="https://zalo.me/'+esc(tel)+'" target="_blank" rel="noopener">💬 Zalo</a>' : '') +
      '<button class="ord-btn copy" onclick=\'copyOrder(this)\' data-order="'+esc(JSON.stringify(r)).replace(/'/g,"&#39;")+'">📋 Copy</button>' +
    '</div>' +
  '</div>';
}

function copyOrder(btn) {
  let r; try { r = JSON.parse(btn.getAttribute('data-order')); } catch(e){ return; }
  const txt = 'ĐƠN ĐẶT XE AN BÌNH\n' +
    'Khách: ' + (dash(r.hoTen)||'—') + '\nSĐT: ' + (dash(r.soDienThoai)||'—') +
    '\nTuyến: ' + (dash(r.tuyen)||'—') + '\nDịch vụ: ' + (dash(r.dichVu)||'—') +
    '\nĐi lúc: ' + [dash(r.ngayDi), dash(r.gioDi)].filter(Boolean).join(' ') +
    '\nSố người/kiện: ' + (dash(r.soLuong)||'—') +
    '\nĐiểm đón: ' + (dash(r.diemDon)||'—') + '\nĐiểm trả: ' + (dash(r.diemTra)||'—') +
    (dash(r.ghiChu) ? '\nGhi chú: ' + r.ghiChu : '') +
    '\nGửi lúc: ' + (dash(r.thoiGian)||'—');
  if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => {
    const old = btn.textContent; btn.textContent = '✓ Đã copy';
    setTimeout(() => btn.textContent = old, 1400);
  }).catch(()=>{});
}

document.addEventListener('input', e => { if (e.target && e.target.id === 'admin-search') applyAdminFilter(); });

// ── Scroll Reveal ──────────────────────────────
const revealObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('vis'); revealObs.unobserve(e.target); }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -48px 0px' });
document.querySelectorAll('.sr').forEach(el => revealObs.observe(el));

window.addEventListener('load', () => {
  document.querySelectorAll('.hero .sr').forEach((el, i) => {
    setTimeout(() => el.classList.add('vis'), 80 + i * 130);
  });
});

// ── Count-up ───────────────────────────────────
function countUp(el, end, ms = 1400) {
  let frame = 0;
  const total = Math.round(ms / 16);
  const timer = setInterval(() => {
    frame++;
    const val = Math.round(end * (frame / total));
    el.textContent = (frame >= total ? end : val) + '+';
    if (frame >= total) clearInterval(timer);
  }, 16);
}
const countObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting && e.target.dataset.count) {
      countUp(e.target, +e.target.dataset.count);
      countObs.unobserve(e.target);
    }
  });
}, { threshold: 0.5 });
document.querySelectorAll('[data-count]').forEach(el => countObs.observe(el));

// ── Nav ────────────────────────────────────────
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('solid', window.scrollY > 50);
}, { passive: true });

// ── Mobile Menu ────────────────────────────────
const burger = document.getElementById('burger');
const mobMenu = document.getElementById('mobMenu');
burger.addEventListener('click', () => {
  burger.classList.toggle('open');
  mobMenu.classList.toggle('open');
  document.body.style.overflow = mobMenu.classList.contains('open') ? 'hidden' : '';
});
document.querySelectorAll('.mob-link').forEach(l => {
  l.addEventListener('click', () => {
    burger.classList.remove('open');
    mobMenu.classList.remove('open');
    document.body.style.overflow = '';
  });
});

// ── Smooth Scroll ─────────────────────────────
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const t = document.querySelector(href);
    if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); }
  });
});

// ── Schedule ──────────────────────────────────
const sched = {
  tn: { times: ['05:30','06:00','06:30','07:00','07:30','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'], note: 'Từ HN' },
  yb: { times: ['05:00','06:00','07:00','08:00','09:00','10:30','12:00','13:30','15:00','16:30'], note: 'Từ HN' },
  lc: { times: ['05:00','06:00','07:00','08:30','10:00','12:00','14:00','16:00','18:00','20:30','22:00'], note: 'Từ HN' },
  sp: { times: ['05:00','06:00','07:30','09:00','11:00','13:00','15:00','17:00','20:00','22:00'], note: 'Qua LC' },
};
function renderSched(r) {
  const g = document.getElementById('schedGrid');
  const { times, note } = sched[r];
  g.innerHTML = times.map(t =>
    `<div class="time-card"><div class="time-val">${t}</div><div class="time-note">${note}</div></div>`
  ).join('');
}
renderSched('tn');
document.querySelectorAll('.sched-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sched-tab').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
    renderSched(btn.dataset.r);
  });
});

// ── Modal ─────────────────────────────────────
function openModal(prefillType, prefillValue) {
  const modal = document.getElementById('bookingModal');
  document.getElementById('modalFormWrap').style.display = '';
  document.getElementById('modalSuccess').classList.remove('show');
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  if (prefillType === 'route' && prefillValue) {
    const sel = document.getElementById('m-route');
    for (let o of sel.options) { if (o.value === prefillValue) { sel.value = prefillValue; break; } }
  }
  if (prefillType === 'service' && prefillValue) {
    const sel = document.getElementById('m-service');
    for (let o of sel.options) { if (o.value === prefillValue) { sel.value = prefillValue; break; } }
  }
}
function closeModal() {
  document.getElementById('bookingModal').classList.remove('open');
  document.body.style.overflow = '';
}
function handleModalClick(e) {
  if (e.target === document.getElementById('bookingModal')) closeModal();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeAdmin(); } });

function validatePhone(val) { return /^(0|\+84)[0-9]{8,10}$/.test(val.replace(/\s/g, '')); }

function setFieldErr(id, errId, show) {
  const el = document.getElementById(id);
  const err = document.getElementById(errId);
  if (show) { el.classList.add('err'); err.classList.add('show'); }
  else { el.classList.remove('err'); err.classList.remove('show'); }
}

function submitModal() {
  const phone = document.getElementById('m-phone').value.trim();
  const route = document.getElementById('m-route').value;
  let valid = true;
  if (!validatePhone(phone)) { setFieldErr('m-phone','m-phone-err',true); valid = false; } else { setFieldErr('m-phone','m-phone-err',false); }
  if (!route) { setFieldErr('m-route','m-route-err',true); valid = false; } else { setFieldErr('m-route','m-route-err',false); }
  if (!valid) return;

  const name    = document.getElementById('m-name').value.trim() || '(chưa cung cấp)';
  const service = document.getElementById('m-service').value || '(chưa chọn)';
  const date    = document.getElementById('m-date').value || '(chưa chọn)';
  const time    = document.getElementById('m-time').value || '(chưa chọn)';
  const qty     = document.getElementById('m-qty').value.trim() || '(chưa điền)';
  const pickup  = document.getElementById('m-pickup').value.trim() || '(chưa điền)';
  const dropoff = document.getElementById('m-dropoff').value.trim() || '(chưa điền)';
  const note    = document.getElementById('m-note').value.trim() || '';

  const msg = `Em muốn đặt dịch vụ Vận Tải 360 An Bình.\nTên: ${name}. Tuyến: ${route}. Dịch vụ: ${service}.\nNgày đi: ${date}. Giờ đi: ${time}.\nSố người/kiện: ${qty}. Điểm đón: ${pickup}. Điểm trả: ${dropoff}.\nSĐT: ${phone}.${note ? ' Ghi chú: ' + note : ''}`;

  sendBooking({
    nguon: 'Popup đặt chuyến',
    hoTen: name, soDienThoai: phone, tuyen: route, dichVu: service,
    ngayDi: date, gioDi: time, soLuong: qty,
    diemDon: pickup, diemTra: dropoff, ghiChu: note,
  });

  if (navigator.clipboard) navigator.clipboard.writeText(msg).catch(() => {});
  document.getElementById('modalSuccessMsg').textContent = `Cảm ơn ${name !== '(chưa cung cấp)' ? name : 'bạn'}! Chúng tôi sẽ liên hệ số ${phone} để xác nhận chuyến ${route} sớm nhất.`;
  document.getElementById('modalFormWrap').style.display = 'none';
  document.getElementById('modalSuccess').classList.add('show');
}

// ── Contact Form ──────────────────────────────
document.getElementById('contactForm').addEventListener('submit', function(e) {
  e.preventDefault();
  const phone = document.getElementById('c-phone').value.trim();
  const route = document.getElementById('c-route').value;
  let valid = true;
  if (!validatePhone(phone)) { setFieldErr('c-phone','c-phone-err',true); valid = false; } else { setFieldErr('c-phone','c-phone-err',false); }
  if (!route) { setFieldErr('c-route','c-route-err',true); valid = false; } else { setFieldErr('c-route','c-route-err',false); }
  if (!valid) { document.getElementById('c-phone').focus(); return; }

  const g = id => (document.getElementById(id) ? document.getElementById(id).value.trim() : '');
  sendBooking({
    nguon: 'Form liên hệ',
    hoTen: g('c-name'), soDienThoai: phone, tuyen: route,
    dichVu: g('c-service'), ngayDi: g('c-date'), gioDi: g('c-time'),
    soLuong: g('c-qty'), diemDon: g('c-pickup'), diemTra: g('c-dropoff'),
    ghiChu: g('c-note'),
  });

  document.getElementById('contactForm').style.display = 'none';
  document.getElementById('contactSuccess').classList.add('show');
  setTimeout(() => { window.location = 'tel:0985212421'; }, 400);
});
