# AI Pose Fitness - Đếm Rep 9 Bài Tập Bằng Khung Xương AI

Web app dùng Google MediaPipe Pose để **đếm rep tự động qua camera** cho 9 bài tập, lưu lịch sử lên Supabase và **quay video buổi tập** kèm thông tin thiết bị, GPS, thời gian.

Bản chạy thật: https://saitama-liart.vercel.app

---

## 🏋️ Bài tập hỗ trợ

| Bài | Khớp đo | Tính 1 rep khi | Đặt camera |
|---|---|---|---|
| Squat | Góc gối | Đứng (> 160°) → ngồi (≤ 95°) → đứng | Trước / chéo 45° |
| Chùng chân (Lunge) | Góc gối trước | > 160° → ≤ 100° → > 160° | Bên cạnh / chéo |
| Hít đất (Push-up) | Góc khuỷu | > 150° → ≤ 90° → > 150°, thân nằm ngang | Bên cạnh, sát sàn |
| Gập tạ tay (Curl) | Góc khuỷu | > 150° → ≤ 48° → > 150° | Trước / nghiêng |
| Đẩy vai (Press) | Góc khuỷu | < 100° → ≥ 155° (cổ tay trên vai) → < 100° | Trước |
| Nâng tạ ngang | Góc vai | < 35° → ≥ 80° → < 35° | Trước |
| Bật nhảy (Jumping Jack) | Góc vai | < 50° → ≥ 140° → < 50° | Trước, lùi xa |
| Gập bụng (Sit-up) | Góc hông | > 115° → ≤ 70° → > 115° | Bên cạnh, sát sàn |
| Plank | Vai - hông - gót | Đếm giây khi thân thẳng (≥ 160°) và nằm ngang | Bên cạnh, sát sàn |

Bài tay (Curl, Đẩy vai, Nâng tạ ngang) cho chọn **Cả 2 tay / Tay phải / Tay trái**. Thêm bài mới: khai báo trong `exercises.js` (ngưỡng góc, hướng `up`/`down`, lời nhắc).

## 🏃 Hoạt động GPS (giống Strava)

Tab **Chạy · Đạp xe (GPS)**: Chạy bộ, Đi bộ, Đạp xe, Đi xe.

- Bản đồ trực tiếp (Leaflet + OpenStreetMap) vẽ tuyến đường, nền tối/sáng theo theme.
- Quãng đường, thời gian di chuyển, pace (chạy/đi bộ) hoặc tốc độ (đạp xe/đi xe), độ cao leo, calo (theo cân nặng), split từng km.
- Lọc nhiễu GPS (bỏ điểm sai số lớn, điểm nhảy bất thường, rung tại chỗ), tự tạm dừng khi đứng yên, giọng đọc báo mỗi km.
- Lỡ tải lại trang / tắt trình duyệt: hoạt động đang ghi được lưu tạm và có nút **Khôi phục**.
- Kết thúc → xem tổng kết + bản đồ → **Lưu** lên Supabase (bảng `activities`) hoặc **Bỏ**. Xem lại, xóa, **xuất file GPX** (nhập được vào Strava, Garmin...).
- Lưu ý: trình duyệt có thể ngừng GPS khi tắt màn hình — app giữ màn hình sáng trong lúc ghi.

## ✨ Tính năng

- **Đăng nhập** email + mật khẩu (sẵn sàng cho Google), trình duyệt nhớ đăng nhập.
- **Lịch sử tập luyện** lưu trên Supabase (RLS từng người), có cache offline và tự đồng bộ lại.
- **Quay video buổi tập**: camera + khung xương + số rep, kèm thời gian, tên thiết bị (tự nhận diện hoặc tự đặt), tọa độ GPS và tên địa điểm. Xem lại, tải về (MP4/WebM) hoặc chia sẻ. Video chỉ lưu trên máy.
- **Giọng đọc tiếng Việt** đếm số, âm beep, nhắc tư thế theo từng bài.
- **Nền sáng / tối**, tối ưu điện thoại dọc 9:16, giữ màn hình sáng khi tập.
- **Riêng tư**: AI chạy trên thiết bị; hình ảnh camera không gửi đi đâu. Khi bật "Ghi tên địa điểm", tọa độ được gửi tới BigDataCloud để tra tên.

## 📁 Cấu trúc

- `index.html`, `style.css` - giao diện
- `exercises.js` - thư viện bài tập & logic đếm
- `script.js` - camera, MediaPipe, theme, đăng nhập, lịch sử
- `recorder.js` - quay video + GPS + tên thiết bị
- `activity.js` - hoạt động GPS (chạy, đi bộ, đạp xe, đi xe)
- `supabase/schema.sql` - bảng `workout_sessions` + RLS
- `supabase/activities.sql` - bảng `activities` + RLS

## 💻 Chạy trên máy

```bash
python -m http.server 8765
```
Mở `http://localhost:8765` (cổng này đã có trong danh sách redirect của Supabase Auth).

## 🚀 Deploy

Push lên nhánh `main` của GitHub → Vercel tự deploy. Trên máy có sẵn `deploy.bat` (pull + commit + push).
