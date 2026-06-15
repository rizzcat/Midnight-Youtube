// =============================================================
//  Midnight YouTube V9 — app.js
//  Full Enhanced Edition (Fixed & Optimized)
// =============================================================

const WORKER_URL = "https://silent-mouse-5878.78q38gs6.workers.dev/";

// =============================================================
//  STORAGE
// =============================================================
class Storage {
    static get(key, fallback = null) {
        try {
            const v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : fallback;
        } catch { return fallback; }
    }
    static set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
    static remove(key) { localStorage.removeItem(key); }
}

// =============================================================
//  TOAST
// =============================================================
class Toast {
    static show(message, type = "default", duration = 3000) {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const toast = document.createElement("div");
        toast.className = `toast${type !== "default" ? " " + type : ""}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = "none";
            toast.style.opacity = "0";
            toast.style.transition = "opacity .3s";
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// =============================================================
//  THEME MANAGER
// =============================================================
class ThemeManager {
    static rainbowInterval = null;

    static init() {
        const themeSelect    = document.getElementById("themeSelect");
        const accentPicker   = document.getElementById("accentColorPicker");
        const accentLabel    = document.getElementById("accentHexLabel");
        const debugToggle    = document.getElementById("debugToggleSetting");
        const waveToggle     = document.getElementById("waveToggle");
        const particleToggle = document.getElementById("particleToggle");
        const cardAnimToggle = document.getElementById("cardAnimToggle");
        const resetBtn       = document.getElementById("resetAllBtn");

        const saved = {
            theme:    Storage.get("theme", "midnight"),
            accent:   Storage.get("customAccent", "#7c5cff"),
            hideDbg:  Storage.get("hideDebug", false),
            wave:     Storage.get("waveEnabled", true),
            particle: Storage.get("particleEnabled", true),
            cardAnim: Storage.get("cardAnimEnabled", true),
        };

        if (themeSelect)    themeSelect.value    = saved.theme;
        if (accentPicker)   accentPicker.value   = saved.accent;
        if (accentLabel)    accentLabel.textContent = saved.accent;
        if (debugToggle)    debugToggle.checked  = saved.hideDbg;
        if (waveToggle)     waveToggle.checked   = saved.wave;
        if (particleToggle) particleToggle.checked = saved.particle;
        if (cardAnimToggle) cardAnimToggle.checked = saved.cardAnim;

        this.apply(saved.theme, saved.accent);
        this.toggleDebug(!saved.hideDbg);

        themeSelect?.addEventListener("change", () => {
            this.apply(themeSelect.value, accentPicker.value);
            Storage.set("theme", themeSelect.value);
            Toast.show(`Theme switched to: ${themeSelect.value.toUpperCase()}`);
        });

        accentPicker?.addEventListener("input", (e) => {
            this.apply(themeSelect.value, e.target.value);
            Storage.set("customAccent", e.target.value);
            if (accentLabel) accentLabel.textContent = e.target.value;
        });

        debugToggle?.addEventListener("change", (e) => {
            Storage.set("hideDebug", e.target.checked);
            this.toggleDebug(!e.target.checked);
        });

        waveToggle?.addEventListener("change", (e) => {
            Storage.set("waveEnabled", e.target.checked);
            const canvas = document.getElementById("waveCanvas");
            if (canvas) canvas.style.display = e.target.checked ? "" : "none";
        });

        particleToggle?.addEventListener("change", (e) => {
            Storage.set("particleEnabled", e.target.checked);
            const el = document.getElementById("particleCanvas");
            if (el) el.style.display = e.target.checked ? "" : "none";
        });

        cardAnimToggle?.addEventListener("change", (e) => {
            Storage.set("cardAnimEnabled", e.target.checked);
            document.querySelectorAll(".video-card").forEach(c => {
                c.classList.toggle("no-anim", !e.target.checked);
            });
        });

        resetBtn?.addEventListener("click", () => {
            if (!confirm("Delete all data (bookmarks, history, settings)?")) return;
            localStorage.clear();
            Toast.show("All data has been reset.", "danger");
            setTimeout(() => location.reload(), 1000);
        });
    }

    static apply(theme, accentColor = "#7c5cff") {
        document.body.className = `theme-${theme}`;
        const root = document.documentElement;

        if (theme !== "rainbow") {
            root.style.setProperty("--accent", accentColor);
            root.style.setProperty("--accent2", this.lighten(accentColor, 28));
            root.style.setProperty("--accent-glow", this.hexToRgba(accentColor, 0.22));
        }

        let style = document.getElementById("dyn-accent");
        if (!style) {
            style = document.createElement("style");
            style.id = "dyn-accent";
            document.head.appendChild(style);
        }
        if (theme !== "rainbow") {
            style.textContent = `:root{--accent:${accentColor}!important;--accent2:${this.lighten(accentColor,28)}!important;--accent-glow:${this.hexToRgba(accentColor,0.22)}!important;}`;
        } else {
            style.textContent = "";
        }
    }

    static lighten(hex, pct) {
        if (!hex || hex.length < 7) return hex;
        let r = parseInt(hex.slice(1,3),16);
        let g = parseInt(hex.slice(3,5),16);
        let b = parseInt(hex.slice(5,7),16);
        r = Math.min(255, r + Math.round((255-r)*pct/100));
        g = Math.min(255, g + Math.round((255-g)*pct/100));
        b = Math.min(255, b + Math.round((255-b)*pct/100));
        return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
    }

    static hexToRgba(hex, a) {
        if (!hex || hex.length < 7) return `rgba(124,92,255,${a})`;
        const r = parseInt(hex.slice(1,3),16);
        const g = parseInt(hex.slice(3,5),16);
        const b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
    }

    static toggleDebug(show) {
        const panel = document.getElementById("debugPanel");
        if (panel) panel.style.display = show ? "flex" : "none";
    }
}

// =============================================================
//  WAVE ENGINE - FIXED
// =============================================================
class WaveEngine {
    constructor() {
        this.canvas = document.getElementById("waveCanvas");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");
        this.phase = 0;
        this.enabled = Storage.get("waveEnabled", true);
        if (!this.enabled) this.canvas.style.display = "none";
        window.addEventListener("resize", () => this.resize());
        this.resize();
        this.startLoop();
    }
    
    resize() {
        if (!this.canvas) return;
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    getAccent() {
        return getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#7c5cff";
    }
    
    hexToRgb(hex) {
        const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return r ? { r:parseInt(r[1],16), g:parseInt(r[2],16), b:parseInt(r[3],16) } : {r:124,g:92,b:255};
    }
    
    startLoop() {
        this.loop();
    }
    
    loop = () => {
        if (!this.canvas || !document.getElementById("waveCanvas")) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.phase += 0.01;
        const hex = this.getAccent();
        const rgb = this.hexToRgb(hex);
        const rainbow = document.body.classList.contains("theme-rainbow");

        for (let layer = 0; layer < 3; layer++) {
            this.ctx.beginPath();
            const amp   = 24 + layer * 20;
            const speed = 0.5 + layer * 0.25;
            const baseY = this.canvas.height * (0.60 + layer * 0.06);

            for (let x = 0; x <= this.canvas.width; x += 6) {
                const y = baseY + Math.sin(x * 0.006 + this.phase * speed) * amp
                                + Math.sin(x * 0.012 + this.phase * speed * 0.7) * (amp * 0.4);
                x === 0 ? this.ctx.moveTo(x,y) : this.ctx.lineTo(x,y);
            }
            this.ctx.lineTo(this.canvas.width, this.canvas.height);
            this.ctx.lineTo(0, this.canvas.height);
            this.ctx.closePath();

            if (rainbow) {
                const hue = (this.phase * 25 + layer * 50) % 360;
                this.ctx.fillStyle = `hsla(${hue},100%,65%,${0.06 + layer*0.04})`;
            } else {
                this.ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.05 + layer*0.035})`;
            }
            this.ctx.fill();
        }
        requestAnimationFrame(this.loop);
    }
}

