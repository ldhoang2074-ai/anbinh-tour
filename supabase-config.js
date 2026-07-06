// ============================================================
//  Cấu hình Supabase cho website An Bình (frontend)
//
//  ⚠️ CHỈ điền khóa "anon public" — khóa này ĐƯỢC PHÉP công khai
//  vì dữ liệu được bảo vệ bằng Row Level Security (RLS).
//  TUYỆT ĐỐI KHÔNG điền khóa "service_role" vào đây.
//
//  Lấy 2 giá trị tại: Supabase → Project Settings → API
//  Chưa điền → website vẫn chạy bình thường, popup chỉ hiện
//  nội dung tuyến phổ biến (loại B), không có đơn thật.
// ============================================================
window.AB_SUPABASE_URL = '';      // ví dụ: 'https://abcdxyz.supabase.co'
window.AB_SUPABASE_ANON_KEY = ''; // khóa anon public (chuỗi dài eyJ...)
