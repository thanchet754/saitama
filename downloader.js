// State
let currentVideoData = null;
const STORAGE_KEY = "anyvideo_history";

// DOM Elements
const urlInput = document.getElementById("urlInput");
const pasteBtn = document.getElementById("pasteBtn");
const clearBtn = document.getElementById("clearBtn");
const submitBtn = document.getElementById("submitBtn");
const downloadForm = document.getElementById("downloadForm");
const platformIconWrap = document.getElementById("platformIconWrap");
const detectedIcon = document.getElementById("detectedIcon");
const serverStatus = document.getElementById("serverStatus");
const themeToggle = document.getElementById("themeToggle");

const loaderBox = document.getElementById("loaderBox");
const errorBox = document.getElementById("errorBox");
const errorMessage = document.getElementById("errorMessage");
const dismissErrorBtn = document.getElementById("dismissErrorBtn");

const resultCard = document.getElementById("resultCard");
const videoThumb = document.getElementById("videoThumb");
const videoDuration = document.getElementById("videoDuration");
const videoPlatformBadge = document.getElementById("videoPlatformBadge");
const videoPlatformIcon = document.getElementById("videoPlatformIcon");
const videoPlatformName = document.getElementById("videoPlatformName");
const videoTitle = document.getElementById("videoTitle");
const videoUploader = document.getElementById("videoUploader");
const videoViews = document.getElementById("videoViews");
const viewsContainer = document.getElementById("viewsContainer");

const videoFormatsList = document.getElementById("videoFormatsList");
const audioFormatsList = document.getElementById("audioFormatsList");
const tabButtons = document.querySelectorAll(".tab-btn");
const downloadingState = document.getElementById("downloadingState");

const historyList = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistoryBtn");
const chips = document.querySelectorAll(".chip");

const toast = document.getElementById("toast");
const toastMsg = document.getElementById("toastMsg");
const toastIcon = document.getElementById("toastIcon");

// Determine API Base URL
// If running on localhost or via server, use origin.
const API_BASE = window.location.origin.includes("localhost") || window.location.origin.includes("127.0.0.1") || window.location.port === "8000"
    ? window.location.origin
    : "";

// Platform icon mapping
const platformIcons = {
    youtube: "fa-brands fa-youtube",
    tiktok: "fa-brands fa-tiktok",
    facebook: "fa-brands fa-facebook",
    instagram: "fa-brands fa-instagram",
    twitter: "fa-brands fa-x-twitter",
    threads: "fa-brands fa-threads",
    reddit: "fa-brands fa-reddit",
    pinterest: "fa-brands fa-pinterest",
    bilibili: "fa-solid fa-tv",
    soundcloud: "fa-brands fa-soundcloud",
    other: "fa-solid fa-link"
};

// Check Server Health
async function checkServerHealth() {
    try {
        const res = await fetch(`${API_BASE}/api/health`, { method: "GET" });
        if (res.ok) {
            serverStatus.className = "status-indicator online";
            serverStatus.querySelector(".status-text").textContent = "Server Sẵn Sàng";
        } else {
            throw new Error("Server not responding properly");
        }
    } catch (err) {
        serverStatus.className = "status-indicator offline";
        serverStatus.querySelector(".status-text").textContent = "Server Chưa Bật (Chạy start.bat)";
    }
}

// Detect Platform from input URL
function detectPlatformFromUrl(url) {
    const lower = url.toLowerCase();
    if (lower.includes("tiktok.com") || lower.includes("douyin.com")) return "tiktok";
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
    if (lower.includes("facebook.com") || lower.includes("fb.watch") || lower.includes("fb.com")) return "facebook";
    if (lower.includes("instagram.com")) return "instagram";
    if (lower.includes("twitter.com") || lower.includes("x.com")) return "twitter";
    if (lower.includes("threads.net")) return "threads";
    if (lower.includes("reddit.com") || lower.includes("redd.it")) return "reddit";
    if (lower.includes("pinterest.com") || lower.includes("pin.it")) return "pinterest";
    if (lower.includes("soundcloud.com")) return "soundcloud";
    return "other";
}

