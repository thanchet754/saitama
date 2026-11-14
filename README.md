# Saitama - AI Pose Tracker

Web app tập luyện: **AI đếm rep qua camera** (MediaPipe Pose, chạy ngay trên máy), giáo án hằng ngày theo chiều cao cân nặng, đốt mỡ HIIT, chạy bộ / đạp xe bằng GPS, tự quay video buổi tập và gửi vào nhóm Telegram.

Bản chạy thật: https://saitama-liart.vercel.app

---

## Tính năng

- **23 bài tập, 6 nhóm cơ** (Chân & Mông, Ngực, Vai & Lưng, Tay, Bụng & Core, Cardio), gồm 6 bài tạ đơn đứng + giáo án **Combo tạ đơn 6 bài**. Đếm rep / đếm giây bằng góc khớp, có kiểm tra tư thế (thân nằm ngang, cổ tay trên vai...). Ngưỡng từng bài trong `exercises.js`.
- **Mô phỏng 3D** từng động tác (hình người three.js, xoay được) + 3 bước hướng dẫn; hiện ở trang chủ, màn hình nghỉ của giáo án và nút "Động tác mẫu" khi tập (`demo3d.js`).
- **Hồ sơ ban đầu** (giới tính, tuổi, chiều cao, cân nặng, mục tiêu, trình độ, thời gian, có tạ): BMI chuẩn châu Á, cân nặng lý tưởng, calo nên ăn.
- **Giáo án hôm nay** theo lịch tuần, **HIIT** 7 / 15 / 20 / 30 phút, **tập có hướng dẫn** (tự chuyển bài, đếm ngược, nghỉ, giọng đọc), chuỗi ngày tập 🔥 (`programs.js`).
- **Màn hình tập toàn màn hình**: camera phủ kín, cố định, chỉ còn số rep, nút thoát và vài nút tròn.
- **Tự quay video mọi buổi tập** kèm tên thiết bị, GPS, địa điểm, thời gian; cắt đoạn ~2,5 phút (`recorder.js`).
- **Video lên đám mây → Telegram**: tải lên Supabase Storage (chia phần 8 MB, tiếp tục khi mất mạng), máy chủ gửi vào nhóm Telegram rồi xóa bản trên Supabase (`videos.js`, `supabase/functions`).
- **Chạy · Đi bộ · Đạp xe · Đi xe (GPS)** kiểu Strava: bản đồ, pace / tốc độ, split, tự tạm dừng, GPX, tự lưu khi kết thúc (`activity.js`).
- **Tiến độ 7 ngày**: phút, kcal, rep, số ngày tập (`progress.js`).
- **Offline**: service worker lưu sẵn app + thư viện + mô hình AI; dữ liệu và video chờ trên máy, có mạng là tự tải lên (`sw.js`, `offline.js`).
- **Đăng nhập** email (Supabase Auth), nhớ trình duyệt; dữ liệu riêng từng người (RLS).
- Giao diện sáng / tối theo bảng màu 2026: Persimmon, Wasabi, Plum Noir, Jade, Cool Blue.

## Cài lên điện thoại

| Cách | Ghi chú |
|---|---|
| **Thêm vào Màn hình chính** (PWA) | iPhone: Safari → Chia sẻ → Thêm vào MH chính. Android: nút cài trên thanh tiêu đề. Không cần cài gì, tự cập nhật. |
| **App Android** | https://github.com/thanchet754/saitama/releases/latest/download/saitama.apk — thêm GPS chạy nền khi tắt màn hình. |
| **App iOS** (miễn phí) | https://github.com/thanchet754/saitama/releases/download/ios-latest/saitama-ios.ipa — cài bằng Sideloadly, ký lại mỗi 7 ngày. |

App Android / iOS là vỏ Capacitor (`app/`) tải trực tiếp web Vercel, nên **sửa web là app tự cập nhật**. Chỉ khi sửa trong `app/` GitHub Actions mới build lại APK / IPA.

## Supabase

Project dùng chung với một app khác: Saitama chỉ dùng các bảng / bucket có tên riêng.

| Thành phần | File |
|---|---|
| `workout_sessions` | `supabase/schema.sql` |
| `activities` | `supabase/activities.sql` |
| `saitama_profiles` | `supabase/profiles.sql` |
| `saitama_videos` + bucket riêng tư `saitama-videos` | `supabase/videos.sql` |
| `saitama_telegram_links`, `_codes`, `_config` | `supabase/telegram.sql`, `supabase/telegram-group.sql` |
| Edge functions `saitama-telegram-send`, `saitama-telegram-hook` | `supabase/functions/` |

Telegram: bot `@saitama_ngoc_workout_bot`. Trong app bấm **Kết nối Telegram**; thêm bot vào nhóm rồi gõ `/setgroup` để mọi video về nhóm đó (`/unsetgroup` để tắt). Token bot nằm trong Supabase secrets (`SAITAMA_TG_TOKEN`, `SAITAMA_TG_HOOK_SECRET`), không nằm trong repo.

## Chạy trên máy

```bash
python -m http.server 8765
```
Mở `http://localhost:8765` (đã có trong danh sách redirect của Supabase Auth).

## Deploy

Push lên `main` → Vercel tự deploy. Trên máy có `deploy.bat` (pull + commit + push).