// =============================================================
//  PARTICLE ENGINE
// =============================================================
class ParticleEngine {
    constructor() {
        this.container = document.getElementById("particleCanvas");
        if (!this.container) return;
        this.enabled = Storage.get("particleEnabled", true);
        if (!this.enabled) return;
        this.particles = [];
        this.max = 30;
        this.spawn();
        setInterval(() => this.spawn(), 1800);
    }
    spawn() {
        if (!this.enabled || !this.container) return;
        if (this.particles.length >= this.max) return;
        const p = document.createElement("div");
        const size = 2 + Math.random() * 3;
        const x = Math.random() * 100;
        const duration = 8 + Math.random() * 10;
        const delay = Math.random() * 3;
        p.style.cssText = `
            position:absolute;
            left:${x}%;
            bottom:-10px;
            width:${size}px;
            height:${size}px;
            border-radius:50%;
            background:var(--accent);
            opacity:0;
            pointer-events:none;
            animation:particleFloat ${duration}s ${delay}s ease-in-out forwards;
            box-shadow:0 0 ${size*2}px var(--accent);
        `;
        this.container.appendChild(p);
        this.particles.push(p);
        setTimeout(() => {
            p.remove();
            this.particles = this.particles.filter(x => x !== p);
        }, (duration + delay) * 1000);
    }
}

// Inject particle keyframe
const particleStyle = document.createElement("style");
particleStyle.textContent = `
@keyframes particleFloat {
    0%   { transform:translateY(0) scale(0); opacity:0; }
    10%  { opacity:.7; transform:translateY(-20px) scale(1); }
    90%  { opacity:.3; }
    100% { transform:translateY(-${window.innerHeight}px) scale(0.5) translateX(${(Math.random()-.5)*200}px); opacity:0; }
}`;
document.head.appendChild(particleStyle);

// =============================================================
//  QUEUE MANAGER
// =============================================================
class QueueManager {
    static queue = Storage.get("queue", []);
    static currentIndex = -1;

    static add(item) {
        if (this.queue.find(v => v.id === item.id)) {
            Toast.show("Already in queue", "warning");
            return;
        }
        this.queue.push(item);
        this.save();
        Toast.show(`Added to queue`);
        this.render();
        DebugManager.updateStats();
    }

    static remove(id) {
        this.queue = this.queue.filter(v => v.id !== id);
        this.save();
        this.render();
        DebugManager.updateStats();
    }

    static clear() {
        this.queue = [];
        this.save();
        this.render();
        Toast.show("Queue cleared");
        DebugManager.updateStats();
    }

    static shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        this.save();
        this.render();
        Toast.show("Queue shuffled");
    }

    static playAll() {
        if (!this.queue.length) { Toast.show("Queue is empty", "warning"); return; }
        this.queue.forEach((item, i) => {
            setTimeout(() => WindowManager.createWindow(item.id, item.title), i * 800);
        });
    }

    static save() { Storage.set("queue", this.queue); }

    static render() {
        const list = document.getElementById("queueList");
        if (!list) return;
        list.innerHTML = "";
        if (!this.queue.length) {
            list.innerHTML = '<div class="no-results" style="padding:40px;">Queue is empty</div>';
            return;
        }
        this.queue.forEach((item, idx) => {
            const el = document.createElement("div");
            el.className = "queue-item";
            el.innerHTML = `
                <div class="queue-drag-handle">⠿</div>
                <div class="q-num">${idx + 1}</div>
                <div class="queue-thumb"><img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy"></div>
                <div class="queue-info">
                    <div class="queue-title">${this.escape(item.title)}</div>
                    <div class="queue-channel">${this.escape(item.channel || "")}</div>
                </div>
                <button class="queue-remove" data-id="${item.id}" title="Remove">✕</button>
            `;
            el.querySelector(".queue-remove").onclick = (e) => {
                e.stopPropagation();
                this.remove(item.id);
            };
            el.onclick = () => WindowManager.createWindow(item.id, item.title);
            list.appendChild(el);
        });
    }

    static escape(str) {
        return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }
}