function updatePlatformIcon(url) {
    if (!url.trim()) {
        detectedIcon.className = "fa-solid fa-link";
        detectedIcon.style.color = "";
        clearBtn.classList.add("hidden");
        return;
    }
    clearBtn.classList.remove("hidden");
    const plat = detectPlatformFromUrl(url);
    detectedIcon.className = platformIcons[plat] || "fa-solid fa-link";
    
    const colors = {
        youtube: "#ff0000",
        tiktok: "#00f2fe",
        facebook: "#1877f2",
        instagram: "#e1306c",
        twitter: "#1da1f2",
        threads: "#ffffff",
        reddit: "#ff4500",
        pinterest: "#e60023",
        soundcloud: "#ff5500",
        other: "var(--primary)"
    };
    detectedIcon.style.color = colors[plat] || "";
}

// Show Toast
let toastTimeout;
function showToast(message, type = "success") {
    toastMsg.textContent = message;
    if (type === "success") {
        toastIcon.className = "fa-solid fa-circle-check";
        toastIcon.style.color = "var(--accent-emerald)";
    } else {
        toastIcon.className = "fa-solid fa-circle-exclamation";
        toastIcon.style.color = "var(--accent-rose)";
    }
    toast.classList.remove("hidden");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.add("hidden");
    }, 3000);
}

// Paste from Clipboard
pasteBtn.addEventListener("click", async () => {
    try {
        const text = await navigator.clipboard.readText();
        if (text) {
            urlInput.value = text.trim();
            updatePlatformIcon(text);
            showToast("Đã dán liên kết từ clipboard!");
            fetchVideoInfo(text.trim());
        }
    } catch (err) {
        urlInput.focus();
        showToast("Vui lòng nhấn Ctrl+V để dán liên kết", "error");
    }
});

// Clear input
clearBtn.addEventListener("click", () => {
    urlInput.value = "";
    updatePlatformIcon("");
    urlInput.focus();
});

urlInput.addEventListener("input", (e) => {
    updatePlatformIcon(e.target.value);
});

// Example Chips
chips.forEach(chip => {
    chip.addEventListener("click", () => {
        const example = chip.dataset.example;
        urlInput.value = example;
        updatePlatformIcon(example);
        fetchVideoInfo(example);
    });
});

// Dismiss Error
dismissErrorBtn.addEventListener("click", () => {
    errorBox.classList.add("hidden");
});

// Tab switching
tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        const tab = btn.dataset.tab;
        if (tab === "video") {
            videoFormatsList.classList.add("active");
            audioFormatsList.classList.remove("active");
        } else {
            videoFormatsList.classList.remove("active");
            audioFormatsList.classList.add("active");
        }
    });
});

// Theme Toggle
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-theme");
    const isLight = document.body.classList.contains("light-theme");
    themeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    localStorage.setItem("anyvideo_theme", isLight ? "light" : "dark");
});

// Restore Theme
if (localStorage.getItem("anyvideo_theme") === "light") {
    document.body.classList.add("light-theme");
    themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
}

// Submit Form
downloadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const url = urlInput.value.trim();
    if (url) {
        fetchVideoInfo(url);
    }
});

// Fetch Video Information
async function fetchVideoInfo(url) {
    errorBox.classList.add("hidden");
    resultCard.classList.add("hidden");
    loaderBox.classList.remove("hidden");
    submitBtn.disabled = true;

    try {
        const endpoint = `${API_BASE}/api/info?url=${encodeURIComponent(url)}`;
        const res = await fetch(endpoint);
        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.detail || "Không thể lấy thông tin video");
        }

        currentVideoData = data;
        renderResult(data);
        saveToHistory(data);
        showToast("Phân tích video thành công!");
    } catch (err) {
        errorMessage.textContent = err.message || "Đã xảy ra lỗi khi phân tích đường dẫn.";
        errorBox.classList.remove("hidden");
        // Scroll to error
        errorBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } finally {
        loaderBox.classList.add("hidden");
        submitBtn.disabled = false;
    }
}

