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

// Gửi bản ghi social proof ĐÃ ẨN DANH tới serverless function (/api/social-proof).
// Chỉ gửi: danh xưng + TÊN GỌI + tuyến + cờ đồng ý. KHÔNG SĐT/địa chỉ.
function sendSocialProof(title, fullName, route, allow) {
  try {
    const givenName = String(fullName || '').trim().split(/\s+/).pop() || '';
    fetch('/api/social-proof', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title || '', givenName: givenName, route: route, allow: allow === true }),
    }).catch(function () { /* chưa deploy Vercel/Supabase → bỏ qua êm */ });
  } catch (e) { /* không được phép chặn luồng đặt xe */ }
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
const hourly = (a, b) => { const r = []; for (let h = a; h <= b; h++) r.push((h < 10 ? '0' + h : h) + ':00'); return r; };
const sched = {
  tn: { dest: 'Thái Nguyên', out: hourly(6, 21), back: hourly(5, 21), backLabel: 'Thái Nguyên' },
  yb: { dest: 'Yên Bái', out: hourly(6, 21), back: hourly(4, 21), backLabel: 'Yên Bái' },
  lc: { dest: 'Lào Cai', out: hourly(6, 21), back: hourly(4, 21), backLabel: 'Lào Cai' },
  sp: { dest: 'Sa Pa', out: hourly(6, 21), back: hourly(5, 21), backLabel: 'Sa Pa', via: true },
};
let schedCur = 'tn', schedDir = 0;   // 0 = từ Hà Nội, 1 = chiều về
const SCHED_GROUPS = [
  { key: 'sang',  label: 'Sáng',  ico: '<svg class="ic" viewBox="0 0 24 24"><path d="M17 18a5 5 0 0 0-10 0"/><line x1="12" y1="2" x2="12" y2="9"/><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/><line x1="1" y1="18" x2="3" y2="18"/><line x1="21" y1="18" x2="23" y2="18"/><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/><line x1="23" y1="22" x2="1" y2="22"/><polyline points="8 6 12 2 16 6"/></svg>', from: 0, to: 720 },
  { key: 'chieu', label: 'Chiều', ico: '<svg class="ic" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/></svg>', from: 720, to: 1080 },
  { key: 'toi',   label: 'Tối',   ico: '<svg class="ic" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>', from: 1080, to: 1440 },
];
const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function setSchedDir(d) { schedDir = d; renderSched(schedCur); }

function renderSched(r) {
  schedCur = r;
  const g = document.getElementById('schedGrid');
  const cfg = sched[r];
  const times = schedDir === 0 ? cfg.out : cfg.back;
  const origin = schedDir === 0 ? 'Hà Nội' : cfg.dest;
  const target = schedDir === 0 ? cfg.dest : 'Hà Nội';

  // nút chọn chiều
  const dirEl = document.getElementById('schedDir');
  if (dirEl) {
    dirEl.innerHTML =
      '<button type="button" class="sched-dir-btn' + (schedDir === 0 ? ' on' : '') + '" onclick="setSchedDir(0)">Hà Nội → ' + cfg.dest + '</button>' +
      '<button type="button" class="sched-dir-btn' + (schedDir === 1 ? ' on' : '') + '" onclick="setSchedDir(1)">' + cfg.dest + ' → Hà Nội</button>';
  }

  // chuyến sắp chạy tiếp theo (theo giờ hiện tại)
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let nextIdx = times.findIndex(t => toMin(t) >= nowMin);
  let nextBadge;
  if (nextIdx === -1) nextBadge = 'Hết chuyến hôm nay';
  else { const dm = toMin(times[nextIdx]) - nowMin; nextBadge = dm <= 1 ? 'Đang khởi hành' : (dm < 60 ? 'Chuyến tới sau ' + dm + '′' : 'Chuyến tới ' + times[nextIdx]); }

  // tuyến header
  const routeEl = document.getElementById('schedRoute');
  if (routeEl) {
    const via = cfg.via ? '<span class="sched-via">Qua Lào Cai</span>' : '';
    routeEl.innerHTML =
      '<svg class="ic sched-route-ico" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>' +
      '<span class="sched-route-end">' + origin + '</span>' +
      '<span class="sched-route-line"></span>' +
      '<span class="sched-route-end">' + target + '</span>' + via +
      '<span class="sched-count">' + nextBadge + '</span>';
  }

  // nhóm theo buổi
  let html = '';
  SCHED_GROUPS.forEach(gr => {
    const items = times.map((t, i) => ({ t, i })).filter(x => { const m = toMin(x.t); return m >= gr.from && m < gr.to; });
    if (!items.length) return;
    html += '<div class="sched-group">';
    html += '<div class="sched-group-h"><span class="sg-ico">' + gr.ico + '</span>' + gr.label + '<span class="dash"></span></div>';
    html += '<div class="sched-grid">';
    html += items.map(x => {
      const isNext = x.i === nextIdx;
      return '<div class="time-card' + (isNext ? ' next' : '') + '">' +
        (isNext ? '<span class="time-next-tag"><span class="d"></span>Sắp chạy</span>' : '') +
        '<div class="time-val">' + x.t + '</div></div>';
    }).join('');
    html += '</div></div>';
  });
  g.innerHTML = html;
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

  const mTitleEl = document.getElementById('m-title');
  const mAllowEl = document.getElementById('m-allowsp');
  sendSocialProof(mTitleEl ? mTitleEl.value : '', name === '(chưa cung cấp)' ? '' : name, route, !!(mAllowEl && mAllowEl.checked));

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

  const cAllowEl = document.getElementById('c-allowsp');
  sendSocialProof(g('c-title'), g('c-name'), route, !!(cAllowEl && cAllowEl.checked));

  document.getElementById('contactForm').style.display = 'none';
  document.getElementById('contactSuccess').classList.add('show');
  setTimeout(() => { window.location = 'tel:0985212421'; }, 400);
});