// =============================================================
//  FAVORITES MANAGER
// =============================================================
class FavoritesManager {
    static toggle(item) {
        let list = Storage.get("favorites", []);
        const idx = list.findIndex(v => v.id === item.id);
        if (idx > -1) {
            list.splice(idx, 1);
            Toast.show("Removed from favorites");
        } else {
            list.push({ ...item, addedAt: Date.now() });
            Toast.show("Added to favorites", "success");
        }
        Storage.set("favorites", list);
        this.render();
        DebugManager.updateStats();
        document.querySelectorAll(".card-fav-dot").forEach(dot => {
            const id = dot.dataset.id;
            dot.classList.toggle("active", !!list.find(v => v.id === id));
        });
    }

    static isFav(id) {
        return !!Storage.get("favorites", []).find(v => v.id === id);
    }

    static render() {
        const grid   = document.getElementById("favoritesGrid");
        const sortSel = document.getElementById("favSortSelect");
        if (!grid) return;
        let list = Storage.get("favorites", []);
        if (sortSel?.value === "alpha") list = [...list].sort((a,b) => a.title.localeCompare(b.title));

        grid.innerHTML = "";
        if (!list.length) {
            grid.innerHTML = '<div class="no-results" style="padding:40px;">No favorites yet</div>';
            return;
        }
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy">
                    <div class="card-overlay">
                        <button class="overlay-btn fav-play-btn" title="Play">Play</button>
                        <button class="overlay-btn fav-remove-btn" title="Remove">Remove</button>
                    </div>
                </div>
                <div class="card-info">
                    <div class="card-title">${QueueManager.escape(item.title)}</div>
                    <div class="card-meta">Added: ${new Date(item.addedAt||0).toLocaleDateString()}</div>
                </div>
            `;
            card.querySelector(".fav-play-btn")?.addEventListener("click", (e) => {
                e.stopPropagation();
                WindowManager.createWindow(item.id, item.title);
            });
            card.querySelector(".fav-remove-btn")?.addEventListener("click", (e) => {
                e.stopPropagation();
                this.toggle(item);
            });
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

// =============================================================
//  HISTORY MANAGER
// =============================================================
class HistoryManager {
    static add(item) {
        let list = Storage.get("history", []);
        list = list.filter(v => v.id !== item.id);
        list.unshift({ ...item, ts: Date.now() });
        Storage.set("history", list.slice(0, 100));
        this.render();
    }

    static clearAll() {
        Storage.set("history", []);
        this.render();
        Toast.show("History cleared", "danger");
    }

    static render(filter = "") {
        const grid = document.getElementById("historyGrid");
        if (!grid) return;
        let list = Storage.get("history", []);
        if (filter) list = list.filter(v => v.title.toLowerCase().includes(filter.toLowerCase()));

        grid.innerHTML = "";
        if (!list.length) {
            grid.innerHTML = `<div class="no-results" style="padding:40px;">${filter ? "No results" : "No history"}</div>`;
            return;
        }
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            const dateStr = new Date(item.ts).toLocaleString("ja-JP", { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy">
                    <div class="card-overlay">
                        <button class="overlay-btn">Play</button>
                    </div>
                </div>
                <div class="card-info">
                    <div class="card-title">${QueueManager.escape(item.title)}</div>
                    <div class="card-meta">${dateStr}</div>
                </div>
            `;
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

// =============================================================
//  WINDOW MANAGER
// =============================================================
class WindowManager {
    static _winCount = 0;
    static _windows  = new Map();

    static createWindow(videoId, title) {
        const maxWins = parseInt(Storage.get("maxWindows", 5)) || Infinity;
        if (maxWins && this._windows.size >= maxWins) {
            const [firstId, firstEl] = this._windows.entries().next().value;
            firstEl.remove();
            this._windows.delete(firstId);
            Toast.show("Closed oldest window", "warning");
        }

        this._winCount++;
        const workspace = document.getElementById("windowWorkspace");
        if (!workspace) return;

        const sizes = { small:[400,260], medium:[520,330], large:[700,430] };
        const sizeKey = Storage.get("windowSize", "medium");
        const [W, H] = sizes[sizeKey] || sizes.medium;

        const autoplay = Storage.get("autoplayEnabled", true) ? "?autoplay=1" : "?autoplay=0";

        const win = document.createElement("div");
        win.className = "pip-window";
        win.style.left = `${80 + (this._winCount * 30) % 300}px`;
        win.style.top  = `${80 + (this._winCount * 30) % 200}px`;
        win.style.width  = W + "px";
        win.style.height = H + "px";
        win.innerHTML = `
            <div class="pip-header">
                <span class="pip-title" title="${QueueManager.escape(title)}">${QueueManager.escape(title)}</span>
                <div class="pip-controls">
                    <div class="pip-vol-wrap">
                        <span>Vol</span>
                        <input type="range" class="pip-vol" min="0" max="100" value="100" title="Volume">
                    </div>
                    <button class="pip-custom-btn fav-btn" title="Add to favorites">${FavoritesManager.isFav(videoId) ? "Fav" : "Add"}</button>
                    <button class="pip-custom-btn queue-btn" title="Add to queue">Queue</button>
                    <button class="pip-custom-btn min-btn" title="Minimize">-</button>
                    <button class="pip-custom-btn close-btn" title="Close">X</button>
                </div>
            </div>
            <div class="pip-body">
                <iframe
                    src="https://www.youtube-nocookie.com/embed/${videoId}${autoplay}&origin=${location.origin}&enablejsapi=1"
                    allow="autoplay; encrypted-media; fullscreen"
                    allowfullscreen
                ></iframe>
            </div>
            <div class="pip-resizable-handle"></div>
        `;

        const volSlider = win.querySelector(".pip-vol");
        volSlider.addEventListener("input", (e) => {
            const vol = e.target.value;
            const iframe = win.querySelector("iframe");
            iframe?.contentWindow?.postMessage(JSON.stringify({
                event: "command",
                func: "setVolume",
                args: [vol, true]
            }), "*");
        });

        const header = win.querySelector(".pip-header");
        let drag = false, sx, sy, sl, st;
        header.onmousedown = (e) => {
            if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT") return;
            drag = true;
            this._bringToFront(win);
            sx = e.clientX; sy = e.clientY;
            sl = parseInt(win.style.left)||80;
            st = parseInt(win.style.top)||80;
            const mv = (ev) => {
                if (!drag) return;
                win.style.left = Math.max(0, sl + ev.clientX - sx) + "px";
                win.style.top  = Math.max(0, st + ev.clientY - sy) + "px";
            };
            const up = () => { drag=false; document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up); };
            document.addEventListener("mousemove", mv);
            document.addEventListener("mouseup", up);
        };

        let resize = false, rsx, rsy, rw, rh;
        win.querySelector(".pip-resizable-handle").onmousedown = (e) => {
            e.stopPropagation();
            resize = true;
            this._bringToFront(win);
            rsx=e.clientX; rsy=e.clientY; rw=win.offsetWidth; rh=win.offsetHeight;
            const mv = (ev) => {
                if (!resize) return;
                win.style.width  = Math.max(300, rw + ev.clientX - rsx) + "px";
                win.style.height = Math.max(200, rh + ev.clientY - rsy) + "px";
            };
            const up = () => { resize=false; document.removeEventListener("mousemove",mv); document.removeEventListener("mouseup",up); };
            document.addEventListener("mousemove", mv);
            document.addEventListener("mouseup", up);
        };

        let minimized = false;
        win.querySelector(".min-btn").onclick = () => {
            minimized = !minimized;
            const body = win.querySelector(".pip-body");
            const handle = win.querySelector(".pip-resizable-handle");
            body.style.display  = minimized ? "none" : "";
            handle.style.display = minimized ? "none" : "";
            win.querySelector(".min-btn").textContent = minimized ? "+" : "-";
        };

        win.querySelector(".close-btn").onclick = () => {
            win.style.transition = "opacity .2s, transform .2s";
            win.style.opacity = "0";
            win.style.transform = "scale(0.9)";
            setTimeout(() => {
                win.remove();
                this._windows.delete(videoId + "_" + this._winCount);
                this._updateSidebar();
                DebugManager.updateStats();
            }, 200);
        };

        const favBtn = win.querySelector(".fav-btn");
        favBtn.onclick = () => {
            FavoritesManager.toggle({ id: videoId, title });
            favBtn.textContent = FavoritesManager.isFav(videoId) ? "Fav" : "Add";
        };

        win.querySelector(".queue-btn").onclick = () => {
            QueueManager.add({ id: videoId, title, channel: "" });
        };

        win.addEventListener("mousedown", () => this._bringToFront(win));

        workspace.appendChild(win);
        const key = videoId + "_" + this._winCount;
        this._windows.set(key, win);

        HistoryManager.add({ id: videoId, title });
        this._updateSidebar(videoId, title);
        DebugManager.updateStats();

        return win;
    }

    static _bringToFront(win) {
        this._winCount++;
        win.style.zIndex = 5000 + this._winCount;
    }

    static _updateSidebar(videoId, title) {
        const status  = document.getElementById("miniStatus");
        const mTitle  = document.getElementById("miniTitle");
        const mWins   = document.getElementById("miniWindows");
        const mThumb  = document.getElementById("miniThumb");
        if (!status) return;
        const count = document.querySelectorAll(".pip-window").length;
        if (count === 0) {
            status.style.display = "none";
            return;
        }
        status.style.display = "flex";
        if (mWins) mWins.textContent = `${count} windows`;
        if (videoId && title) {
            if (mTitle) mTitle.textContent = title;
            if (mThumb) mThumb.innerHTML = `<img src="https://i.ytimg.com/vi/${videoId}/mqdefault.jpg">`;
        }
    }
}

// =============================================================
//  CONTEXT MENU
// =============================================================
class ContextMenu {
    static current = null;

