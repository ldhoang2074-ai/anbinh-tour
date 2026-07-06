// ============================================================
//  Vercel Serverless Function — /api/social-proof
//  Nhận bản ghi social proof ĐÃ ẨN DANH khi khách gửi form.
//
//  - Service role key CHỈ đọc từ biến môi trường Vercel
//    (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) — không bao giờ
//    xuất hiện trong mã frontend.
//  - Đầu vào được kiểm tra chặt: tuyến phải thuộc danh sách,
//    tên chỉ giữ TÊN GỌI (từ cuối), tối đa 20 ký tự chữ.
//  - KHÔNG lưu số điện thoại, địa chỉ, điểm đón/trả.
// ============================================================

const ROUTES = [
  'Thái Nguyên ↔ Hà Nội',
  'Yên Bái ↔ Hà Nội',
  'Yên Bái ↔ Lào Cai',
  'Lào Cai ↔ Sapa',
  'Lào Cai/Sapa ↔ Hà Nội',
];

function deriveProvince(route) {
  // Lấy tỉnh xuất phát từ tuyến — an toàn, không đụng địa chỉ khách
  const first = String(route).split('↔')[0].trim();
  const p = first.split('/')[0].trim();
  return p === 'Sapa' ? 'Sa Pa' : p;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' });
    return;
  }
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SERVICE_KEY) {
    res.status(500).json({ ok: false, error: 'not_configured' });
    return;
  }
  try {
    const b = (typeof req.body === 'object' && req.body) ? req.body : JSON.parse(req.body || '{}');

    // Tuyến bắt buộc hợp lệ (chống dữ liệu rác)
    const route = ROUTES.indexOf(String(b.route || '')) > -1 ? String(b.route) : null;
    if (!route) { res.status(400).json({ ok: false, error: 'invalid_route' }); return; }

    const allow = b.allow === true;
    const title = ['Anh', 'Chị'].indexOf(String(b.title || '')) > -1 ? String(b.title) : null;

    // Chỉ giữ TÊN GỌI (từ cuối của họ tên), bỏ ký tự lạ, tối đa 20 ký tự
    let given = String(b.givenName || '').trim().split(/\s+/).pop() || '';
    given = given.replace(/[^A-Za-zÀ-Ỹà-ỹ]/g, '').slice(0, 20);

    // TEST 4: khách KHÔNG đồng ý → KHÔNG tạo bản ghi social proof (không hiển thị).
    // Chỉ tạo đơn Loại A khi có đồng ý + đủ danh xưng + tên.
    if (!allow || !title || !given) {
      res.status(200).json({ ok: true, skipped: true });
      return;
    }

    const display_name = title + ' ' + given.charAt(0).toUpperCase() + given.slice(1);

    const record = {
      display_name: display_name,          // luôn có (đã đồng ý)
      province: deriveProvince(route),     // chỉ tỉnh/thành
      district: null,                      // admin có thể bổ sung tay trong Supabase
      route: route,
      allow_named: true,
      status: 'new',
    };

    const r = await fetch(SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/social_proof', {
      method: 'POST',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(record),
    });

    if (!r.ok) {
      const t = await r.text();
      res.status(502).json({ ok: false, error: 'db_error', detail: t.slice(0, 200) });
      return;
    }
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(400).json({ ok: false, error: 'bad_request' });
  }
};
