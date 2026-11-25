# AnyVideoPro 🚀
**Trang web tải video đa nền tảng chất lượng cao (Facebook, TikTok, Instagram, YouTube, Twitter/X, Threads, Reddit, Pinterest...)**

---

## 🌟 Tính Năng Nổi Bật

- 🎬 **Hỗ trợ đa nền tảng**: Tải video từ **Facebook** (Reels, Watch), **TikTok** (không logo / no watermark), **Instagram** (Reels, Post), **YouTube** (Shorts, Full video, MP3), **Twitter/X**, **Threads**, **Reddit**, v.v.
- ⚡ **Chất lượng cao**: Lựa chọn 1080p Full HD, 720p HD, 480p, 360p hoặc chất lượng gốc tốt nhất.
- 🎵 **Tách nhạc MP3**: Chuyển đổi và trích xuất âm thanh MP3 chất lượng cao (192kbps - 320kbps) chỉ với 1 click.
- 🚫 **Xóa Logo TikTok**: Tải video TikTok & Douyin sạch không dính watermark logo mờ.
- 💻 **Giao diện hiện đại**: Thiết kế Dark/Light mode cực đẹp, hiệu ứng Glassmorphism, tự động nhận diện logo nền tảng khi dán link.
- 💾 **Lịch sử tải về**: Lưu trữ danh sách video vừa tải trong trình duyệt (localStorage).
- 🛡️ **An toàn & Riêng tư**: Không quảng cáo độc hại, không thu thập cookie hoặc dữ liệu cá nhân.

---

## 🚀 Hướng Dẫn Sử Dụng (1 Click Trên Windows)

1. Nhấp đúp chuột vào file **`start.bat`** trong thư mục dự án.
2. Trình duyệt sẽ tự động mở trang web tại địa chỉ: `http://localhost:8000`.
3. Dán link video (Facebook, TikTok, Instagram, YouTube) và bấm **Tải Ngay**!

---

## 🛠️ Chạy Thủ Công (Dành cho Developer)

### 1. Cài đặt thư viện:
```bash
pip install -r requirements.txt
```

### 2. Khởi chạy Server:
```bash
python app.py
```
Máy chủ sẽ chạy tại `http://localhost:8000`.

---

## 📁 Cấu Trúc Dự Án

```
├── app.py            # Backend FastAPI xử lý phân tích và tải video (yt-dlp + ffmpeg)
├── index.html        # Giao diện chính người dùng
├── style.css         # Bộ giao diện Dark Glassmorphism cao cấp
├── script.js         # Logic Frontend, nhận diện nền tảng, gọi API, lưu lịch sử
├── start.bat         # File kích hoạt 1-click cho Windows
├── requirements.txt  # Danh sách thư viện Python cần thiết
└── README.md         # Tài liệu hướng dẫn dự án
```

---

## 📜 Giấy Phép & Tuyên Bố Miễn Trừ Trách Nhiệm
Dự án được xây dựng cho mục đích học tập và sử dụng cá nhân phi thương mại. Vui lòng tôn trọng quyền sở hữu trí tuệ và điều khoản của các nhà sáng tạo nội dung trên từng nền tảng.
