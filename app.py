import os
import sys
import re
import uuid
import shutil
import tempfile
import asyncio
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse

from fastapi import FastAPI, Query, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
import yt_dlp

# Ensure ffmpeg binary is discoverable
try:
    import imageio_ffmpeg
    ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
    ffmpeg_dir = os.path.dirname(ffmpeg_exe)
    if ffmpeg_dir not in os.environ.get("PATH", ""):
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ.get("PATH", "")
except Exception:
    ffmpeg_exe = "ffmpeg"

TEMP_DIR = os.path.join(tempfile.gettempdir(), "video_downloader_cache")
os.makedirs(TEMP_DIR, exist_ok=True)

app = FastAPI(title="Universal Video Downloader API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def sanitize_filename(name: str) -> str:
    """Sanitize string for safe filename across OSes."""
    name = re.sub(r'[\\/*?:"<>|]', "", name)
    name = re.sub(r"\s+", " ", name).strip()
    return name[:120] if name else "video"

def detect_platform(url: str) -> Dict[str, str]:
    """Detect the social media platform from URL."""
    domain = urlparse(url).netloc.lower()
    path = urlparse(url).path.lower()
    
    if "tiktok.com" in domain or "douyin.com" in domain:
        return {"id": "tiktok", "name": "TikTok", "badge": "TikTok", "color": "#00f2fe", "icon": "tiktok"}
    elif "youtube.com" in domain or "youtu.be" in domain:
        return {"id": "youtube", "name": "YouTube", "badge": "YouTube", "color": "#ff0000", "icon": "youtube"}
    elif "facebook.com" in domain or "fb.watch" in domain or "fb.com" in domain:
        return {"id": "facebook", "name": "Facebook", "badge": "Facebook", "color": "#1877f2", "icon": "facebook"}
    elif "instagram.com" in domain:
        return {"id": "instagram", "name": "Instagram", "badge": "Instagram", "color": "#e1306c", "icon": "instagram"}
    elif "twitter.com" in domain or "x.com" in domain:
        return {"id": "twitter", "name": "Twitter / X", "badge": "X", "color": "#1da1f2", "icon": "twitter"}
    elif "threads.net" in domain:
        return {"id": "threads", "name": "Threads", "badge": "Threads", "color": "#000000", "icon": "threads"}
    elif "reddit.com" in domain or "redd.it" in domain:
        return {"id": "reddit", "name": "Reddit", "badge": "Reddit", "color": "#ff4500", "icon": "reddit"}
    elif "pinterest.com" in domain or "pin.it" in domain:
        return {"id": "pinterest", "name": "Pinterest", "badge": "Pinterest", "color": "#e60023", "icon": "pinterest"}
    elif "bilibili.com" in domain:
        return {"id": "bilibili", "name": "Bilibili", "badge": "Bilibili", "color": "#00a1d6", "icon": "bilibili"}
    elif "soundcloud.com" in domain:
        return {"id": "soundcloud", "name": "SoundCloud", "badge": "SoundCloud", "color": "#ff5500", "icon": "soundcloud"}
    else:
        return {"id": "other", "name": "Video", "badge": "Universal", "color": "#6366f1", "icon": "video"}

def format_duration(seconds: Optional[int]) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    if not seconds:
        return "N/A"
    seconds = int(seconds)
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    secs = seconds % 60
    if hours > 0:
        return f"{hours}:{minutes:02d}:{secs:02d}"
    return f"{minutes}:{secs:02d}"

def format_filesize(bytes_val: Optional[int]) -> str:
    """Format bytes to human readable string."""
    if not bytes_val or bytes_val <= 0:
        return "N/A"
    for unit in ["B", "KB", "MB", "GB"]:
        if bytes_val < 1024.0:
            return f"{bytes_val:.1f} {unit}"
        bytes_val /= 1024.0
    return f"{bytes_val:.1f} TB"

def get_ydl_base_opts() -> dict:
    return {
        "quiet": True,
        "no_warnings": True,
        "nocheckcertificate": True,
        "ffmpeg_location": ffmpeg_exe,
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    }

@app.get("/api/health")
def health_check():
    return {
        "status": "online",
        "ytdlp_version": yt_dlp.version.__version__,
        "ffmpeg": os.path.exists(ffmpeg_exe) or shutil.which("ffmpeg") is not None,
    }

@app.get("/api/platforms")
def get_platforms():
    return [
        {"id": "youtube", "name": "YouTube", "icon": "youtube", "desc": "Video, Shorts, Âm thanh MP3"},
        {"id": "tiktok", "name": "TikTok", "icon": "tiktok", "desc": "Video không logo, Nhạc nền MP3"},
        {"id": "facebook", "name": "Facebook", "icon": "facebook", "desc": "Video công khai, Reels, Watch"},
        {"id": "instagram", "name": "Instagram", "icon": "instagram", "desc": "Reels, Video bài viết, IGTV"},
        {"id": "twitter", "name": "Twitter / X", "icon": "twitter", "desc": "Video tweet, Clip"},
        {"id": "threads", "name": "Threads", "icon": "threads", "desc": "Video bài đăng Threads"},
        {"id": "reddit", "name": "Reddit", "icon": "reddit", "desc": "Video kèm âm thanh"},
        {"id": "pinterest", "name": "Pinterest", "icon": "pinterest", "desc": "Video ghim"},
    ]

@app.get("/api/info")
def get_video_info(url: str = Query(..., description="URL của video cần tải")):
    url = url.strip()
    if not url.startswith("http://") and not url.startswith("https://"):
        url = "https://" + url

    platform = detect_platform(url)
    ydl_opts = get_ydl_base_opts()
    ydl_opts["skip_download"] = True

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        err_msg = str(e)
        # Attempt fallback or return helpful error
        if "Private video" in err_msg or "login" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Video này là riêng tư hoặc yêu cầu đăng nhập tài khoản.")
        elif "blocked" in err_msg.lower():
            raise HTTPException(status_code=400, detail="Máy chủ nền tảng giới hạn IP truy cập cho liên kết này. Vui lòng thử lại sau.")
        raise HTTPException(status_code=400, detail=f"Không thể phân tích video: {err_msg[:200]}")

    if not info:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin video.")

    title = info.get("title") or "Video tải về"
    thumbnail = info.get("thumbnail") or ""
    duration = info.get("duration") or 0
    uploader = info.get("uploader") or info.get("channel") or info.get("creator") or platform["name"]
    view_count = info.get("view_count")

    # Discover available formats
    formats = info.get("formats", [])
    
    # Collect available video heights
    heights = set()
    has_audio = False
    
    for f in formats:
        h = f.get("height")
        vcodec = f.get("vcodec")
        acodec = f.get("acodec")
        if h and vcodec != "none":
            heights.add(h)
        if acodec != "none":
            has_audio = True

    options: List[Dict[str, Any]] = []

    # Sort descending
    sorted_heights = sorted(list(heights), reverse=True)
    standard_resolutions = [
        {"height": 2160, "label": "4K (2160p)", "quality_id": "2160"},
        {"height": 1440, "label": "2K (1440p)", "quality_id": "1440"},
        {"height": 1080, "label": "Full HD (1080p)", "quality_id": "1080"},
        {"height": 720, "label": "HD (720p)", "quality_id": "720"},
        {"height": 480, "label": "SD (480p)", "quality_id": "480"},
        {"height": 360, "label": "Cơ bản (360p)", "quality_id": "360"},
    ]

    # Add matched video qualities
    added_qualities = set()
    for res in standard_resolutions:
        matching = [h for h in sorted_heights if h >= res["height"] - 40 and h <= res["height"] + 40]
        if matching or (not sorted_heights and res["quality_id"] in ["720", "1080"]):
            if res["quality_id"] not in added_qualities:
                options.append({
                    "id": f"video_{res['quality_id']}",
                    "type": "video",
                    "quality": res["quality_id"],
                    "format_name": f"MP4 {res['label']}",
                    "ext": "mp4",
                    "has_audio": True,
                    "recommended": res["quality_id"] in ["1080", "720"] and len(options) == 0,
                })
                added_qualities.add(res["quality_id"])

    # Always ensure at least "Best Quality MP4" is present
    if not options:
        options.append({
            "id": "video_best",
            "type": "video",
            "quality": "best",
            "format_name": "MP4 Chất lượng tốt nhất (HD/FHD)",
            "ext": "mp4",
            "has_audio": True,
            "recommended": True,
        })
    else:
        # Prepend best option if higher than 1080p
        if sorted_heights and sorted_heights[0] > 1080 and "2160" not in added_qualities:
            options.insert(0, {
                "id": "video_best",
                "type": "video",
                "quality": "best",
                "format_name": f"MP4 Chất lượng gốc tốt nhất ({sorted_heights[0]}p)",
                "ext": "mp4",
                "has_audio": True,
                "recommended": True,
            })

    # Audio Options
    options.append({
        "id": "audio_mp3",
        "type": "audio",
        "quality": "mp3",
        "format_name": "Âm thanh MP3 (Chất lượng cao 192k)",
        "ext": "mp3",
        "has_audio": True,
        "recommended": False,
    })
    options.append({
        "id": "audio_m4a",
        "type": "audio",
        "quality": "m4a",
        "format_name": "Âm thanh M4A gốc",
        "ext": "m4a",
        "has_audio": True,
        "recommended": False,
    })

    return {
        "url": url,
        "title": title,
        "thumbnail": thumbnail,
        "duration": duration,
        "duration_formatted": format_duration(duration),
        "uploader": uploader,
        "view_count": view_count,
        "platform": platform,
        "options": options,
    }

def cleanup_file(filepath: str):
    """Safely remove a file after response is sent."""
    try:
        if os.path.exists(filepath):
            os.remove(filepath)
    except Exception as e:
        print(f"Error cleaning up {filepath}: {e}")

@app.get("/api/download")
def download_video(
    background_tasks: BackgroundTasks,
    url: str = Query(...),
    type: str = Query("video"),
    quality: str = Query("best"),
    title: Optional[str] = Query(None)
):
    url = url.strip()
    clean_title = sanitize_filename(title or "video")
    session_id = uuid.uuid4().hex[:8]
    
    ydl_opts = get_ydl_base_opts()
    
    if type == "audio":
        ext = "mp3" if quality == "mp3" else "m4a"
        out_filename = f"{clean_title}.{ext}"
        out_tmpl = os.path.join(TEMP_DIR, f"{session_id}_%(title)s.%(ext)s")
        
        ydl_opts.update({
            "format": "bestaudio/best",
            "outtmpl": out_tmpl,
        })
        if quality == "mp3":
            ydl_opts["postprocessors"] = [{
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }]
    else:
        ext = "mp4"
        out_filename = f"{clean_title}.mp4"
        out_tmpl = os.path.join(TEMP_DIR, f"{session_id}_%(title)s.%(ext)s")
        
        if quality == "best":
            format_spec = "bestvideo+bestaudio/best"
        elif quality.isdigit():
            format_spec = f"bestvideo[height<={quality}]+bestaudio/best[height<={quality}]/best"
        else:
            format_spec = "bestvideo[height<=1080]+bestaudio/best"
            
        ydl_opts.update({
            "format": format_spec,
            "outtmpl": out_tmpl,
            "merge_output_format": "mp4",
        })

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            real_filename = ydl.prepare_filename(info)
            
            # If converted to mp3 or merged to mp4, adjust actual extension
            base, _ = os.path.splitext(real_filename)
            target_file = f"{base}.{ext}"
            
            if not os.path.exists(target_file):
                # Search matching file in TEMP_DIR with session_id
                matched = [
                    os.path.join(TEMP_DIR, f) for f in os.listdir(TEMP_DIR)
                    if f.startswith(session_id)
                ]
                if matched:
                    target_file = matched[0]
                    ext = os.path.splitext(target_file)[1].lstrip(".")
                    out_filename = f"{clean_title}.{ext}"
                else:
                    raise HTTPException(status_code=500, detail="Tập tin đã tải về không tìm thấy trên hệ thống.")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi tải video: {str(e)[:250]}")

    background_tasks.add_task(cleanup_file, target_file)
    
    media_type = "audio/mpeg" if ext == "mp3" else "video/mp4"
    return FileResponse(
        path=target_file,
        filename=out_filename,
        media_type=media_type,
        background=background_tasks
    )

# Serve static files from root directory
workspace_dir = os.path.dirname(__file__)

@app.get("/")
def serve_index():
    index_path = os.path.join(workspace_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Video Downloader API is running."}

@app.get("/style.css")
def serve_css():
    return FileResponse(os.path.join(workspace_dir, "style.css"), media_type="text/css")

@app.get("/script.js")
def serve_js():
    return FileResponse(os.path.join(workspace_dir, "script.js"), media_type="application/javascript")

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    print(f"Server starting on http://localhost:{port}")
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
