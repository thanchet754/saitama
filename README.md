# AI Pose Fitness - Đếm Squat & Gập Tạ Bằng Khung Xương AI

Web App chuyên biệt ứng dụng trí tuệ nhân tạo (Google MediaPipe Pose) để **đếm số lần Squat** và **đếm số lần Gập tạ tay (Bicep Curl)** tự động theo thời gian thực qua Camera.

---

## 🚀 Tính Năng Chính

### 1. 🏋️‍♂️ Đếm Squat AI (Đứng lên ngồi xuống)
- Nhận diện khớp hông, đầu gối, cổ chân.
- Đo góc gập đầu gối và hiển thị góc động ngay trên cơ thể.
- Đứng thẳng (> 160°) -> Ngồi xổm sâu (<= 95°) -> Đứng thẳng dậy: **Tự động tăng +1 Rep!**
- Lời nhắc tư thế thông minh: báo khi chưa hạ đủ độ sâu hoặc đứng chưa thẳng.

### 2. 💪 Đếm Gập Tạ Tay AI (Bicep Curl)
- Nhận diện khớp vai, khuỷu tay, cổ tay.
- Hỗ trợ chọn: **Cả 2 tay**, **Tay phải** hoặc **Tay trái**.
- Duỗi tay thẳng (> 150°) -> Gập tạ lên đỉnh (<= 48°) -> Hạ tạ duỗi thẳng: **Tự động tăng +1 Rep!**

### 3. 🎯 Trải Nghiệm Người Dùng
- **Giao diện tối giản, bấm là ăn ngay**, không có modal hay lớp phủ che màn hình.
- **Khung xương Neon Cyberpunk** phát sáng đẹp mắt.
- **Âm thanh giọng đọc tiếng Việt**: Tự động đếm "Một", "Hai", "Ba"... bằng Web Speech API và âm thanh beep chuẩn xác.
- **Đổi camera trước / sau** thuận tiện trên cả điện thoại di động và máy tính.
- **Thống kê buổi tập**: Số rep, thời gian tập, calo tiêu hao, độ chuẩn form.

---

## 💻 Cách Khởi Chạy

### Chạy trực tiếp trên máy:
```bash
python -m http.server 8000
```
Mở trình duyệt: `http://localhost:8000`

### Triển khai (Deploy):
Upload thư mục này lên GitHub, Vercel, Netlify hoặc GitHub Pages là có thể chạy ngay với giao thức HTTPS!