    static show(x, y, data) {
        this.current = data;
        const menu = document.getElementById("contextMenu");
        if (!menu) return;
        menu.style.display = "block";
        menu.style.left = Math.min(x, window.innerWidth  - 170) + "px";
        menu.style.top  = Math.min(y, window.innerHeight - 200) + "px";
    }

    static hide() {
        const menu = document.getElementById("contextMenu");
        if (menu) menu.style.display = "none";
        this.current = null;
    }

    static init() {
        document.addEventListener("click", () => this.hide());

        document.getElementById("ctxPlay")?.addEventListener("click", () => {
            if (this.current) WindowManager.createWindow(this.current.videoId, this.current.title);
        });
        document.getElementById("ctxQueue")?.addEventListener("click", () => {
            if (this.current) QueueManager.add(this.current);
        });
        document.getElementById("ctxFav")?.addEventListener("click", () => {
            if (this.current) FavoritesManager.toggle(this.current);
        });
        document.getElementById("ctxCopy")?.addEventListener("click", () => {
            if (this.current) {
                navigator.clipboard.writeText(`https://youtu.be/${this.current.videoId}`);
                Toast.show("URL copied");
            }
        });
        document.getElementById("ctxClose")?.addEventListener("click", () => this.hide());
    }
}

// =============================================================
//  YOUTUBE MANAGER
// =============================================================
class YouTubeManager {
    constructor() {
        this.searchIds  = new Set();
        this.channelIds = new Set();
        this.currentContinuation        = null;
        this.currentChannelContinuation = null;
        this.currentChannelId           = null;
        this.currentChannelTab          = "videos";
        this.currentFilter              = "all";
        this.allResults                 = [];
        this.trendingLoaded             = false;
        this._lastTrendCategory         = null;
    }

    static enc(s) { return encodeURIComponent((s||"").trim()); }
    static esc(s) { return QueueManager.escape(s); }

