// =========================================================
// Midnight YouTube Ultra v8 Pro - Full Enhanced Edition
// =========================================================

const WORKER_URL = "https://silent-mouse-5878.78q38gs6.workers.dev/";

/* ==================== STORAGE ==================== */
class Storage {
    static get(key, fallback = null) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch { return fallback; }
    }
    static set(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

/* ==================== TOAST ==================== */
class Toast {
    static show(message) {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

/* ==================== THEME MANAGER (レインボー完全対応) ==================== */
class ThemeManager {
    static init() {
        const themeSelect = document.getElementById("themeSelect");
        const accentPicker = document.getElementById("accentColorPicker");
        const debugToggle = document.getElementById("debugToggleSetting");

        const savedTheme = Storage.get("theme", "midnight");
        const savedAccent = Storage.get("customAccent", "#7c5cff");
        const hideDebug = Storage.get("hideDebug", false);

        if (themeSelect) themeSelect.value = savedTheme;
        if (accentPicker) accentPicker.value = savedAccent;
        if (debugToggle) debugToggle.checked = hideDebug;

        this.apply(savedTheme, savedAccent);
        this.toggleDebug(!hideDebug);

        themeSelect?.addEventListener("change", () => {
            this.apply(themeSelect.value, accentPicker.value);
            Storage.set("theme", themeSelect.value);
            Toast.show(`テーマを「${themeSelect.value.toUpperCase()}」に変更`);
        });

        accentPicker?.addEventListener("input", (e) => {
            this.apply(themeSelect.value, e.target.value);
            Storage.set("customAccent", e.target.value);
        });

        debugToggle?.addEventListener("change", (e) => {
            Storage.set("hideDebug", e.target.checked);
            this.toggleDebug(!e.target.checked);
        });
    }

    static apply(theme, accentColor = "#7c5cff") {
        document.body.className = `theme-${theme}`;

        const root = document.documentElement;
        root.style.setProperty("--accent", accentColor, "important");
        root.style.setProperty("--accent2", this.lightenColor(accentColor, 30), "important");

        // 動的スタイル
        let style = document.getElementById("dynamic-accent");
        if (!style) {
            style = document.createElement("style");
            style.id = "dynamic-accent";
            document.head.appendChild(style);
        }

        style.textContent = `
            :root { --accent: ${accentColor} !important; }
            .tab.active, .search-btn, .load-more-btn:hover, .sub-tab.active, 
            .pip-window, .video-card:hover, .ultra-badge, .toast {
                background: ${accentColor} !important;
                border-color: ${accentColor} !important;
            }
        `;
    }

    static lightenColor(hex, percent) {
        let r = parseInt(hex.slice(1,3),16);
        let g = parseInt(hex.slice(3,5),16);
        let b = parseInt(hex.slice(5,7),16);
        r = Math.min(255, Math.floor(r + (255 - r) * (percent/100)));
        g = Math.min(255, Math.floor(g + (255 - g) * (percent/100)));
        b = Math.min(255, Math.floor(b + (255 - b) * (percent/100)));
        return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }

    static toggleDebug(show) {
        const panel = document.getElementById("debugPanel");
        if (panel) panel.style.display = show ? "flex" : "none";
    }
}
/* ==================== YOUTUBE MANAGER ==================== */
class YouTubeManager {
    constructor() {
        this.searchIds = new Set();
        this.channelIds = new Set();
        this.currentContinuation = null;
        this.currentChannelContinuation = null;
        this.currentChannelId = null;
        this.currentChannelTab = "videos";
    }

    static cleanAndEncode(str) {
        return encodeURIComponent((str || "").trim());
    }

    initSuggest() {
        const input = document.getElementById("searchInput");
        const suggestBox = document.getElementById("suggestBox");
        if (!input || !suggestBox) return;

        let debounceTimeout;
        input.addEventListener("input", () => {
            clearTimeout(debounceTimeout);
            const query = input.value.trim();
            if (!query) {
                suggestBox.style.display = "none";
                return;
            }

            debounceTimeout = setTimeout(async () => {
                const encoded = YouTubeManager.cleanAndEncode(query);
                const logs = await DebugManager.fetchWithLog(`${WORKER_URL}?suggest=${encoded}`);
                if (logs && logs.length > 0) {
                    suggestBox.innerHTML = "";
                    logs.slice(0, 6).forEach(item => {
                        const div = document.createElement("div");
                        div.className = "suggest-item";
                        div.textContent = item;
                        div.onclick = () => {
                            input.value = item;
                            suggestBox.style.display = "none";
                            this.search();
                        };
                        suggestBox.appendChild(div);
                    });
                    suggestBox.style.display = "block";
                } else {
                    suggestBox.style.display = "none";
                }
            }, 250);
        });

        document.addEventListener("click", (e) => {
            if (e.target !== input) suggestBox.style.display = "none";
        });
    }

    async search(isLoadMore = false) {
        const input = document.getElementById("searchInput");
        const grid = document.getElementById("searchResultsGrid");
        const loadMoreBtn = document.getElementById("loadMoreBtn");
        if (!input || !grid) return;

        const query = input.value.trim();
        if (!query) return;

        if (!isLoadMore && (query.startsWith("@") || query.startsWith("UC") || query.includes("youtube.com/"))) {
            this.currentChannelTab = "videos";
            this.resetSubTabUI();
            this.openChannel(query, query);
            return;
        }

        if (!isLoadMore) {
            grid.innerHTML = '<div class="status-msg loading">探索中...</div>';
            this.searchIds.clear();
            this.currentContinuation = null;
            if (loadMoreBtn) loadMoreBtn.style.display = "none";
        }

        let url = `${WORKER_URL}?q=${YouTubeManager.cleanAndEncode(query)}`;
        if (isLoadMore && this.currentContinuation) {
            url = `${WORKER_URL}?continuation=${encodeURIComponent(this.currentContinuation)}&type=search`;
        }

        const data = await DebugManager.fetchWithLog(url);
        if (!isLoadMore) grid.innerHTML = "";

        if (data && data.results && data.results.length > 0) {
            this.currentContinuation = data.continuation || null;
            this.renderItems(data.results, grid, this.searchIds);
            if (loadMoreBtn) loadMoreBtn.style.display = this.currentContinuation ? "block" : "none";
        } else if (!isLoadMore) {
            grid.innerHTML = '<div class="status-msg no-results">コンテンツが見つかりませんでした。</div>';
        }
    }

    async openChannel(channelIdOrHandle, channelName, isSubTabClick = false) {
        const tabBtn = document.getElementById("channelTab");
        const grid = document.getElementById("channelResultsGrid");
        const loadMoreBtn = document.getElementById("channelLoadMoreBtn");
        if (!tabBtn || !grid) return;

        tabBtn.style.display = "block";
        if (channelName) {
            tabBtn.textContent = `📺 ${channelName.replace(/^@/, '')}`;
            tabBtn.setAttribute("data-name", channelName);
        }

        if (!isSubTabClick) {
            this.switchToChannelTab();
            this.currentChannelId = channelIdOrHandle;
        }

        grid.innerHTML = '<div class="status-msg loading">チャンネルをロード中...</div>';
        this.channelIds.clear();
        this.currentChannelContinuation = null;

        const encodedChannel = YouTubeManager.cleanAndEncode(this.currentChannelId);
        const url = `${WORKER_URL}?q=${encodedChannel}&tab=${this.currentChannelTab}`;

        const data = await DebugManager.fetchWithLog(url);
        grid.innerHTML = "";

        if (data && data.results && data.results.length > 0) {
            this.currentChannelContinuation = data.continuation || null;
            this.renderItems(data.results, grid, this.channelIds);
            if (loadMoreBtn) {
                loadMoreBtn.style.display = this.currentChannelContinuation ? "block" : "none";
            }

            const channelObj = data.results.find(item => item.type === "channel");
            if (channelObj && channelObj.channelId) {
                this.currentChannelId = channelObj.channelId;
            }
        } else {
            grid.innerHTML = '<div class="status-msg no-results">コンテンツが見つかりませんでした。</div>';
            if (loadMoreBtn) loadMoreBtn.style.display = "none";
        }
    }

    async loadMoreChannel() {
        const grid = document.getElementById("channelResultsGrid");
        const loadMoreBtn = document.getElementById("channelLoadMoreBtn");
        if (!this.currentChannelContinuation || !grid) return;

        if (loadMoreBtn) loadMoreBtn.textContent = "読み込み中...";

        const url = `${WORKER_URL}?continuation=${encodeURIComponent(this.currentChannelContinuation)}&type=browse`;
        const data = await DebugManager.fetchWithLog(url);

        if (data && data.results) {
            this.currentChannelContinuation = data.continuation || null;
            this.renderItems(data.results, grid, this.channelIds);
            if (loadMoreBtn) {
                loadMoreBtn.textContent = "さらに読み込む";
                loadMoreBtn.style.display = this.currentChannelContinuation ? "block" : "none";
            }
        } else if (loadMoreBtn) {
            loadMoreBtn.style.display = "none";
        }
    }

    resetSubTabUI() {
        const vSubTab = document.getElementById("channelVideosSubTab");
        const sSubTab = document.getElementById("channelShortsSubTab");
        if (!vSubTab || !sSubTab) return;

        vSubTab.classList.add("active");
        vSubTab.style.borderBottom = "2px solid var(--accent)";
        vSubTab.style.color = "var(--text)";
        sSubTab.classList.remove("active");
        sSubTab.style.borderBottom = "none";
        sSubTab.style.color = "var(--muted)";
    }

    switchSubTab(selected) {
        if (this.currentChannelTab === selected) return;
        this.currentChannelTab = selected;
        this.resetSubTabUI();

        if (this.currentChannelId) {
            const tabBtn = document.getElementById("channelTab");
            const currentName = tabBtn ? tabBtn.getAttribute("data-name") : null;
            this.openChannel(this.currentChannelId, currentName, true);
        }
    }

    switchToChannelTab() {
        document.querySelectorAll(".nav-tabs .tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        const tabBtn = document.getElementById("channelTab");
        const content = document.getElementById("channelTabContent");
        if (tabBtn) tabBtn.classList.add("active");
        if (content) content.classList.add("active");
    }

    renderItems(items, targetGrid, idSet) {
        items.forEach(item => {
            const uniqueKey = item.type === "channel" ? item.channelId : item.videoId;
            if (!uniqueKey || idSet.has(uniqueKey)) return;
            idSet.add(uniqueKey);

            const card = document.createElement("div");
            card.className = "video-card";

            if (item.type === "channel") {
                card.innerHTML = `
                    <div class="thumbnail-wrapper" style="border-radius: 50%; overflow: hidden; aspect-ratio: 1/1; max-width: 100px; margin: 16px auto 8px; border: 2px solid var(--accent);">
                        <img src="${item.thumbnail}" alt="" onerror="this.src='https://i.ytimg.com/vi/invalid/hqdefault.jpg'">
                    </div>
                    <div class="card-info" style="text-align: center;">
                        <div class="card-title">${item.title}</div>
                        <div class="card-meta">${item.publishedText || 'Channel'}</div>
                    </div>
                `;
                card.onclick = () => this.openChannel(item.channelId, item.title);
            } else {
                const shortBadge = item.isShort ? '<span class="badge shorts-badge">SHORTS</span>' : '';
                const isClickable = item.channel && item.channel !== "Unknown" && item.channel !== "Channel Video";

                card.innerHTML = `
                    <div class="thumbnail-wrapper">
                        <img src="${item.thumbnail}" alt="" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg'">
                        ${shortBadge}
                    </div>
                    <div class="card-info">
                        <div class="card-title" title="${item.title}">${item.title}</div>
                        <div class="card-channel ${isClickable ? 'clickable' : ''}">${item.channel}</div>
                        <div class="card-meta">${item.publishedText || ''}</div>
                    </div>
                `;

                const channelEl = card.querySelector(".card-channel");
                if (isClickable) {
                    channelEl.onclick = (e) => {
                        e.stopPropagation();
                        const name = channelEl.textContent.trim();
                        document.getElementById("searchInput").value = name.startsWith("@") ? name : `@${name}`;
                        this.currentChannelTab = "videos";
                        this.resetSubTabUI();
                        this.openChannel(name, name);
                    };
                }

                card.onclick = () => WindowManager.createWindow(item.videoId, item.title);
            }
            targetGrid.appendChild(card);
        });
    }
}

/* ==================== WINDOW MANAGER ==================== */
class WindowManager {
    static activeWindows = 0;

    static createWindow(videoId, title) {
        this.activeWindows++;
        const workspace = document.getElementById("windowWorkspace");
        if (!workspace) return;

        const win = document.createElement("div");
        const origin = window.location.origin;
        win.className = "pip-window";
        win.style.left = `${100 + (this.activeWindows * 25) % 200}px`;
        win.style.top = `${100 + (this.activeWindows * 25) % 200}px`;

        win.innerHTML = `
            <div class="pip-header">
                <span class="pip-title"></span>
                <div class="pip-controls">
                    <button class="pip-custom-btn fav-btn">⭐</button>
                    <button class="pip-custom-btn close-btn">✕</button>
                </div>
            </div>
            <div class="pip-body">
            <iframe
  src="https://www.youtube-nocookie.com/embed/${videoId}?origin=${origin}&autoplay=1"
  allow="autoplay; encrypted-media"
  allowfullscreen
></iframe>
            </div>
            <div class="pip-resizable-handle"></div>
        `;

        // Drag
        const header = win.querySelector(".pip-header");
        let isDragging = false, startX, startY, startLeft, startTop;
        header.onmousedown = (e) => {
            if (e.target.classList.contains("pip-custom-btn")) return;
            isDragging = true;
            win.style.zIndex = ++WindowManager.activeWindows + 1000;
            startX = e.clientX; startY = e.clientY;
            startLeft = parseInt(win.style.left) || 100;
            startTop = parseInt(win.style.top) || 100;

            const move = (ev) => {
                if (!isDragging) return;
                win.style.left = `${startLeft + (ev.clientX - startX)}px`;
                win.style.top = `${startTop + (ev.clientY - startY)}px`;
            };
            const up = () => { isDragging = false; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
        };

        // Resize
        const handle = win.querySelector(".pip-resizable-handle");
        let isResizing = false, startW, startH;
        handle.onmousedown = (e) => {
            e.stopPropagation();
            isResizing = true;
            win.style.zIndex = ++WindowManager.activeWindows + 1000;
            startX = e.clientX; startY = e.clientY;
            startW = win.offsetWidth; startH = win.offsetHeight;

            const move = (ev) => {
                if (!isResizing) return;
                win.style.width = `${Math.max(320, startW + (ev.clientX - startX))}px`;
                win.style.height = `${Math.max(220, startH + (ev.clientY - startY))}px`;
            };
            const up = () => { isResizing = false; document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
        };

        win.querySelector(".close-btn").onclick = () => win.remove();
        win.querySelector(".fav-btn").onclick = () => FavoritesManager.toggle({ id: videoId, title });

        workspace.appendChild(win);
        HistoryManager.add({ id: videoId, title, timestamp: Date.now() });
    }
}

/* ==================== FAVORITES & HISTORY ==================== */
class FavoritesManager {
    static toggle(item) {
        let list = Storage.get("favoritesData", []);
        const idx = list.findIndex(v => v.id === item.id);
        if (idx > -1) {
            list.splice(idx, 1);
            Toast.show("⭐ お気に入りから削除しました");
        } else {
            list.push(item);
            Toast.show("⭐ お気に入りに追加しました");
        }
        Storage.set("favoritesData", list);
        this.render();
    }

    static render() {
        const grid = document.getElementById("favoritesGrid");
        if (!grid) return;
        grid.innerHTML = "";
        const list = Storage.get("favoritesData", []);
        if (list.length === 0) {
            grid.innerHTML = '<div class="status-msg">お気に入りは空です。</div>';
            return;
        }
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <div class="thumbnail-wrapper"><img src="https://i.ytimg.com/vi/${item.id}/hqdefault.jpg"></div>
                <div class="card-info"><div class="card-title">${item.title}</div></div>
            `;
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

class HistoryManager {
    static add(item) {
        let list = Storage.get("playHistoryData", []);
        list = list.filter(v => v.id !== item.id);
        list.unshift(item);
        Storage.set("playHistoryData", list.slice(0, 50));
        this.render();
    }

    static clearAll() {
        Storage.set("playHistoryData", []);
        this.render();
        Toast.show("🕒 視聴履歴をすべてクリアしました");
    }

    static render() {
        const grid = document.getElementById("historyGrid");
        if (!grid) return;
        grid.innerHTML = "";
        const list = Storage.get("playHistoryData", []);
        if (list.length === 0) {
            grid.innerHTML = '<div class="status-msg">履歴はありません。</div>';
            return;
        }
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <div class="thumbnail-wrapper"><img src="https://i.ytimg.com/vi/${item.id}/hqdefault.jpg"></div>
                <div class="card-info">
                    <div class="card-title">${item.title}</div>
                    <div class="card-meta">${new Date(item.timestamp).toLocaleString()}</div>
                </div>
            `;
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

/* ==================== WAVE CANVAS ENGINE (完全連動版) ==================== */
class WaveEngine {
    constructor() {
        this.canvas = document.getElementById("waveCanvas");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");
        this.phase = 0;
        window.addEventListener("resize", () => this.resize());
        this.resize();
        this.animate();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    getCurrentAccent() {
        // 現在のテーマからアクセントカラーを取得（カスタム or レインボー対応）
        let color = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
        if (!color || color === '') color = '#7c5cff';
        return color;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 124, g: 92, b: 255 };
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.phase += 0.012;

        const accentHex = this.getCurrentAccent();
        const rgb = this.hexToRgb(accentHex);

        // レインボーモード判定
        const isRainbow = document.body.classList.contains('theme-rainbow');

        for (let layer = 0; layer < 3; layer++) {
            this.ctx.beginPath();
            const amp = 28 + layer * 22;
            const speed = 0.55 + layer * 0.28;
            const baseY = this.canvas.height * (0.58 + layer * 0.07);

            for (let x = 0; x <= this.canvas.width; x += 8) {
                const y = baseY + Math.sin(x * 0.007 + this.phase * speed) * amp;
                if (x === 0) this.ctx.moveTo(x, y);
                else this.ctx.lineTo(x, y);
            }

            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.closePath();

            if (isRainbow) {
                // レインボーモードは鮮やかなグラデーション
                const hue = (this.phase * 30 + layer * 40) % 360;
                this.ctx.fillStyle = `hsla(${hue}, 100%, 65%, ${0.07 + layer * 0.045})`;
            } else {
                // 通常 / カスタムカラー
                this.ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${0.055 + layer * 0.04})`;
            }

            this.ctx.fill();
        }

        requestAnimationFrame(() => this.animate());
    }
}
/* ==================== DEBUG MANAGER ==================== */
class DebugManager {
    static init() {
        const header = document.getElementById("debugHeader");
        const btnToggle = document.getElementById("debugToggleBtn");
        if (header && btnToggle) {
            header.onclick = () => {
                const panel = document.getElementById("debugPanel");
                panel.classList.toggle("collapsed");
                btnToggle.textContent = panel.classList.contains("collapsed") ? "🔼" : "🔽";
            };
        }
    }

    static async fetchWithLog(url) {
        const box = document.getElementById("debugNetLogs");
        if (!box) {
            try { const r = await fetch(url); return await r.json(); } catch { return null; }
        }

        const item = document.createElement("div");
        item.className = "debug-log-item";
        item.textContent = `[FETCH] ${url.substring(0, 50)}...`;
        box.appendChild(item);

        try {
            const r = await fetch(url);
            const d = await r.json();
            item.textContent += ` -> OK`;
            return d;
        } catch {
            item.style.color = "#f87171";
            item.textContent += ` -> ERR`;
            return null;
        }
    }
}

/* ==================== KEYBOARD MANAGER ==================== */
class KeyboardManager {
    static focusedIndex = -1;

    static init(ytManager) {
        document.addEventListener("keydown", e => {
            if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName)) {
                if (e.key === "Escape") document.activeElement.blur();
                return;
            }

            switch (e.key) {
                case "/":
                case "k":
                    e.preventDefault();
                    document.getElementById("searchInput")?.focus();
                    break;
                case "Escape":
                    const windows = document.querySelectorAll(".pip-window");
                    if (windows.length) windows[windows.length - 1].remove();
                    break;
                case "ArrowRight":
                    document.getElementById("loadMoreBtn")?.click() || document.getElementById("channelLoadMoreBtn")?.click();
                    break;
                case "ArrowDown":
                case "ArrowUp":
                    this.navigateResults(e.key === "ArrowDown" ? 1 : -1);
                    break;
                case "1": this.switchTab(0); break;
                case "2": this.switchTab(1); break;
                case "3": this.switchTab(2); break;
                case "4": this.switchTab(3); break;
            }
        });
    }

    static navigateResults(dir) {
        const activeContent = document.querySelector(".tab-content.active");
        const grid = activeContent?.querySelector(".results-grid");
        if (!grid) return;

        const cards = Array.from(grid.querySelectorAll(".video-card"));
        if (!cards.length) return;

        KeyboardManager.focusedIndex = Math.max(0, Math.min(cards.length - 1, KeyboardManager.focusedIndex + dir));
        cards.forEach((c, i) => c.style.outline = i === KeyboardManager.focusedIndex ? "3px solid var(--accent)" : "none");
        cards[KeyboardManager.focusedIndex].scrollIntoView({ behavior: "smooth", block: "center" });
    }

    static switchTab(n) {
        const tabs = document.querySelectorAll(".nav-tabs .tab");
        if (tabs[n]) tabs[n].click();
    }
}

/* ==================== INIT ==================== */
document.addEventListener("DOMContentLoaded", () => {
    const ytManager = new YouTubeManager();

    ThemeManager.init();
    ytManager.initSuggest();
    KeyboardManager.init(ytManager);
    DebugManager.init();
    new WaveEngine();

    // メインタブ切り替え
    document.querySelectorAll(".nav-tabs .tab").forEach(tab => {
        tab.addEventListener("click", () => {
            document.querySelectorAll(".nav-tabs .tab").forEach(t => t.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            tab.classList.add("active");
            const targetId = tab.id === "channelTab" ? "channelTabContent" : `${tab.dataset.tab}Tab`;
            document.getElementById(targetId)?.classList.add("active");
        });
    });

    // チャンネルサブタブ
    const vSub = document.getElementById("channelVideosSubTab");
    const sSub = document.getElementById("channelShortsSubTab");
    if (vSub) vSub.onclick = () => ytManager.switchSubTab("videos");
    if (sSub) sSub.onclick = () => ytManager.switchSubTab("shorts");

    // 検索ボタン
    document.getElementById("searchBtn").onclick = () => ytManager.search();
    document.getElementById("searchInput").onkeydown = (e) => {
        if (e.key === "Enter") ytManager.search();
    };

    document.getElementById("loadMoreBtn").onclick = () => ytManager.search(true);
    document.getElementById("channelLoadMoreBtn").onclick = () => ytManager.loadMoreChannel();
    document.getElementById("clearHistoryBtn").onclick = () => HistoryManager.clearAll();

    FavoritesManager.render();
    HistoryManager.render();

    Toast.show("Midnight YouTube Ultra v8 Pro 完全起動 🚀");
});