// Render Result Card
function renderResult(data) {
    videoThumb.src = data.thumbnail || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60";
    videoDuration.textContent = data.duration_formatted || "00:00";
    videoTitle.textContent = data.title;
    videoUploader.textContent = data.uploader || "Người dùng";
    
    if (data.view_count) {
        viewsContainer.classList.remove("hidden");
        videoViews.textContent = Number(data.view_count).toLocaleString("vi-VN") + " lượt xem";
    } else {
        viewsContainer.classList.add("hidden");
    }

    const platId = data.platform.id;
    videoPlatformIcon.className = platformIcons[platId] || "fa-solid fa-video";
    videoPlatformName.textContent = data.platform.name || "Video";

    // Populate Video Formats
    videoFormatsList.innerHTML = "";
    audioFormatsList.innerHTML = "";

    const videoOptions = data.options.filter(o => o.type === "video");
    const audioOptions = data.options.filter(o => o.type === "audio");

    videoOptions.forEach(opt => {
        const item = document.createElement("div");
        item.className = "format-item";
        item.innerHTML = `
            <div class="format-info">
                <span class="format-tag">${opt.ext}</span>
                <span class="format-name">${opt.format_name}</span>
                ${opt.recommended ? '<span class="format-rec">Khuyên dùng</span>' : ''}
            </div>
            <button class="btn-download-item" data-type="video" data-quality="${opt.quality}">
                <i class="fa-solid fa-download"></i> Tải Ngay
            </button>
        `;
        videoFormatsList.appendChild(item);
    });

    audioOptions.forEach(opt => {
        const item = document.createElement("div");
        item.className = "format-item";
        item.innerHTML = `
            <div class="format-info">
                <span class="format-tag">${opt.ext}</span>
                <span class="format-name">${opt.format_name}</span>
            </div>
            <button class="btn-download-item" data-type="audio" data-quality="${opt.quality}">
                <i class="fa-solid fa-music"></i> Tải MP3
            </button>
        `;
        audioFormatsList.appendChild(item);
    });

    // Attach click handlers to download buttons
    document.querySelectorAll(".btn-download-item").forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.dataset.type;
            const quality = btn.dataset.quality;
            triggerDownload(data.url, type, quality, data.title, btn);
        });
    });

    resultCard.classList.remove("hidden");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
}

// Trigger Download
function triggerDownload(url, type, quality, title, buttonEl) {
    downloadingState.classList.remove("hidden");
    const originalText = buttonEl.innerHTML;
    buttonEl.classList.add("loading");
    buttonEl.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';

    const downloadUrl = `${API_BASE}/api/download?url=${encodeURIComponent(url)}&type=${type}&quality=${quality}&title=${encodeURIComponent(title || "video")}`;

    // Create an invisible iframe or anchor to trigger the browser native download
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast("Đang tải xuống video! Hãy kiểm tra thanh tải về của trình duyệt.");

    setTimeout(() => {
        buttonEl.classList.remove("loading");
        buttonEl.innerHTML = originalText;
        downloadingState.classList.add("hidden");
    }, 4000);
}

// Local Storage History Management
function getHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

function saveToHistory(item) {
    let history = getHistory();
    // Remove duplicate by URL
    history = history.filter(h => h.url !== item.url);
    history.unshift({
        url: item.url,
        title: item.title,
        thumbnail: item.thumbnail,
        platform: item.platform,
        duration: item.duration_formatted,
        timestamp: Date.now()
    });
    // Keep max 12 items
    if (history.length > 12) history.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const history = getHistory();
    if (!history || history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-history">
                <i class="fa-regular fa-folder-open"></i>
                <p>Chưa có video nào trong lịch sử tải</p>
            </div>
        `;
        return;
    }

    historyList.innerHTML = "";
    history.forEach(item => {
        const card = document.createElement("div");
        card.className = "history-card";
        card.innerHTML = `
            <img src="${item.thumbnail || ''}" alt="${item.title}" class="history-thumb" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600'">
            <div class="history-body">
                <div class="history-title" title="${item.title}">${item.title}</div>
                <div class="history-meta">
                    <span>${item.platform?.name || 'Video'}</span>
                    <span>${item.duration || ''}</span>
                </div>
            </div>
        `;
        card.addEventListener("click", () => {
            urlInput.value = item.url;
            updatePlatformIcon(item.url);
            fetchVideoInfo(item.url);
        });
        historyList.appendChild(card);
    });
}

clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEY);
    renderHistory();
    showToast("Đã xóa lịch sử tải!");
});

// Initialize on Load
window.addEventListener("DOMContentLoaded", () => {
    checkServerHealth();
    renderHistory();
    setInterval(checkServerHealth, 10000);
});