    // ── Suggest ──────────────────────────────────────────────
    initSuggest() {
        const input = document.getElementById("searchInput");
        const box   = document.getElementById("suggestBox");
        const clearBtn = document.getElementById("clearSearchBtn");
        if (!input) return;

        let timer;
        input.addEventListener("input", () => {
            const q = input.value.trim();
            clearBtn?.classList.toggle("visible", q.length > 0);
            clearTimeout(timer);
            if (!q) { if(box) box.style.display="none"; return; }
            timer = setTimeout(async () => {
                const data = await DebugManager.fetch(`${WORKER_URL}?suggest=${YouTubeManager.enc(q)}`);
                if (!box) return;
                if (data && data.length > 0) {
                    box.innerHTML = "";
                    data.slice(0,7).forEach(s => {
                        const d = document.createElement("div");
                        d.className = "suggest-item";
                        d.textContent = s;
                        d.onclick = () => { input.value=s; box.style.display="none"; this.search(); };
                        box.appendChild(d);
                    });
                    box.style.display = "block";
                } else { box.style.display = "none"; }
            }, 220);
        });

        clearBtn?.addEventListener("click", () => {
            input.value = "";
            clearBtn.classList.remove("visible");
            if (box) box.style.display = "none";
            input.focus();
        });

        document.addEventListener("click", e => { if(e.target!==input && box) box.style.display="none"; });
    }