// ════════════════════════════════════════════════
//  SOCIAL PROOF POPUP — thời gian gần thực (Supabase)
//  Loại A: đơn THẬT từ bảng social_proof (đã ẩn danh, RLS chỉ-đọc).
//  Loại B: nội dung dự phòng TRUNG THỰC (tuyến phổ biến) — không
//          bao giờ mô tả là "vừa đặt xe".
//  Realtime: Supabase Realtime; mất realtime → polling 30 giây.
//  Không cấu hình Supabase → chỉ hiện loại B, không giả mạo đơn.
// ════════════════════════════════════════════════
(function () {
  // ⚙️ CỜ XEM THỬ GIAO DIỆN (chỉ để preview trên máy, KHÔNG bật trên bản thật):
  //    true  = nạp 50 khách MẪU để xem popup trông thế nào (dữ liệu bịa).
  //    false = bản chính thức: chỉ đơn thật đã đồng ý + thông báo nền trung thực.
  const SP_USE_MOCK = false;

  const MAX = 300;                   // gần như liên tục trong suốt phiên
  const FIRST_MIN = 2000, FIRST_MAX = 5000;     // popup đầu sau 2–5s
  const VISIBLE = 7000;              // mỗi popup hiện 7s
  const GAP_MIN = 7000, GAP_MAX = 9000;         // liên tục mỗi 7–9s
  const NEW_DELAY_MIN = 3000, NEW_DELAY_MAX = 5000; // đơn thật hiện sau 3–5s
  const PRIORITY_WINDOW = 120000;    // ưu tiên đơn thật trong 2 phút
  const MAX_AGE_MS = 24 * 3600 * 1000; // chỉ hiện đơn thật ≤ 24 giờ
  const POLL_MIN = 60000, POLL_MAX = 90000;     // polling dự phòng 60–90s (chỉ khi mất realtime)
  const SS_SHOWN = 'ab_sp_shown_v2', SS_SHOWN_FB = 'ab_sp_shown_fb_v2', SS_CLOSED = 'ab_sp_closed_v2';

  if (sessionStorage.getItem(SS_CLOSED) === '1') return;

  // ── Loại B: thông báo nền TRUNG THỰC (tình trạng tuyến / lịch xe / mức độ quan tâm).
  //    Không giả danh khách cụ thể. “region” chỉ dùng để tránh trùng địa phương liên tiếp.
  const ICO_VAN = '<svg class="ic" viewBox="0 0 24 24"><path d="M10 17h4V5H2v12h3"/><path d="M14 9h4l3 3v5h-3"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>';
  const ICO_CAL = '<svg class="ic" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
  const ICO_PIN = '<svg class="ic" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const ICO_CAR = '<svg class="ic" viewBox="0 0 24 24"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>';
  const ICO_PHONE = '<svg class="ic" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
  const ICO_CHECK = '<svg class="ic" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>';
  const FALLBACK = [
    { id: 'fb1', icon: ICO_VAN, html: 'Tuyến <span class="sp-loc">Lào Cai – Hà Nội</span> đang được nhiều khách quan tâm hôm nay', sub: 'Tình trạng tuyến', region: 'Lào Cai' },
    { id: 'fb2', icon: ICO_CAL, html: 'An Bình đang nhận lịch tuyến <span class="sp-loc">Thái Nguyên – Hà Nội</span>', sub: 'Nhận lịch trong ngày', region: 'Thái Nguyên' },
    { id: 'fb3', icon: ICO_VAN, html: 'Tuyến <span class="sp-loc">Yên Bái – Lào Cai</span> đang còn lịch trong ngày', sub: 'Còn lịch hôm nay', region: 'Yên Bái' },
    { id: 'fb4', icon: ICO_PIN, html: 'Nhiều khách đang xem lịch xe đi <span class="sp-loc">Sa Pa</span>', sub: 'Được quan tâm', region: 'Sa Pa' },
    { id: 'fb5', icon: ICO_CAR, html: 'Dịch vụ <span class="sp-loc">đón tận nơi</span> đang được khách hàng quan tâm', sub: 'Được quan tâm', region: 'đón tận nơi' },
    { id: 'fb6', icon: ICO_PHONE, html: 'An Bình đang hỗ trợ <span class="sp-loc">kiểm tra lịch xe nhanh</span> qua hotline', sub: 'Hỗ trợ nhanh', region: 'hotline' },
    { id: 'fb7', icon: ICO_VAN, html: 'Tuyến <span class="sp-loc">Hà Nội – Lào Cai</span> đang có lượt kiểm tra lịch mới', sub: 'Lượt kiểm tra mới', region: 'Hà Nội' },
    { id: 'fb8', icon: ICO_CAL, html: 'Hôm nay có nhiều khách quan tâm <span class="sp-loc">dịch vụ xe hợp đồng</span>', sub: 'Được quan tâm', region: 'xe hợp đồng' },
  ];

  const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
  const randBetween = (a, b) => a + Math.random() * (b - a);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ssGet = k => { try { return JSON.parse(sessionStorage.getItem(k) || '[]'); } catch (e) { return []; } };

  function relTime(iso) {
    if (!iso) return '';
    const d = new Date(iso); if (isNaN(d.getTime())) return '';
    const diff = Math.max(0, Date.now() - d.getTime());
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Vừa xong';
    if (m < 60) return m + ' phút trước';
    const h = Math.floor(m / 60); if (h < 24) return h + ' giờ trước';
    return '';
  }

  function mapRow(row) {
    if (!row || !row.id || !row.province) return null;
    if (row.status === 'spam' || row.status === 'cancelled') return null;
    if (!row.display_name) return null;   // chưa đồng ý nêu tên → không hiển thị (TEST 4)
    return {
      id: String(row.id), type: 'real',
      name: row.display_name || null,
      province: String(row.province),
      district: row.district ? String(row.district) : null,
      createdAt: row.created_at || null,
      priorityUntil: 0,
    };
  }
  const fresh = r => { const d = new Date(r.createdAt); return !isNaN(d.getTime()) && (Date.now() - d.getTime()) <= MAX_AGE_MS; };
  const regionOf = it => it.type === 'real' ? it.province : it.region;

  let shownReal = ssGet(SS_SHOWN);
  let shownFb = ssGet(SS_SHOWN_FB);
  let count = shownReal.length + shownFb.length;
  let lastRegion = null, lastType = null, consecFb = 0;
  let closed = false, toast = null, timer = null;
  let realPool = [];       // đơn thật sẵn sàng hiển thị
  let pendingReal = [];    // đơn realtime chờ đến giờ {rec, at}
  let sb = null, realtimeOK = false, pollTimer = null, newestSeen = null;
  let lastShowAt = 0, nextAt = 0;

  // ── Chọn thông báo tiếp theo theo quy tắc đan xen ──
  function pickNext() {
    const now = Date.now();
    // chuyển đơn realtime đã đến giờ vào pool
    for (let i = pendingReal.length - 1; i >= 0; i--) {
      if (pendingReal[i].at <= now) {
        const rec = pendingReal[i].rec;
        rec.priorityUntil = now + PRIORITY_WINDOW;
        if (!realPool.some(r => r.id === rec.id)) realPool.push(rec);
        pendingReal.splice(i, 1);
      }
    }
    const realAvail = realPool.filter(r => shownReal.indexOf(r.id) === -1 && fresh(r));
    let fbAvail = FALLBACK.filter(f => shownFb.indexOf(f.id) === -1);
    // Thông báo nền lặp tuần hoàn: hết thì làm mới để luôn liên tục
    if (!fbAvail.length) {
      shownFb = []; sessionStorage.setItem(SS_SHOWN_FB, '[]');
      fbAvail = FALLBACK.filter(f => regionOf(f) !== lastRegion);
      if (!fbAvail.length) fbAvail = FALLBACK.slice();
    }
    const notLastRegion = list => {
      const ok = list.filter(it => regionOf(it) !== lastRegion);
      return ok.length ? ok : list;   // chỉ cho trùng khi hết lựa chọn khác
    };
    // 1) đơn thật đang trong cửa sổ ưu tiên 2 phút → hiển thị trước
    const priority = realAvail.filter(r => r.priorityUntil > now);
    if (priority.length) return rnd(notLastRegion(priority));
    // 2) quy tắc đan xen A/B (đơn thật ưu tiên; khi chưa có đơn thật → nền chạy liên tục)
    const canFb = fbAvail.length > 0 && (consecFb < 2 || realAvail.length === 0);
    if (realAvail.length && canFb && lastType === 'real' && Math.random() < 0.5) return rnd(notLastRegion(fbAvail));
    if (realAvail.length) return rnd(notLastRegion(realAvail));
    if (fbAvail.length) return rnd(notLastRegion(fbAvail));
    return null;
  }

  function getStack() {
    let s = document.getElementById('sp-stack');
    if (!s) { s = document.createElement('div'); s.id = 'sp-stack'; s.className = 'sp-stack'; document.body.appendChild(s); }
    return s;
  }

  function buildToast() {
    const el = document.createElement('div');
    el.className = 'sp-toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<button class="sp-close" aria-label="Đóng thông báo">✕</button>' +
      '<div class="sp-row">' +
        '<span class="sp-ico"></span>' +
        '<div class="sp-body"><div class="sp-msg"></div><div class="sp-time"></div></div>' +
      '</div>';
    el.querySelector('.sp-close').addEventListener('click', onClose);
    getStack().appendChild(el);
    return el;
  }

  function onClose() {
    closed = true;
    sessionStorage.setItem(SS_CLOSED, '1');
    if (timer) clearTimeout(timer);
    if (pollTimer) clearTimeout(pollTimer);
    // Ẩn tất cả thông báo đang hiện
    const s = document.getElementById('sp-stack');
    if (s) s.querySelectorAll('.sp-toast').forEach(function (t) { t.classList.remove('sp-show'); t.classList.add('sp-hide'); });
  }

  function show(it) {
    const toast = buildToast();
    const msg = toast.querySelector('.sp-msg');
    const timeEl = toast.querySelector('.sp-time');
    const icoEl = toast.querySelector('.sp-ico');
    if (it.type === 'real') {
      const loc = it.district ? it.district + ', ' + it.province : it.province;
      const who = it.name ? esc(it.name) : 'Một khách hàng';
      icoEl.innerHTML = ICO_CHECK;
      msg.innerHTML = '<span class="sp-name">' + who + '</span> tại <span class="sp-loc">' + esc(loc) + '</span> <span class="sp-ok">vừa đặt xe thành công</span>';
      const t = relTime(it.createdAt);
      timeEl.textContent = t;
      timeEl.style.display = t ? '' : 'none';
    } else {
      icoEl.innerHTML = it.icon;
      msg.innerHTML = it.html;               // nội dung tĩnh do ta soạn, an toàn
      timeEl.innerHTML = '<span class="sp-dot"></span>' + esc(it.sub);
      timeEl.style.display = '';
    }
    void toast.offsetWidth;
    toast.classList.add('sp-show');
    setTimeout(function () {
      toast.classList.remove('sp-show');
      toast.classList.add('sp-hide');
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 500);
    }, VISIBLE);
  }

  function loop() {
    if (closed || count >= MAX) return;
    const it = pickNext();
    if (it) {
      show(it);
      lastShowAt = Date.now();
      if (it.type === 'real') { shownReal.push(it.id); sessionStorage.setItem(SS_SHOWN, JSON.stringify(shownReal)); consecFb = 0; }
      else { shownFb.push(it.id); sessionStorage.setItem(SS_SHOWN_FB, JSON.stringify(shownFb)); consecFb++; }
      count++; lastType = it.type; lastRegion = regionOf(it);
      if (count >= MAX) return;
      // Nhịp tính từ lúc popup này hiện → cái kế tiếp sau đúng 7–9s (liên tục)
      scheduleLoop(randBetween(GAP_MIN, GAP_MAX));
    } else {
      // chưa có gì để hiện — thử lại sớm (đơn realtime có thể đến)
      scheduleLoop(randBetween(GAP_MIN, GAP_MAX));
    }
  }

  // Đặt lịch cho lần hiển tiếp theo (lưu mốc để có thể đẩy sớm khi có đơn thật)
  function scheduleLoop(delay) {
    if (timer) clearTimeout(timer);
    nextAt = Date.now() + delay;
    timer = setTimeout(loop, delay);
  }

  function onNewOrder(row) {
    const rec = mapRow(row);
    if (!rec) return;
    if (shownReal.indexOf(rec.id) !== -1) return;
    if (realPool.some(r => r.id === rec.id) || pendingReal.some(p => p.rec.id === rec.id)) return;
    if (rec.createdAt && (!newestSeen || rec.createdAt > newestSeen)) newestSeen = rec.createdAt;
    // Đưa vào đầu hàng đợi; hiển thị sau 3–5s (không đúng lúc khách bấm).
    const readyAt = Date.now() + randBetween(NEW_DELAY_MIN, NEW_DELAY_MAX);
    pendingReal.push({ rec: rec, at: readyAt });
    if (closed || count >= MAX) return;
    // Tạm hoãn thông báo nền: đẩy lịch loop về đúng lúc đơn thật sẵn sàng,
    // nhưng không chèn ngang popup đang hiển (giữ đủ VISIBLE từ lần trước).
    const earliest = Math.max(readyAt, lastShowAt + VISIBLE + 500);
    if (earliest < nextAt) scheduleLoop(earliest - Date.now());
  }

  function startPolling() {
    if (pollTimer || closed || !sb) return;
    const tick = async () => {
      pollTimer = null;
      if (closed || count >= MAX || realtimeOK) return;
      try {
        let q = sb.from('social_proof')
          .select('id,display_name,province,district,created_at,status')
          .order('created_at', { ascending: true }).limit(10);
        q = newestSeen ? q.gt('created_at', newestSeen)
                       : q.gte('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString());
        const res = await q;
        if (!res.error && Array.isArray(res.data)) res.data.forEach(onNewOrder);
      } catch (e) { /* mất mạng → thử lại lần sau */ }
      if (!closed && count < MAX && !realtimeOK) pollTimer = setTimeout(tick, randBetween(POLL_MIN, POLL_MAX));
    };
    // polling dự phòng 60–90s (chỉ khi realtime không hoạt động)
    pollTimer = setTimeout(tick, randBetween(POLL_MIN, POLL_MAX));
  }

  async function init() {
    // Chế độ xem thử: nạp 50 khách mẫu (dữ liệu bịa) để preview giao diện.
    if (SP_USE_MOCK) {
      const MOCK = [
        ['Anh Thanh','Cam Đường, Lào Cai'],['Chị Lan','Lào Cai'],['Anh Hùng','Lào Cai'],['Chị Hương','Lào Cai'],
        ['Anh Minh','Lào Cai'],['Chị Mai','Lào Cai'],['Anh Dũng','Lào Cai'],['Chị Thảo','Lào Cai'],['Anh Nam','Lào Cai'],['Chị Ngọc','Lào Cai'],
        ['Anh Tuấn','Sa Pa'],['Chị Linh','Sa Pa'],['Anh Quân','Sa Pa'],['Chị Phương','Sa Pa'],['Anh Đức','Sa Pa'],
        ['Chị Hà','Sa Pa'],['Anh Sơn','Sa Pa'],['Chị Trang','Sa Pa'],['Anh Long','Sa Pa'],['Chị Khánh','Sa Pa'],
        ['Anh Hiếu','Yên Bái'],['Chị Hoài','Yên Bái'],['Anh Tùng','Yên Bái'],['Chị Vân','Yên Bái'],['Anh Trung','Yên Bái'],
        ['Chị Nga','Yên Bái'],['Anh Cường','Yên Bái'],['Chị Thu','Yên Bái'],['Anh Phúc','Yên Bái'],['Chị Yến','Yên Bái'],
        ['Anh Bình','Thái Nguyên'],['Chị Liên','Thái Nguyên'],['Anh Thắng','Thái Nguyên'],['Chị Hạnh','Thái Nguyên'],['Anh Vũ','Thái Nguyên'],
        ['Chị Nhung','Thái Nguyên'],['Anh Kiên','Thái Nguyên'],['Chị Oanh','Thái Nguyên'],['Anh Khoa','Thái Nguyên'],['Chị Diệp','Thái Nguyên'],
        ['Anh Hải','Hà Nội'],['Chị Nhi','Hà Nội'],['Anh Lâm','Hà Nội'],['Chị Quỳnh','Hà Nội'],['Anh Phong','Hà Nội'],
        ['Chị Giang','Hà Nội'],['Anh Mạnh','Hà Nội'],['Chị Trâm','Hà Nội'],['Anh Toàn','Hà Nội'],['Chị Anh','Hà Nội'],
      ];
      realPool = MOCK.map((r, i) => {
        const parts = r[1].split(',');
        const province = parts[parts.length - 1].trim();
        const district = parts.length > 1 ? parts.slice(0, -1).join(',').trim() : null;
        return { id: 'mock' + (i + 1), type: 'real', name: r[0], province: province, district: district,
                 createdAt: new Date(Date.now() - (2 + i) * 60000).toISOString(), priorityUntil: 0 };
      });
      scheduleLoop(randBetween(FIRST_MIN, FIRST_MAX));
      return;
    }

    const url = window.AB_SUPABASE_URL, key = window.AB_SUPABASE_ANON_KEY;
    if (window.supabase && url && key) {
      try {
        sb = window.supabase.createClient(url, key);
        // 1) nạp các đơn thật trong 24 giờ gần nhất
        const since = new Date(Date.now() - MAX_AGE_MS).toISOString();
        const res = await sb.from('social_proof')
          .select('id,display_name,province,district,created_at,status')
          .gte('created_at', since)
          .order('created_at', { ascending: false }).limit(20);
        if (!res.error && Array.isArray(res.data)) {
          realPool = res.data.map(mapRow).filter(Boolean);
          if (res.data.length) newestSeen = res.data[0].created_at;
        }
        // 2) realtime: đơn mới đẩy tới mọi trình duyệt đang mở
        sb.channel('sp-feed')
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'social_proof' }, p => onNewOrder(p.new))
          .subscribe(status => {
            if (status === 'SUBSCRIBED') { realtimeOK = true; if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; } }
            else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') { realtimeOK = false; startPolling(); }
          });
        // realtime chưa lên sau 10s → chuyển polling dự phòng 60–90s/lần
        setTimeout(() => { if (!realtimeOK) startPolling(); }, 10000);
      } catch (e) {
        console.warn('[An Bình] Social proof: Supabase không khả dụng, chỉ hiện nội dung tuyến phổ biến.', e);
      }
    }
    // khởi động vòng hiển thị (không có Supabase → chỉ loại B trung thực)
    scheduleLoop(randBetween(FIRST_MIN, FIRST_MAX));
  }

  init();
})();
