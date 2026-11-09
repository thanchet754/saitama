# Saitama AI Workout - Web App Đếm Khung Xương (AI Pose Skeleton)

Ứng dụng Web PWA hỗ trợ đếm số lần và thời gian tập luyện tự động bằng **AI nhận diện khung xương thời gian thực qua Camera (Google MediaPipe Pose)** và cảm biến gia tốc / GPS.

---

## 🌟 Tính Năng Mới: AI Camera Khung Xương (Skeleton Tracking)

### 1. 🏋️‍♂️ Đếm Squat (Đứng lên ngồi xuống)
- **Cơ chế**: AI nhận diện các khớp mốc cơ thể: Hông (Hip) - Đầu gối (Knee) - Cổ chân (Ankle).
- **Tính toán góc**: Tự động đo góc gập của khớp đầu gối (`Knee Angle`) theo thời gian thực và vẽ trực tiếp số đo góc ngay trên khớp gối.
- **Quy chuẩn Rep**:
  - Đứng thẳng: góc > 160° (`UP`)
  - Ngồi xổm chuẩn sâu: góc <= 95° (`DOWN`)
  - Chuyển từ `UP` -> `DOWN` -> đứng thẳng `UP`: **Tự động tăng +1 Rep!**
- **Form Feedback**: Cảnh báo tức thì nếu ngồi chưa đủ sâu hoặc đứng chưa thẳng người.

### 2. 💪 Đếm Gập Tạ Tay (Bicep Curl)
- **Cơ chế**: AI nhận diện các khớp mốc cơ thể: Vai (Shoulder) - Khuỷu tay (Elbow) - Cổ tay (Wrist).
- **Tính toán góc**: Đo góc gập của khuỷu tay (`Elbow Angle`) và hiển thị góc động.
- **Tùy chọn tay**: Hỗ trợ chọn **Tay Phải**, **Tay Trái** hoặc **Cả 2 Tay (Dual Arms)**.
- **Quy chuẩn Rep**:
  - Duỗi thẳng tay hạ tạ: góc > 150° (`DOWN`)
  - Gập tạ đạt đỉnh co cơ: góc <= 48° (`UP`)
  - Chuyển từ `DOWN` -> `UP` -> duỗi thẳng `DOWN`: **Tự động tăng +1 Rep!**
- **Form Feedback**: Nhắc nhở gập sát đỉnh hoặc hạ tạ có kiểm soát.

---

## 🚀 Các Điểm Nổi Bật Khác
- **Hiệu ứng Neon Cyberpunk**: Khung xương phát sáng màu Cyan / Cam Neon tuyệt đẹp.
- **Âm thanh & Giọng đọc số Rep**: Tự động đọc số bằng giọng nói tiếng Việt ("Một", "Hai", "Ba"...) và tiếng beep qua Web Speech API & Web Audio API.
- **Thanh đo góc & tiến độ (Gauge Bar)**: Thanh phần trăm trực quan giúp bạn biết mình đã gập/ngồi bao nhiêu % mục tiêu.
- **Đổi Camera Trước / Sau**: Dễ dàng chuyển đổi giữa camera selfie (tự động lật gương) và camera sau.
- **Đồng bộ Supabase**: Tự động đồng bộ lịch sử tập luyện và mục tiêu lên database đám mây.

---

## 🛠️ Hướng Dẫn Sử Dụng
1. Mở trang web trên trình duyệt điện thoại hoặc máy tính (Khuyên dùng Chrome hoặc Safari).
2. Tại màn hình chính hoặc mục **Tập luyện**, bấm vào **Squat AI** hoặc **Gập tạ tay AI**.
3. Cho phép quyền truy cập Camera khi trình duyệt yêu cầu.
4. Đứng hoặc ngồi lùi xa camera khoảng 1.5m - 2m để camera nhìn thấy rõ cơ thể.
5. Bắt đầu tập luyện, AI sẽ tự động vẽ khung xương và đếm rep cho bạn!