    // ── Filter pills ─────────────────────────────────────────
    initFilterPills() {
        document.querySelectorAll("#filterPills .pill").forEach(pill => {
            pill.addEventListener("click", () => {
                document.querySelectorAll("#filterPills .pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                this.currentFilter = pill.dataset.filter;
                this.applyFilter();
            });
        });
    }

    applyFilter() {
        const f = this.currentFilter;
        const grid = document.getElementById("searchResultsGrid");
        if (!grid) return;
        Array.from(grid.querySelectorAll(".video-card")).forEach(card => {
            const type = card.dataset.type || "video";
            card.style.display = (f==="all" || type===f) ? "" : "none";
        });
    }

    // ── Search ───────────────────────────────────────────────
    async search(isLoadMore = false) {
        const input     = document.getElementById("searchInput");
        const grid      = document.getElementById("searchResultsGrid");
        const loadMore  = document.getElementById("loadMoreBtn");
        const sortBar   = document.getElementById("sortBar");
        const countEl   = document.getElementById("resultCount");
        if (!input || !grid) return;

        const q = input.value.trim();
        if (!q) return;

        if (!isLoadMore && (q.startsWith("@") || /^UC[\w-]{20,}$/.test(q) || q.includes("youtube.com/") || q.includes("youtu.be/"))) {
            this.currentChannelTab = "videos";
            this.resetSubTabUI();
            this.openChannel(q, q);
            return;
        }

        if (!isLoadMore) {
            grid.innerHTML = '<div class="loading">Searching...</div>';
            this.searchIds.clear();
            this.allResults = [];
            this.currentContinuation = null;
            if (loadMore) loadMore.style.display = "none";
            if (sortBar) sortBar.style.display = "none";
        }

        let url = `${WORKER_URL}?q=${YouTubeManager.enc(q)}`;
        if (isLoadMore && this.currentContinuation) {
            url = `${WORKER_URL}?continuation=${YouTubeManager.enc(this.currentContinuation)}&type=search`;
        }

        const data = await DebugManager.fetch(url);
        if (!isLoadMore) grid.innerHTML = "";

        if (data?.results?.length) {
            this.currentContinuation = data.continuation || null;
            this.renderItems(data.results, grid, this.searchIds, true);
            this.allResults.push(...data.results);
            if (sortBar) sortBar.style.display = "flex";
            if (countEl) countEl.textContent = `${this.allResults.length}`;
            if (loadMore) loadMore.style.display = this.currentContinuation ? "block" : "none";
            this.applyFilter();
        } else if (!isLoadMore) {
            grid.innerHTML = '<div class="no-results">No results found. Try a different search.</div>';
        }

        DebugManager.updateStats();
    }

    // ── Trending ─────────────────────────────────────────────
    async loadTrending(category = "JP") {
        if (this.trendingLoaded && category === this._lastTrendCategory) return;
        this._lastTrendCategory = category;
        this.trendingLoaded = true;

        const grid = document.getElementById("trendingGrid");
        if (!grid) return;
        grid.innerHTML = '<div class="loading">Loading trending...</div>';

        const queryMap = { JP:"Trending Japan", music:"Music Ranking", gaming:"Gaming Popular", news:"Latest News" };
        const q = queryMap[category] || "Trending";
        const data = await DebugManager.fetch(`${WORKER_URL}?q=${YouTubeManager.enc(q)}`);
        grid.innerHTML = "";

        if (data?.results?.length) {
            const trendIds = new Set();
            data.results.slice(0, 20).forEach((item, idx) => {
                const card = this.buildCard(item, trendIds, false);
                if (!card) return;
                if (item.type !== "channel") {
                    const badge = document.createElement("div");
                    badge.className = "rank-badge";
                    badge.textContent = idx + 1;
                    card.querySelector(".thumbnail-wrapper")?.appendChild(badge);
                }
                grid.appendChild(card);
            });
        } else {
            grid.innerHTML = '<div class="no-results">Could not load trending.</div>';
        }
    }

    // ── Channel ──────────────────────────────────────────────
    async openChannel(handle, displayName, isSubTabClick = false) {
        const tabBtn  = document.getElementById("channelTab");
        const tabLabel = document.getElementById("channelTabLabel");
        const grid    = document.getElementById("channelResultsGrid");
        const loadMore = document.getElementById("channelLoadMoreBtn");
        if (!tabBtn || !grid) return;

        tabBtn.style.display = "block";
        const shortName = (displayName || "").replace(/^@/, "").substring(0, 14);
        if (tabLabel) tabLabel.textContent = shortName || "Channel";
        tabBtn.setAttribute("data-name", displayName || "");

        if (!isSubTabClick) {
            this.switchToChannelTab();
            this.currentChannelId = handle;
        }

        grid.innerHTML = '<div class="loading">Loading channel...</div>';
        this.channelIds.clear();
        this.currentChannelContinuation = null;

        const url = `${WORKER_URL}?q=${YouTubeManager.enc(this.currentChannelId)}&tab=${this.currentChannelTab}`;
        const data = await DebugManager.fetch(url);
        grid.innerHTML = "";

        if (data?.results?.length) {
            this.currentChannelContinuation = data.continuation || null;

            const ch = data.results.find(r => r.type === "channel");
            if (ch) {
                this.currentChannelId = ch.channelId || this.currentChannelId;
                const heroEl = document.getElementById("channelHeader");
                if (heroEl) {
                    heroEl.style.display = "flex";
                    heroEl.innerHTML = `
                        <img class="channel-hero-avatar" src="${ch.thumbnail}" onerror="this.style.display='none'">
                        <div class="channel-hero-info">
                            <div class="channel-hero-name">${YouTubeManager.esc(ch.title)}</div>
                            <div class="channel-hero-sub">${YouTubeManager.esc(ch.publishedText || "Channel")}</div>
                        </div>
                    `;
                }
            }

            this.renderItems(data.results, grid, this.channelIds);
            if (loadMore) loadMore.style.display = this.currentChannelContinuation ? "block" : "none";
        } else {
            grid.innerHTML = '<div class="no-results">No channel content found.</div>';
            if (loadMore) loadMore.style.display = "none";
        }
        DebugManager.updateStats();
    }

    async loadMoreChannel() {
        if (!this.currentChannelContinuation) return;
        const grid = document.getElementById("channelResultsGrid");
        const loadMore = document.getElementById("channelLoadMoreBtn");
        if (loadMore) loadMore.textContent = "Loading...";

        const url = `${WORKER_URL}?continuation=${YouTubeManager.enc(this.currentChannelContinuation)}&type=browse`;
        const data = await DebugManager.fetch(url);
        if (data?.results) {
            this.currentChannelContinuation = data.continuation || null;
            this.renderItems(data.results, grid, this.channelIds);
        }
        if (loadMore) {
            loadMore.textContent = "Load More";
            loadMore.style.display = this.currentChannelContinuation ? "block" : "none";
        }
    }

    resetSubTabUI() {
        const vSub = document.getElementById("channelVideosSubTab");
        const sSub = document.getElementById("channelShortsSubTab");
        if (vSub) { vSub.classList.add("active"); }
        if (sSub) { sSub.classList.remove("active"); }
    }

    switchSubTab(sel) {
        if (this.currentChannelTab === sel) return;
        this.currentChannelTab = sel;
        this.resetSubTabUI();
        const vSub = document.getElementById("channelVideosSubTab");
        const sSub = document.getElementById("channelShortsSubTab");
        if (sel === "videos") {
            vSub?.classList.add("active"); sSub?.classList.remove("active");
        } else {
            sSub?.classList.add("active"); vSub?.classList.remove("active");
        }
        const tabBtn = document.getElementById("channelTab");
        const name   = tabBtn?.getAttribute("data-name") || "";
        if (this.currentChannelId) this.openChannel(this.currentChannelId, name, true);
    }

    switchToChannelTab() {
        document.querySelectorAll(".nav-tabs .tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        const tabBtn = document.getElementById("channelTab");
        tabBtn?.classList.add("active");
        document.querySelectorAll(".tab-content").forEach(sec => {
            if (sec.id === "channelTab") sec.classList.add("active");
        });
    }

    // ── Render ───────────────────────────────────────────────
    renderItems(items, grid, idSet, isSearch = false) {
        const noAnim = !Storage.get("cardAnimEnabled", true);
        items.forEach(item => {
            const key = item.type === "channel" ? item.channelId : item.videoId;
            if (!key || idSet.has(key)) return;
            idSet.add(key);

            const card = this.buildCard(item, idSet, isSearch, noAnim);
            if (card) grid.appendChild(card);
        });
    }

    // 【FIX】Improved Live/Short Detection Logic
    buildCard(item, idSet, isSearch, noAnim) {
        const card = document.createElement("div");
        card.className = "video-card" + (noAnim ? " no-anim" : "");

        if (item.type === "channel") {
            card.dataset.type = "channel";
            card.innerHTML = `
                <div class="thumbnail-wrapper" style="aspect-ratio:1/1; max-width:120px; margin:18px auto 0; border-radius:50%; border:2px solid var(--accent); overflow:hidden;">
                    <img src="${item.thumbnail}" onerror="this.src='https://placehold.co/120?text=CH'" loading="lazy">
                </div>
                <div class="card-info" style="text-align:center;">
                    <div class="card-title">${YouTubeManager.esc(item.title)}</div>
                    <div class="card-meta">${YouTubeManager.esc(item.publishedText || "Channel")}</div>
                </div>
            `;
            card.onclick = () => this.openChannel(item.channelId, item.title);
            return card;
        }

        // --- Data attributes (views, date) ---
        let rawViews = 0;
        if (item.viewCount) {
            rawViews = parseInt(item.viewCount, 10);
        } else if (item.views) {
            rawViews = parseInt(String(item.views).replace(/[^0-9]/g, ''), 10) || 0;
        }
        card.dataset.views = rawViews;
        card.dataset.date  = item.uploadDate || item.publishedText || "0";

        // --- Type detection (video / short / live) - IMPROVED ---
        let type = "video";
        
        // Check for Short videos
        const isShort = !!item.isShort || 
                       (item.duration && 
                        item.duration.includes(":") &&
                        (() => {
                            const parts = item.duration.split(":");
                            if (parts.length === 2) {
                                const mins = parseInt(parts[0], 10) || 0;
                                const secs = parseInt(parts[1], 10) || 0;
                                return mins === 0 && secs > 0 && secs <= 60;
                            }
                            return false;
                        })());
        
        // Check for Live videos
        const pubText = String(item.publishedText || "").toLowerCase();
        const durationStr = String(item.duration || "").toUpperCase();
        const isLive = !!item.isLive || 
                      pubText.includes("live") || 
                      durationStr.includes("LIVE") ||
                      pubText.includes("now") ||
                      item.isLiveArchive === true;
        
        if (isShort) {
            type = "short";
        } else if (isLive) {
            type = "live";
        }
        card.dataset.type = type;

        const canClick = item.channel && item.channel !== "Unknown" && item.channel !== "Channel Video";
        const isFav    = FavoritesManager.isFav(item.videoId);

        card.innerHTML = `
            <div class="thumbnail-wrapper">
                <img src="${item.thumbnail}" alt="" loading="lazy" onerror="this.src='https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg'">
                ${type === "short" ? '<span class="badge shorts-badge">SHORTS</span>' : ""}
                ${type === "live" ? '<span class="badge live-badge" style="background:#e54848 !important;">LIVE</span>' : ""}
                ${item.duration && type !== "live" ? `<span class="duration-badge">${item.duration}</span>` : ""}
                <div class="card-fav-dot${isFav?" active":""}" data-id="${item.videoId}">Fav</div>
                <div class="card-overlay">
                    <button class="overlay-btn play-btn" title="Play">Play</button>
                    <button class="overlay-btn queue-btn" title="Queue">Queue</button>
                    <button class="overlay-btn fav-btn" title="Favorites">${isFav?"Fav":"Add"}</button>
                </div>
            </div>
            <div class="card-info">
                <div class="card-title" title="${YouTubeManager.esc(item.title)}">${YouTubeManager.esc(item.title)}</div>
                <div class="card-channel${canClick?" clickable":""}">${YouTubeManager.esc(item.channel||"")}</div>
                <div class="card-meta">${YouTubeManager.esc(item.publishedText||"")}</div>
            </div>
        `;

        if (canClick) {
            card.querySelector(".card-channel").onclick = (e) => {
                e.stopPropagation();
                const name = item.channel;
                const q = item.channelId ? item.channelId : (name.startsWith("@") ? name : `@${name}`);
                document.getElementById("searchInput").value = name;
                this.currentChannelTab = "videos";
                this.resetSubTabUI();
                this.openChannel(q, name);
            };
        }

        card.querySelector(".play-btn").onclick  = (e) => { e.stopPropagation(); WindowManager.createWindow(item.videoId, item.title); };
        card.querySelector(".queue-btn").onclick = (e) => { e.stopPropagation(); QueueManager.add({ id:item.videoId, title:item.title, channel:item.channel||"" }); };
        card.querySelector(".fav-btn").onclick   = (e) => {
            e.stopPropagation();
            FavoritesManager.toggle({ id:item.videoId, title:item.title });
            const btn = e.target;
            btn.textContent = FavoritesManager.isFav(item.videoId) ? "Fav" : "Add";
        };

        card.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            ContextMenu.show(e.clientX, e.clientY, { videoId:item.videoId, title:item.title, channel:item.channel||"" });
        });

        card.onclick = () => WindowManager.createWindow(item.videoId, item.title);
        return card;
    }
}

// =============================================================
//  DEBUG MANAGER
// =============================================================
class DebugManager {
    static init() {
        const header  = document.getElementById("debugHeader");
        const btn     = document.getElementById("debugToggleBtn");
        const reload  = document.getElementById("dbBtnReloadStorage");

        if (header) {
            header.onclick = () => {
                const panel = document.getElementById("debugPanel");
                panel?.classList.toggle("collapsed");
                if (btn) btn.textContent = panel?.classList.contains("collapsed") ? "+" : "-";
            };
        }

        reload?.addEventListener("click", () => {
            const pre = document.getElementById("debugStorageJson");
            if (!pre) return;
            const snap = {
                favorites: Storage.get("favorites",[]).length,
                history:   Storage.get("history",[]).length,
                queue:     Storage.get("queue",[]).length,
                theme:     Storage.get("theme","midnight"),
            };
            pre.textContent = JSON.stringify(snap, null, 2);
        });
    }

    static async fetch(url) {
        const box = document.getElementById("debugNetLogs");
        const item = document.createElement("div");
        item.className = "debug-log-item";
        item.textContent = `-> ${url.replace(WORKER_URL,"").substring(0,50)}`;
        box?.appendChild(item);
        if (box && box.children.length > 30) box.firstChild.remove();
        try {
            const r = await fetch(url);
            const d = await r.json();
            item.textContent += " OK";
            item.classList.add("ok");
            return d;
        } catch(e) {
            item.textContent += " ERR";
            item.classList.add("err");
            return null;
        }
    }

    static updateStats() {
        const wins = document.querySelectorAll(".pip-window").length;
        const fav   = Storage.get("favorites",[]).length;
        const queue = Storage.get("queue",[]).length;

        const set = (id, val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
        set("dbActiveWins", wins);
        set("dbFavCount",   fav);
        set("dbQueueLen",   queue);

        WindowManager._updateSidebar?.();
    }
}

// =============================================================
//  KEYBOARD MANAGER
// =============================================================
class KeyboardManager {
    static focused = -1;

    static init(yt) {
        document.addEventListener("keydown", e => {
            const tag = document.activeElement?.tagName;
            if (["INPUT","TEXTAREA","SELECT"].includes(tag)) {
                if (e.key === "Escape") document.activeElement.blur();
                return;
            }

            switch (e.key) {
                case "/":
                case "k":
                    e.preventDefault();
                    document.getElementById("searchInput")?.focus();
                    break;
                case "Escape": {
                    const wins = document.querySelectorAll(".pip-window");
                    if (wins.length) wins[wins.length-1].querySelector(".close-btn")?.click();
                    break;
                }
                case "ArrowRight":
                    document.getElementById("loadMoreBtn")?.click();
                    break;
                case "ArrowDown":
                    e.preventDefault(); this.navigate(1); break;
                case "ArrowUp":
                    e.preventDefault(); this.navigate(-1); break;
                case "Enter": {
                    const cards = this.getCards();
                    if (this.focused >= 0 && cards[this.focused]) cards[this.focused].click();
                    break;
                }
                case "q":
                case "Q": {
                    const cards = this.getCards();
                    if (this.focused >= 0 && cards[this.focused]) {
                        cards[this.focused].querySelector(".queue-btn")?.click();
                    }
                    break;
                }
                case "1": this.tab(0); break;
                case "2": this.tab(1); break;
                case "3": this.tab(2); break;
                case "4": this.tab(3); break;
                case "5": this.tab(4); break;
                case "6": this.tab(5); break;
            }
        });
    }

    static getCards() {
        const active = document.querySelector(".tab-content.active");
        return Array.from(active?.querySelectorAll(".video-card") || []);
    }

    static navigate(dir) {
        const cards = this.getCards();
        if (!cards.length) return;
        this.focused = Math.max(0, Math.min(cards.length-1, this.focused+dir));
        cards.forEach((c,i) => c.style.outline = i===this.focused ? "2px solid var(--accent)" : "");
        cards[this.focused].scrollIntoView({ behavior:"smooth", block:"center" });
    }

    static tab(n) {
        const tabs = document.querySelectorAll(".nav-tabs .tab");
        const visible = Array.from(tabs).filter(t => t.style.display !== "none");
        if (visible[n]) visible[n].click();
    }
}

// =============================================================
//  TAB MANAGER
// =============================================================
class TabManager {
    static init(yt) {
        document.querySelectorAll(".nav-tabs .tab").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".nav-tabs .tab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
                tab.classList.add("active");

                const map = {
                    search:   "searchTab",
                    trending: "trendingTab",
                    queue:    "queueTab",
                    favorites:"favoritesTab",
                    history:  "historyTab",
                    settings: "settingsTab",
                    channel:  "channelTab",
                };
                const target = map[tab.dataset.tab] || (tab.id === "channelTab" ? "channelTab" : null);
                if (target) document.getElementById(target)?.classList.add("active");

                if (tab.dataset.tab === "trending") yt.loadTrending();
                if (tab.dataset.tab === "queue")     QueueManager.render();
                if (tab.dataset.tab === "favorites") FavoritesManager.render();
                if (tab.dataset.tab === "history")   HistoryManager.render();
            });
        });
    }
}

// =============================================================
//  INIT
// =============================================================
document.addEventListener("DOMContentLoaded", () => {
    const yt = new YouTubeManager();

    ThemeManager.init();
    TabManager.init(yt);
    yt.initSuggest();
    yt.initFilterPills();
    KeyboardManager.init(yt);
    ContextMenu.init();
    DebugManager.init();

    new WaveEngine();
    new ParticleEngine();

    document.querySelectorAll(".trending-category-pills .pill").forEach(p => {
        p.addEventListener("click", () => {
            document.querySelectorAll(".trending-category-pills .pill").forEach(x => x.classList.remove("active"));
            p.classList.add("active");
            yt.trendingLoaded = false;
            yt.loadTrending(p.dataset.trend);
        });
    });

    document.getElementById("channelVideosSubTab")?.addEventListener("click", () => yt.switchSubTab("videos"));
    document.getElementById("channelShortsSubTab")?.addEventListener("click", () => yt.switchSubTab("shorts"));

    document.getElementById("searchBtn")?.addEventListener("click", () => yt.search());
    document.getElementById("searchInput")?.addEventListener("keydown", e => {
        if (e.key === "Enter") yt.search();
    });

    document.getElementById("loadMoreBtn")?.addEventListener("click", () => yt.search(true));
    document.getElementById("channelLoadMoreBtn")?.addEventListener("click", () => yt.loadMoreChannel());

    document.getElementById("clearQueueBtn")?.addEventListener("click",   () => QueueManager.clear());
    document.getElementById("shuffleQueueBtn")?.addEventListener("click", () => QueueManager.shuffle());
    document.getElementById("playAllBtn")?.addEventListener("click",      () => QueueManager.playAll());

    document.getElementById("clearHistoryBtn")?.addEventListener("click", () => HistoryManager.clearAll());
    document.getElementById("historySearch")?.addEventListener("input", e => HistoryManager.render(e.target.value));

    document.getElementById("favSortSelect")?.addEventListener("change", () => FavoritesManager.render());

    document.getElementById("windowSizeSelect")?.addEventListener("change", e => Storage.set("windowSize", e.target.value));
    document.getElementById("maxWindowsSelect")?.addEventListener("change", e => Storage.set("maxWindows", e.target.value));

    document.getElementById("autoplayToggle")?.addEventListener("change", e => Storage.set("autoplayEnabled", e.target.checked));

    // Sort functionality with improved filtering
    document.querySelectorAll(".sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".sort-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const grid = document.getElementById("searchResultsGrid");
            if (!grid) return;
            const cards = Array.from(grid.querySelectorAll(".video-card"));
            const sortType = btn.dataset.sort;

            if (sortType === "default") {
                Toast.show("Refresh search to re-sort");
                return;
            }

            cards.sort((a, b) => {
                if (sortType === "views") {
                    const viewsA = parseInt(a.dataset.views || 0, 10);
                    const viewsB = parseInt(b.dataset.views || 0, 10);
                    return viewsB - viewsA;
                } else if (sortType === "date") {
                    const dateA = a.dataset.date || "0";
                    const dateB = b.dataset.date || "0";
                    return dateB.localeCompare(dateA);
                }
                return 0;
            });

            grid.innerHTML = "";
            cards.forEach(card => grid.appendChild(card));
            Toast.show(`Sorted: ${btn.textContent}`, "success");
        });
    });

    FavoritesManager.render();
    HistoryManager.render();
    QueueManager.render();
    DebugManager.updateStats();
    Translator.init();

    const winSizeSel = document.getElementById("windowSizeSelect");
    const maxWinSel  = document.getElementById("maxWindowsSelect");
    const autoSel    = document.getElementById("autoplayToggle");
    if (winSizeSel)  winSizeSel.value  = Storage.get("windowSize", "medium");
    if (maxWinSel)   maxWinSel.value   = Storage.get("maxWindows", 5);
    if (autoSel)     autoSel.checked   = Storage.get("autoplayEnabled", true);
    
    const waveCanvas = document.getElementById("waveCanvas");
    const particleCanvas = document.getElementById("particleCanvas");
    if (waveCanvas && !Storage.get("waveEnabled",true)) waveCanvas.style.display="none";
    if (particleCanvas && !Storage.get("particleEnabled",true)) particleCanvas.style.display="none";

    Toast.show("Midnight Loaded", "success");
});
