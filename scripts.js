// =============================================================
//   Midnight YouTube V10 — scripts.js (Private Edition)
//   - Icon-only UI (no emojis)
//   - Privacy: all data localStorage only, Incognito mode, export/import
//   - Stability: dedup via Set, fetch timeout+retry, throttled scroll,
//     unified Shorts/Live classification, memory-safe drag/touch
//   - Features: WatchLater, Resume, Notes, Tags, Collections, ChannelMute,
//     SmartSearch, QuickActions, SessionRestore
// =============================================================

"use strict";

const WORKER_URL = "https://silent-mouse-5878.78q38gs6.workers.dev/";
const APP_VERSION = "10.0";

//about:blank()
function aboutblank() {
        let url = window.location.href;
        var w = window.open("about:blank", "_blank");
        w.document.write(
          '<iframe style="position: absolute;top: 0px;bottom: 0px;right: 0px;width: 100%;border: none;margin: 0;padding: 0;overflow: hidden;z-index: 99999;height: 100%;" src="' +
            url +
            '"></iframe>',
        );
        w.document.close();
      }

// ---------- Icon helper ----------
function icon(name, extraClass = "") {
    return `<svg class="icon ${extraClass}"><use href="#icon-${name}"/></svg>`;
}
function escapeHtml(str) {
    return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function formatSeconds(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
        ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
        : `${m}:${String(s).padStart(2, "0")}`;
}
function parseDurationToSec(d) {
    if (!d || typeof d !== "string") return 0;
    const p = d.split(":").map(n => parseInt(n, 10) || 0);
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] || 0;
}

// ---------- Storage ----------
class Storage {
    static get(key, fallback = null) {
        try {
            const v = localStorage.getItem(key);
            return v !== null ? JSON.parse(v) : fallback;
        } catch { return fallback; }
    }
    static set(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {
            console.warn("Storage.set failed:", e);
        }
    }
    static remove(key) { try { localStorage.removeItem(key); } catch {} }
    static dump() {
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            try { out[k] = JSON.parse(localStorage.getItem(k)); }
            catch { out[k] = localStorage.getItem(k); }
        }
        return out;
    }
}

// ---------- Privacy (Incognito) ----------
class Privacy {
    static get incognito()      { return !!Storage.get("incognito", false); }
    static get historyEnabled() { return !this.incognito && Storage.get("historyEnabled", true) !== false; }
    static get resumeEnabled()  { return !this.incognito && Storage.get("resumeMode", "auto") !== "off"; }
    static get resumeMode()     { return this.incognito ? "off" : Storage.get("resumeMode", "auto"); }
    static get sessionMode()    { return this.incognito ? "off" : Storage.get("sessionMode", "ask"); }

    static setIncognito(on) {
        Storage.set("incognito", !!on);
        const badge = document.getElementById("incognitoBadge");
        if (badge) badge.classList.toggle("visible", !!on);
        Toast.show(Translator.t(on ? "toast_incognito_on" : "toast_incognito_off"), on ? "warning" : "success");
    }

    static initBadge() {
        const badge = document.getElementById("incognitoBadge");
        if (badge) badge.classList.toggle("visible", this.incognito);
    }

    /** Export all app data as JSON */
    static exportAll() {
        const blob = new Blob([JSON.stringify(Storage.dump(), null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `midnight-export-${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Toast.show(Translator.t("toast_export_done"), "success");
    }

    static async importAll(file) {
        try {
            const text = await file.text();
            const obj = JSON.parse(text);
            if (!obj || typeof obj !== "object") throw new Error("invalid");
            Object.entries(obj).forEach(([k, v]) => Storage.set(k, v));
            Toast.show(Translator.t("toast_import_done"), "success");
            setTimeout(() => location.reload(), 800);
        } catch {
            Toast.show(Translator.t("toast_import_error"), "danger");
        }
    }
}

// ---------- Toast ----------
class Toast {
    static show(message, type = "default", duration = 1800) {
        const container = document.getElementById("toastContainer");
        if (!container) return;
        const iconMap = { success: "check", warning: "warning", danger: "error", default: "info" };
        const t = document.createElement("div");
        t.className = `toast${type !== "default" ? " " + type : ""}`;
        t.innerHTML = `${icon(iconMap[type] || "info", "icon-sm")}<span>${escapeHtml(message)}</span>`;
        container.appendChild(t);
        setTimeout(() => {
            t.style.transition = "opacity .3s, transform .3s";
            t.style.opacity = "0";
            t.style.transform = "translateX(-10px)";
            setTimeout(() => t.remove(), 320);
        }, duration);
    }
}

// ---------- Theme ----------
class ThemeManager {
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

        if (themeSelect)    themeSelect.value = saved.theme;
        if (accentPicker)   accentPicker.value = saved.accent;
        if (accentLabel)    accentLabel.textContent = saved.accent;
        if (debugToggle)    debugToggle.checked = saved.hideDbg;
        if (waveToggle)     waveToggle.checked = saved.wave;
        if (particleToggle) particleToggle.checked = saved.particle;
        if (cardAnimToggle) cardAnimToggle.checked = saved.cardAnim;

        this.apply(saved.theme, saved.accent);
        this.toggleDebug(!saved.hideDbg);

        themeSelect?.addEventListener("change", () => {
            this.apply(themeSelect.value, accentPicker.value);
            Storage.set("theme", themeSelect.value);
            Toast.show(`${Translator.t("toast_theme_changed")}${themeSelect.value}`, "success");
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
            const c = document.getElementById("waveCanvas");
            if (c) c.style.display = e.target.checked ? "block" : "none";
        });
        particleToggle?.addEventListener("change", (e) => {
            Storage.set("particleEnabled", e.target.checked);
            const c = document.getElementById("particleCanvas");
            if (c) c.style.display = e.target.checked ? "block" : "none";
        });
        cardAnimToggle?.addEventListener("change", (e) => {
            Storage.set("cardAnimEnabled", e.target.checked);
            document.querySelectorAll(".video-card").forEach(c => c.classList.toggle("no-anim", !e.target.checked));
        });

        resetBtn?.addEventListener("click", () => {
            if (!confirm(Translator.t("confirm_reset"))) return;
            try { localStorage.clear(); } catch {}
            Toast.show(Translator.t("toast_reset_success"), "danger");
            setTimeout(() => location.reload(), 800);
        });
    }

    static apply(theme, accentColor = "#7c5cff") {
        document.body.className = `theme-${theme}`;
        const root = document.documentElement;
        root.style.setProperty("--accent", accentColor);
        root.style.setProperty("--accent2", this.lighten(accentColor, 28));
        root.style.setProperty("--accent-glow", this.hexToRgba(accentColor, 0.22));

        let style = document.getElementById("dyn-accent");
        if (!style) {
            style = document.createElement("style");
            style.id = "dyn-accent";
            document.head.appendChild(style);
        }
        style.textContent = `:root{--accent:${accentColor}!important;--accent2:${this.lighten(accentColor,28)}!important;--accent-glow:${this.hexToRgba(accentColor,0.22)}!important;}`;
    }
    static lighten(hex, pct) {
        if (!hex || hex.length < 7) return hex;
        let r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        r = Math.min(255, r + Math.round((255-r)*pct/100));
        g = Math.min(255, g + Math.round((255-g)*pct/100));
        b = Math.min(255, b + Math.round((255-b)*pct/100));
        return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
    }
    static hexToRgba(hex, a) {
        if (!hex || hex.length < 7) return `rgba(124,92,255,${a})`;
        const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
        return `rgba(${r},${g},${b},${a})`;
    }
    static toggleDebug(show) {
        const panel = document.getElementById("debugPanel");
        if (panel) panel.style.display = show ? "flex" : "none";
    }
}

// ---------- Wave / Particle (memory-safe) ----------
class WaveEngine {
    constructor() {
        this.canvas = document.getElementById("waveCanvas");
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext("2d");
        this.phase = 0;
        this.enabled = Storage.get("waveEnabled", true);
        this.running = false;
        
        // HBL用のパーティクル配列
        this.particles = [];
        
        if (!this.enabled) { this.canvas.style.display = "none"; return; }
        this._resize = () => this.resize();
        window.addEventListener("resize", this._resize, { passive: true });
        this.resize();
        this.running = true;
        requestAnimationFrame(this.loop);
    }
    
    resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.canvas.style.width = window.innerWidth + "px";
        this.canvas.style.height = window.innerHeight + "px";
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    
    updateHBLParticles(w, h) {
        const maxParticles = Math.floor((w * h) / 12000);
        if (this.particles.length < maxParticles && Math.random() < 0.15) {
            this.particles.push({
                x: Math.random() * w,
                y: h + 40,
                size: 15 + Math.random() * 30,
                speed: 0.3 + Math.random() * 0.6,
                opacity: 0.08 + Math.random() * 0.15,
                angle: Math.random() * Math.PI
            });
        }

        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.y -= p.speed;
            if (p.y < -p.size) {
                this.particles.splice(i, 1);
                continue;
            }
            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate(p.angle);
            // 実機写真の、少し黄色がかった明るい光の四角形
            this.ctx.fillStyle = `rgba(225, 255, 235, ${p.opacity})`;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();
        }
    }

    loop = () => {
        if (!this.running || !this.canvas) return;
        const w = window.innerWidth, h = window.innerHeight;
        this.ctx.clearRect(0, 0, w, h);
        this.phase += 0.01;

        const isHBL = document.body.classList.contains("theme-hbl");
        const rainbow = document.body.classList.contains("theme-rainbow");

        // --- 1. HBL専用のパーティクル（背景より手前に描画） ---
        if (isHBL) {
            this.updateHBLParticles(w, h);
        } else {
            if (this.particles.length > 0) this.particles = [];
        }

        // --- 2. 波と背景の描画 ---
        if (isHBL) {
            // 【HBL専用】
            // ① まず画面全体を「下の明るい水色」で塗りつぶす
            this.ctx.fillStyle = "#26ccf1"; 
            this.ctx.fillRect(0, 0, w, h);

            // ② 1層だけの波のパスを作る
            this.ctx.beginPath();
            const amp = 50; // 波の揺れ幅
            const baseY = h * 0.30; // 波の位置（画面の上寄りに配置）
            
            for (let x = 0; x <= w; x += 8) {
                // 実機のような緩やかな1本の波
                const y = baseY + Math.sin(x * 0.005 + this.phase * 0.6) * amp;
                x === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
            }

            // ③ 波の「上側」を濃い青緑で塗りつぶす
            this.ctx.save();
            this.ctx.lineTo(w, 0); 
            this.ctx.lineTo(0, 0);
            this.ctx.closePath();
            this.ctx.fillStyle = "#0095D9"; // 上画面の濃い青緑
            this.ctx.fill();
            this.ctx.restore();

            // ④ 境界線（太くて濃いエメラルドグリーンの枠線）を描く
            this.ctx.beginPath();
            for (let x = 0; x <= w; x += 8) {
                const y = baseY + Math.sin(x * 0.005 + this.phase * 0.6) * amp;
                x === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
            }
            this.ctx.strokeStyle = "#00A2E8"; // 濃いエメラルドグリーンの枠線
            this.ctx.lineWidth = 4; // 線をはっきり太く
            this.ctx.shadowBlur = 4; // ほんのり光沢
            this.ctx.shadowColor = "#ffffff";
            this.ctx.stroke();
            this.ctx.shadowBlur = 0; // シャドウをリセット

        } else {
            // 【通常のテーマ処理（midnight, cyber, rainbowなど従来通り）】
            const accent = getComputedStyle(document.body).getPropertyValue("--accent").trim() || "#7c5cff";
            const rgb = this.hexToRgb(accent);

            for (let layer = 0; layer < 3; layer++) {
                this.ctx.beginPath();
                const amp = 24 + layer * 20, speed = 0.5 + layer * 0.25;
                const baseY = h * (0.60 + layer * 0.06);
                
                for (let x = 0; x <= w; x += 8) {
                    const y = baseY + Math.sin(x * 0.006 + this.phase * speed) * amp
                                    + Math.sin(x * 0.012 + this.phase * speed * 0.7) * (amp * 0.4);
                    x === 0 ? this.ctx.moveTo(x, y) : this.ctx.lineTo(x, y);
                }
                
                this.ctx.lineTo(w, h); this.ctx.lineTo(0, h);
                this.ctx.closePath();

                if (rainbow) {
                    const hue = (this.phase * 25 + layer * 50) % 360;
                    this.ctx.fillStyle = `hsla(${hue},100%,65%,${0.06 + layer*0.04})`;
                } else {
                    this.ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},${0.05 + layer*0.035})`;
                }
                this.ctx.fill();
            }
        }

        requestAnimationFrame(this.loop);
    }
    
    hexToRgb(hex) {
        if (!hex) return { r:124, g:92, b:255 };
        hex = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (_, r, g, b) => r+r+g+g+b+b);
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r:parseInt(m[1],16), g:parseInt(m[2],16), b:parseInt(m[3],16) } : { r:124, g:92, b:255 };
    }
    
    destroy() { this.running = false; window.removeEventListener("resize", this._resize); }
}

class ParticleEngine {
    constructor() {
        this.container = document.getElementById("particleCanvas");
        if (!this.container) return;

        this.enabled = Storage.get("particleEnabled", true);

        if (!this.enabled) {
            this.container.style.display = "none";
            return;
        }

        const isHBL = document.body.classList.contains("theme-hbl");

        this.particles = [];
        this.max = isHBL ? 80 : 24; // 実機に合わせて少し軽めの密度に調整（お好みで増やせます）

        this.timer = setInterval(
            () => this.spawn(),
            isHBL ? 120 : 300 // 湧き出る間隔を少しゆったりにして優雅に
        );
    }

    spawn() {
        if (!this.enabled || !this.container) return;
        if (this.particles.length >= this.max) return;

        const isHBL = document.body.classList.contains("theme-hbl");
        const p = document.createElement("div");

        // 実機っぽいサイズ設定（大きいものから小さいものまで）
        const size = isHBL
            ? 16 + Math.random() * 36
            : 2 + Math.random() * 3;

        // ゆったりと遅い速度で下から上へ移動させる
        const duration = isHBL
            ? 2 + Math.random() * 3
            : 4 + Math.random() * 1.5;

        // 実機の「半透明で優しい光」を再現
        const opacity = isHBL
            ? 0.2 + Math.random() * 0.4
            : 5;
        const x = Math.random() * 100;
        const delay = Math.random();

        // HBLの時は回転させず水平を維持、アニメーションを専用の「hblFloat」に切り替え
        p.style.cssText = `
            position:absolute;
            left:${x}%;
            bottom:-60px;

            width:${size}px;
            height:${size}px;

            border-radius:${isHBL ? "0" : "50%"};

            background:${
                isHBL
                    ? "rgba(230, 255, 245, " + opacity + ")"
                    : "var(--accent)"
            };

            opacity:0;
            pointer-events:none;
            animation:${isHBL ? 'hblFloat' : 'particleFloat'} ${duration}s ${delay}s linear forwards;

            box-shadow:${
                isHBL
                    ? "none" /* 実機はボケていないシャープな四角形なのでグローはなし */
                    : "0 0 " + size + "px var(--accent)"
            };
        `;

        this.container.appendChild(p);
        this.particles.push(p);

        setTimeout(() => {
            p.remove();
            this.particles = this.particles.filter(x => x !== p);
        }, (duration + delay) * 1000);
    }
}

// inject keyframes once (HBL専用の滑らかな浮上アニメーションを追加)
(function injectParticleKeyframes() {
    const s = document.createElement("style");
    s.textContent = `
    @keyframes particleFloat {
        0% { transform:translateY(0) scale(0); opacity:0; }
        10% { opacity:.7; transform:translateY(-20px) scale(1); }
        90% { opacity:.3; }
        100% { transform:translateY(-100vh) scale(0.5); opacity:0; }
    }
    /* 【HBL専用】まっすぐ形を保ったままフェードイン・アウトして上昇 */
    @keyframes hblFloat {
        0% { transform:translateY(0); opacity:0; }
        15% { opacity:1; }
        85% { opacity:1; }
        100% { transform:translateY(-110vh); opacity:0; }
    }`;
    document.head.appendChild(s);
})();

// ---------- Unified video classification ----------
function classifyItem(item) {
    if (!item) return { type: "video", isShort: false, isLive: false };
    const title = String(item.title || "").toLowerCase();
    const isVerticalTag = !!item.isShort || /#shorts|#ショート|ショート動画|#縦型|#short/i.test(title);
    let isShortByDuration = false;
    if (item.duration) {
        const sec = parseDurationToSec(item.duration);
        if (sec > 0 && sec <= 150) isShortByDuration = true;
    }
    const isShort = isVerticalTag || isShortByDuration;
    const isLive = !!item.isLive
        || /ライブ|live now/i.test(String(item.publishedText || ""))
        || /LIVE/i.test(String(item.duration || ""));
    let type = "video";
    if (isShort) type = "short";
    else if (isLive) type = "live";
    return { type, isShort, isLive };
}

// ---------- Safe fetch (timeout + retry) ----------
async function safeFetch(url, { timeout = 12000, retries = 2 } = {}) {
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeout);
        try {
            const r = await fetch(url, { signal: ctrl.signal, referrerPolicy: "no-referrer" });
            clearTimeout(tid);
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return await r.json();
        } catch (e) {
            clearTimeout(tid);
            lastErr = e;
            if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        }
    }
    throw lastErr;
}

// ---------- Smart search parser ----------
class SmartSearch {
    // input: "shorts cat", "live minecraft", "music >10m", "channel:hololive"
    static parse(query) {
        let q = String(query || "").trim();
        const filters = { type: null, channel: null, minSec: null, maxSec: null };
        // type prefix
        if (/^shorts?\s+/i.test(q))   { filters.type = "short"; q = q.replace(/^shorts?\s+/i, ""); }
        else if (/^live\s+/i.test(q)) { filters.type = "live";  q = q.replace(/^live\s+/i, ""); }
        // channel:name
        const ch = q.match(/(?:^|\s)channel:(\S+)/i);
        if (ch) { filters.channel = ch[1]; q = q.replace(ch[0], "").trim(); }
        // duration >Xm / <Xm
        const gt = q.match(/(?:^|\s)>(\d+)m\b/i);
        if (gt) { filters.minSec = parseInt(gt[1], 10) * 60; q = q.replace(gt[0], "").trim(); }
        const lt = q.match(/(?:^|\s)<(\d+)m\b/i);
        if (lt) { filters.maxSec = parseInt(lt[1], 10) * 60; q = q.replace(lt[0], "").trim(); }
        return { q: q.trim(), filters };
    }

    static matchesFilters(item, filters) {
        if (!filters) return true;
        const cls = classifyItem(item);
        if (filters.type === "short" && !cls.isShort) return false;
        if (filters.type === "live"  && !cls.isLive)  return false;
        if (filters.channel) {
            const cName = String(item.channel || "").toLowerCase();
            if (!cName.includes(filters.channel.toLowerCase())) return false;
        }
        if (filters.minSec || filters.maxSec) {
            const sec = parseDurationToSec(item.duration);
            if (filters.minSec && sec < filters.minSec) return false;
            if (filters.maxSec && sec > filters.maxSec) return false;
        }
        return true;
    }
}

// ---------- Channel Mute ----------
class ChannelMute {
    static set = new Set(Storage.get("channelMute", []));
    static save() { Storage.set("channelMute", [...this.set]); }
    static isMuted(channel) {
        if (!channel) return false;
        return this.set.has(String(channel).toLowerCase());
    }
    static toggle(channel) {
        if (!channel) return;
        const k = String(channel).toLowerCase();
        if (this.set.has(k)) {
            this.set.delete(k);
            Toast.show(Translator.t("toast_channel_unmuted"), "success");
        } else {
            this.set.add(k);
            Toast.show(Translator.t("toast_channel_muted"), "warning");
        }
        this.save();
        // immediately hide muted cards
        document.querySelectorAll(".video-card").forEach(c => {
            const ch = c.dataset.channel?.toLowerCase();
            if (ch === k) c.style.display = this.set.has(k) ? "none" : "";
        });
    }
}

// ---------- Search Cache ----------
class SearchCache {
    static cache = new Map();
    static maxSize = 40;
    static ttl = 5 * 60 * 1000;
    static key(q, filter) { return `${q}::${filter}`; }
    static get(q, filter) {
        const e = this.cache.get(this.key(q, filter));
        if (!e) return null;
        if (Date.now() - e.t > this.ttl) { this.cache.delete(this.key(q, filter)); return null; }
        return e.data;
    }
    static set(q, filter, data) {
        if (this.cache.size >= this.maxSize) this.cache.delete(this.cache.keys().next().value);
        this.cache.set(this.key(q, filter), { data, t: Date.now() });
    }
    static size() { return this.cache.size; }
}

// ---------- Watch Later ----------
class WatchLater {
    static list = Storage.get("watchLater", []);
    static save() { Storage.set("watchLater", this.list); this.updateBadge(); }
    static add(item) {
        if (this.list.find(v => v.id === item.id)) {
            Toast.show(Translator.t("toast_wl_exists"), "warning"); return;
        }
        this.list.unshift({ id: item.id, title: item.title, channel: item.channel || "", addedAt: Date.now() });
        this.save();
        Toast.show(Translator.t("toast_wl_added"), "success");
        this.render();
    }
    static remove(id) {
        this.list = this.list.filter(v => v.id !== id);
        this.save(); this.render();
        Toast.show(Translator.t("toast_wl_removed"));
    }
    static clear() {
        if (!confirm(Translator.t("confirm_wl_clear"))) return;
        this.list = []; this.save(); this.render();
    }
    static playAll() {
        if (!this.list.length) { Toast.show(Translator.t("empty_watchlater"), "warning"); return; }
        this.list.forEach((it, i) => setTimeout(() => WindowManager.createWindow(it.id, it.title), i * 700));
    }
    static updateBadge() {
        const b = document.getElementById("watchLaterBadge");
        if (b) b.textContent = this.list.length;
    }
    static render() {
        const grid = document.getElementById("watchLaterGrid");
        if (!grid) return;
        grid.innerHTML = "";
        if (!this.list.length) {
            grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("empty_watchlater"))}</div>`;
            return;
        }
        this.list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy" decoding="async" alt="">
                    <div class="card-overlay">
                        <button class="overlay-btn wl-play" title="${escapeHtml(Translator.t("btn_play"))}">${icon("play")}</button>
                        <button class="overlay-btn wl-remove" title="${escapeHtml(Translator.t("btn_remove"))}">${icon("trash")}</button>
                    </div>
                </div>
                <div class="card-info">
                    <div class="card-title">${escapeHtml(item.title)}</div>
                    <div class="card-meta">${icon("clock", "icon-xs")} ${new Date(item.addedAt || 0).toLocaleDateString()}</div>
                </div>`;
            card.querySelector(".wl-play").onclick = (e) => { e.stopPropagation(); WindowManager.createWindow(item.id, item.title); };
            card.querySelector(".wl-remove").onclick = (e) => { e.stopPropagation(); this.remove(item.id); };
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

// ---------- Resume (playback position) ----------
class Resume {
    /** position store: { [videoId]: { sec, dur, ts } } */
    static get store() { return Storage.get("resumePos", {}); }
    static save(videoId, sec, dur) {
        if (!Privacy.resumeEnabled || !videoId) return;
        if (sec < 5) return; // ignore tiny
        if (dur && sec > dur - 8) { this.clear(videoId); return; }
        const s = this.store;
        s[videoId] = { sec: Math.floor(sec), dur: Math.floor(dur || 0), ts: Date.now() };
        Storage.set("resumePos", s);
    }
    static get(videoId) { return this.store[videoId] || null; }
    static clear(videoId) {
        const s = this.store; delete s[videoId]; Storage.set("resumePos", s);
    }
    static async maybePrompt(videoId) {
        if (!Privacy.resumeEnabled) return 0;
        const r = this.get(videoId);
        if (!r) return 0;
        if (Privacy.resumeMode === "auto") return r.sec;
        if (Privacy.resumeMode === "ask") {
            if (confirm(Translator.tpl("confirm_resume_play", formatSeconds(r.sec)))) return r.sec;
            this.clear(videoId);
        }
        return 0;
    }
    /** Returns 0..1 watch progress for resume bar */
    static progress(videoId) {
        const r = this.get(videoId);
        if (!r || !r.dur) return 0;
        return Math.min(1, r.sec / r.dur);
    }
}

// ---------- Notes ----------
class Notes {
    static get all() { return Storage.get("notes", {}); }
    static get(videoId) { return this.all[videoId] || []; }
    static add(videoId) {
        const text = prompt(Translator.t("prompt_note"));
        if (text == null) return;
        const notes = this.all;
        const list = notes[videoId] || [];
        list.push({ text: String(text).trim(), ts: Date.now() });
        notes[videoId] = list;
        Storage.set("notes", notes);
        Toast.show(Translator.t("toast_note_saved"), "success");
    }
}

// ---------- Tags ----------
class Tags {
    static get all() { return Storage.get("tags", {}); }
    static get(videoId) { return this.all[videoId] || []; }
    static edit(videoId) {
        const existing = (this.get(videoId) || []).join(", ");
        const v = prompt(Translator.t("prompt_tag"), existing);
        if (v == null) return;
        const arr = v.split(",").map(s => s.trim()).filter(Boolean);
        const t = this.all;
        if (!arr.length) delete t[videoId]; else t[videoId] = arr;
        Storage.set("tags", t);
        Toast.show(Translator.t("toast_tag_saved"), "success");
    }
}

// ---------- Collections ----------
class Collections {
    static get list() { return Storage.get("collections", []); }
    static save(list) { Storage.set("collections", list); }
    static create() {
        const name = prompt(Translator.t("prompt_collection_name"));
        if (!name) return;
        const l = this.list;
        l.push({ id: "c_" + Date.now(), name: String(name).trim(), items: [] });
        this.save(l);
        Toast.show(Translator.t("toast_coll_created") + name, "success");
        this.render();
    }
    static addTo(collId, item) {
        const l = this.list; const c = l.find(x => x.id === collId);
        if (!c) return;
        if (c.items.find(v => v.id === item.id)) return;
        c.items.push({ id: item.id, title: item.title, channel: item.channel || "" });
        this.save(l); this.render();
    }
    static remove(collId) {
        const l = this.list.filter(c => c.id !== collId);
        this.save(l); this.render();
    }
    static render() {
        const el = document.getElementById("collectionsList");
        if (!el) return;
        const l = this.list;
        el.innerHTML = "";
        if (!l.length) {
            el.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("empty_collections"))}</div>`;
            return;
        }
        l.forEach(c => {
            const wrap = document.createElement("div");
            wrap.className = "setting-group";
            wrap.innerHTML = `
                <h4>${icon("folder")} ${escapeHtml(c.name)} <span class="tag-chip">${c.items.length}</span>
                    <button class="sort-btn danger" style="margin-left:auto;" data-act="del">${icon("trash", "icon-sm")}</button>
                </h4>
                <div class="results-grid" style="grid-template-columns:repeat(auto-fill, minmax(180px, 1fr));"></div>`;
            const grid = wrap.querySelector(".results-grid");
            c.items.forEach(it => {
                const card = document.createElement("div");
                card.className = "video-card";
                card.innerHTML = `
                    <div class="thumbnail-wrapper"><img src="https://i.ytimg.com/vi/${it.id}/mqdefault.jpg" loading="lazy" decoding="async" alt=""></div>
                    <div class="card-info"><div class="card-title">${escapeHtml(it.title)}</div></div>`;
                card.onclick = () => WindowManager.createWindow(it.id, it.title);
                grid.appendChild(card);
            });
            wrap.querySelector('[data-act="del"]').onclick = () => { if (confirm("Delete collection?")) this.remove(c.id); };
            el.appendChild(wrap);
        });
    }
}

// ---------- Queue ----------
class QueueManager {
    static queue = Storage.get("queue", []);

    static add(item) {
        if (this.queue.find(v => v.id === item.id)) {
            Toast.show(Translator.t("toast_queue_exists"), "warning"); return;
        }
        this.queue.push({ id: item.id, title: item.title, channel: item.channel || "" });
        this.save();
        Toast.show(Translator.t("toast_queue_added") + item.title.substring(0, 24), "success");
        this.render();
        DebugManager.updateStats();
    }
    static remove(id) {
        this.queue = this.queue.filter(v => v.id !== id);
        this.save(); this.render(); DebugManager.updateStats();
    }
    static clear() {
        this.queue = []; this.save(); this.render();
        Toast.show(Translator.t("toast_queue_cleared"));
        DebugManager.updateStats();
    }
    static shuffle() {
        for (let i = this.queue.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
        }
        this.save(); this.render();
        Toast.show(Translator.t("toast_queue_shuffled"));
    }
    static playAll() {
        if (!this.queue.length) { Toast.show(Translator.t("toast_queue_empty"), "warning"); return; }
        this.queue.forEach((it, i) => setTimeout(() => WindowManager.createWindow(it.id, it.title), i * 800));
    }
    static save() {
        Storage.set("queue", this.queue);
        const b = document.getElementById("queueBadge");
        if (b) b.textContent = this.queue.length;
    }
    static render() {
        const list = document.getElementById("queueList");
        if (!list) return;
        list.innerHTML = "";
        if (!this.queue.length) {
            list.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("empty_queue"))}</div>`;
            return;
        }
        this.queue.forEach((item, idx) => {
            const el = document.createElement("div");
            el.className = "queue-item";
            el.draggable = true;
            el.dataset.id = item.id;
            el.innerHTML = `
                <div class="queue-drag-handle">${icon("drag")}</div>
                <div class="q-num">${idx + 1}</div>
                <div class="queue-thumb"><img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy" decoding="async" alt=""></div>
                <div class="queue-info">
                    <div class="queue-title">${escapeHtml(item.title)}</div>
                    <div class="queue-channel">${escapeHtml(item.channel || "")}</div>
                </div>
                <button class="queue-remove" title="${escapeHtml(Translator.t("btn_remove"))}">${icon("close", "icon-sm")}</button>`;
            el.querySelector(".queue-remove").onclick = (e) => { e.stopPropagation(); this.remove(item.id); };
            el.onclick = () => WindowManager.createWindow(item.id, item.title);
            // drag reorder
            el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/id", item.id); el.style.opacity = "0.5"; });
            el.addEventListener("dragend", () => { el.style.opacity = ""; });
            el.addEventListener("dragover", (e) => { e.preventDefault(); });
            el.addEventListener("drop", (e) => {
                e.preventDefault();
                const fromId = e.dataTransfer.getData("text/id");
                if (!fromId || fromId === item.id) return;
                const fromIdx = this.queue.findIndex(v => v.id === fromId);
                const toIdx = this.queue.findIndex(v => v.id === item.id);
                if (fromIdx < 0 || toIdx < 0) return;
                const [moved] = this.queue.splice(fromIdx, 1);
                this.queue.splice(toIdx, 0, moved);
                this.save(); this.render();
            });
            list.appendChild(el);
        });
    }
}

// ---------- Favorites ----------
class FavoritesManager {
    static toggle(item) {
        let list = Storage.get("favorites", []);
        const idx = list.findIndex(v => v.id === item.id);
        if (idx > -1) {
            list.splice(idx, 1);
            Toast.show(Translator.t("toast_fav_removed"));
        } else {
            list.push({ id: item.id, title: item.title, channel: item.channel || "", addedAt: Date.now() });
            Toast.show(Translator.t("toast_fav_added"), "success");
        }
        Storage.set("favorites", list);
        this.render(); DebugManager.updateStats();
        document.querySelectorAll(".card-fav-dot").forEach(dot => {
            const id = dot.dataset.id;
            dot.classList.toggle("active", !!list.find(v => v.id === id));
        });
    }
    static isFav(id) { return !!Storage.get("favorites", []).find(v => v.id === id); }
    static render() {
        const grid = document.getElementById("favoritesGrid");
        const sortSel = document.getElementById("favSortSelect");
        if (!grid) return;
        let list = Storage.get("favorites", []);
        if (sortSel?.value === "alpha") list = [...list].sort((a,b) => a.title.localeCompare(b.title));
        grid.innerHTML = "";
        if (!list.length) {
            grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("empty_favorites"))}</div>`;
            return;
        }
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy" decoding="async" alt="">
                    <div class="card-overlay">
                        <button class="overlay-btn fav-play-btn" title="${escapeHtml(Translator.t("btn_play"))}">${icon("play")}</button>
                        <button class="overlay-btn fav-remove-btn" title="${escapeHtml(Translator.t("btn_remove"))}">${icon("close")}</button>
                    </div>
                </div>
                <div class="card-info">
                    <div class="card-title">${escapeHtml(item.title)}</div>
                    <div class="card-meta">${icon("clock","icon-xs")} ${new Date(item.addedAt || 0).toLocaleDateString()}</div>
                </div>`;
            card.querySelector(".fav-play-btn").onclick = (e) => { e.stopPropagation(); WindowManager.createWindow(item.id, item.title); };
            card.querySelector(".fav-remove-btn").onclick = (e) => { e.stopPropagation(); this.toggle(item); };
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

// ---------- History ----------
class HistoryManager {
    static add(item) {
        if (!Privacy.historyEnabled) return;
        let list = Storage.get("history", []);
        list = list.filter(v => v.id !== item.id);
        list.unshift({ id: item.id, title: item.title, channel: item.channel || "", ts: Date.now() });
        Storage.set("history", list.slice(0, 100));
        this.render();
    }
    static clearAll() {
        if (!confirm(Translator.t("confirm_hist_clear"))) return;
        Storage.set("history", []);
        this.render();
        Toast.show(Translator.t("toast_hist_cleared"), "danger");
    }
    static render(filter = "") {
        const grid = document.getElementById("historyGrid");
        if (!grid) return;
        let list = Storage.get("history", []);
        if (filter) {
            const f = filter.toLowerCase();
            list = list.filter(v => v.title.toLowerCase().includes(f));
        }
        grid.innerHTML = "";
        if (!list.length) {
            grid.innerHTML = `<div class="no-results">${escapeHtml(filter ? Translator.t("empty_history_search") : Translator.t("empty_history"))}</div>`;
            return;
        }
        list.forEach(item => {
            const card = document.createElement("div");
            card.className = "video-card";
            const dateStr = new Date(item.ts).toLocaleString(undefined, { month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit" });
            const prog = Resume.progress(item.id);
            card.innerHTML = `
                <div class="thumbnail-wrapper">
                    <img src="https://i.ytimg.com/vi/${item.id}/mqdefault.jpg" loading="lazy" decoding="async" alt="">
                    <div class="card-overlay">
                        <button class="overlay-btn">${icon("play")}</button>
                    </div>
                    ${prog > 0 ? `<div class="resume-bar"><span style="width:${prog*100}%"></span></div>` : ""}
                </div>
                <div class="card-info">
                    <div class="card-title">${escapeHtml(item.title)}</div>
                    <div class="card-meta">${icon("clock","icon-xs")} ${dateStr}</div>
                </div>`;
            card.onclick = () => WindowManager.createWindow(item.id, item.title);
            grid.appendChild(card);
        });
    }
}

// ---------- Windows (PiP) ----------
class WindowManager {
    static _winCount = 0;
    static _windows = new Map(); // key -> {el, videoId, title, pollId, listeners}

    static async createWindow(videoId, title) {
        if (!videoId) return;
        const workspace = document.getElementById("windowWorkspace");
        if (!workspace) return;

        const maxWins = parseInt(Storage.get("maxWindows", 5)) || Infinity;
        if (maxWins && this._windows.size >= maxWins) {
            const [firstKey, firstWin] = this._windows.entries().next().value;
            this._destroy(firstKey);
            Toast.show(Translator.t("toast_old_win_closed"), "warning");
        }

        this._winCount++;
        const sizes = { small:[400,260], medium:[520,330], large:[700,430] };
        const sizeKey = Storage.get("windowSize", "medium");
        const [W, H] = sizes[sizeKey] || sizes.medium;

        const autoplay = Storage.get("autoplayEnabled", true) ? 1 : 0;
        const resumeSec = await Resume.maybePrompt(videoId);

        const win = document.createElement("div");
        win.className = "pip-window";
        win.style.left = `${80 + (this._winCount * 30) % 300}px`;
        win.style.top = `${80 + (this._winCount * 30) % 200}px`;
        win.style.width = W + "px";
        win.style.height = H + "px";
        const key = videoId + "_" + this._winCount;


        const isFav = FavoritesManager.isFav(videoId);
        const params = new URLSearchParams({
            autoplay: String(autoplay),
            enablejsapi: "1",
            origin: location.origin,
            rel: "0",
            modestbranding: "1",
        });
        if (resumeSec > 0) params.set("start", String(resumeSec));
        const src = `https://www.youtube-nocookie.com/embed/${videoId}?origin=${location.origin}&${params.toString()}`;

        win.innerHTML = `
            <div class="pip-header">
                <span class="pip-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span>
                <div class="pip-controls">
                    <div class="pip-vol-wrap">${icon("volume","icon-sm")}<input type="range" class="pip-vol" min="0" max="100" value="100" title="vol"></div>
                    <button class="pip-custom-btn size-btn" data-size="small" title="S">S</button>
                    <button class="pip-custom-btn size-btn" data-size="medium" title="M">M</button>
                    <button class="pip-custom-btn size-btn" data-size="large" title="L">L</button>
                    <button class="pip-custom-btn fav-btn${isFav?' fav-active':''}" title="fav">${icon("star", isFav ? "filled" : "")}</button>
                    <button class="pip-custom-btn queue-btn" title="queue">${icon("queue", "icon-sm")}</button>
                    <button class="pip-custom-btn min-btn" title="min">${icon("minimize","icon-sm")}</button>
                    <button class="pip-custom-btn close-btn" title="close">${icon("close","icon-sm")}</button>
                </div>
            </div>
<div class="pip-body">
        <iframe src="${src}" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
    </div>
            <div class="pip-resizable-handle"></div>`;

        const iframe = win.querySelector("iframe");

        // Volume
        const volSlider = win.querySelector(".pip-vol");
        volSlider.addEventListener("input", (e) => {
            iframe.contentWindow?.postMessage(JSON.stringify({
                event: "command", func: "setVolume", args: [parseInt(e.target.value, 10), true]
            }), "*");
        });

        // Size buttons
        win.querySelectorAll(".size-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const [nW, nH] = sizes[btn.dataset.size] || sizes.medium;
                win.style.width = nW + "px";
                win.style.height = nH + "px";
            });
        });

        // Drag (mouse + touch)
        const header = win.querySelector(".pip-header");
        const startDrag = (clientX, clientY) => {
            const sl = parseInt(win.style.left) || 0, st = parseInt(win.style.top) || 0;
            const onMove = (cx, cy) => {
                win.style.left = Math.max(0, Math.min(window.innerWidth - 100, sl + cx - clientX)) + "px";
                win.style.top = Math.max(0, Math.min(window.innerHeight - 60, st + cy - clientY)) + "px";
            };
            const mv = (ev) => onMove(ev.clientX, ev.clientY);
            const tmv = (ev) => { if (ev.touches[0]) onMove(ev.touches[0].clientX, ev.touches[0].clientY); };
            const up = () => {
                document.removeEventListener("mousemove", mv);
                document.removeEventListener("mouseup", up);
                document.removeEventListener("touchmove", tmv);
                document.removeEventListener("touchend", up);
            };
            document.addEventListener("mousemove", mv);
            document.addEventListener("mouseup", up);
            document.addEventListener("touchmove", tmv, { passive: true });
            document.addEventListener("touchend", up);
        };
        header.addEventListener("mousedown", (e) => {
            if (e.target.closest("button") || e.target.closest("input")) return;
            e.preventDefault();
            this._bringToFront(win);
            startDrag(e.clientX, e.clientY);
        });
        header.addEventListener("touchstart", (e) => {
            if (e.target.closest("button") || e.target.closest("input")) return;
            this._bringToFront(win);
            const t = e.touches[0]; if (t) startDrag(t.clientX, t.clientY);
        }, { passive: true });

        // Resize
        const handle = win.querySelector(".pip-resizable-handle");
        const startResize = (clientX, clientY) => {
            const rw = win.offsetWidth, rh = win.offsetHeight;
            const onMove = (cx, cy) => {
                win.style.width = Math.max(300, rw + cx - clientX) + "px";
                win.style.height = Math.max(200, rh + cy - clientY) + "px";
            };
            const mv = (ev) => onMove(ev.clientX, ev.clientY);
            const tmv = (ev) => { if (ev.touches[0]) onMove(ev.touches[0].clientX, ev.touches[0].clientY); };
            const up = () => {
                document.removeEventListener("mousemove", mv);
                document.removeEventListener("mouseup", up);
                document.removeEventListener("touchmove", tmv);
                document.removeEventListener("touchend", up);
            };
            document.addEventListener("mousemove", mv);
            document.addEventListener("mouseup", up);
            document.addEventListener("touchmove", tmv, { passive: true });
            document.addEventListener("touchend", up);
        };
        handle.addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); this._bringToFront(win); startResize(e.clientX, e.clientY); });
        handle.addEventListener("touchstart", (e) => { e.stopPropagation(); this._bringToFront(win); const t = e.touches[0]; if (t) startResize(t.clientX, t.clientY); }, { passive: true });

        // Minimize
        let minimized = false;
        const minBtn = win.querySelector(".min-btn");
        const body = win.querySelector(".pip-body");
        minBtn.addEventListener("click", () => {
            minimized = !minimized;
            body.style.display = minimized ? "none" : "";
            handle.style.display = minimized ? "none" : "";
            minBtn.innerHTML = minimized ? icon("restore", "icon-sm") : icon("minimize", "icon-sm");
        });

        // Fav
        const favBtn = win.querySelector(".fav-btn");
        favBtn.addEventListener("click", () => {
            FavoritesManager.toggle({ id: videoId, title });
            const nowFav = FavoritesManager.isFav(videoId);
            favBtn.innerHTML = icon("star", nowFav ? "filled" : "");
            favBtn.classList.toggle("fav-active", nowFav);
        });
        win.querySelector(".queue-btn").addEventListener("click", () => {
            QueueManager.add({ id: videoId, title });
        });

        // Resume position polling via YT iframe API postMessage
        let pollId = null;
        let lastSec = 0, lastDur = 0;
        const onMsg = (ev) => {
            if (!ev.data || ev.source !== iframe.contentWindow) return;
            try {
                const data = typeof ev.data === "string" ? JSON.parse(ev.data) : ev.data;
                if (data?.info?.currentTime != null) lastSec = data.info.currentTime;
                if (data?.info?.duration != null) lastDur = data.info.duration;
            } catch {}
        };
        window.addEventListener("message", onMsg);

        const startPoll = () => {
            // listen to time/duration via getter
            const send = (func) => iframe.contentWindow?.postMessage(JSON.stringify({ event: "command", func }), "*");
            // listening event so YT sends back info on time updates
            try {
                iframe.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: videoId }), "*");
            } catch {}
            pollId = setInterval(() => {
                send("getCurrentTime"); send("getDuration");
                if (lastSec) Resume.save(videoId, lastSec, lastDur);
            }, 5000);
        };
        iframe.addEventListener("load", startPoll, { once: true });

        // Close
        win.querySelector(".close-btn").addEventListener("click", () => {
            // final save
            if (lastSec) Resume.save(videoId, lastSec, lastDur);
            this._destroy(key, win);
        });

        win.addEventListener("mousedown", () => this._bringToFront(win));

        workspace.appendChild(win);
        this._windows.set(key, { el: win, videoId, title, pollId: () => pollId, onMsg });


        HistoryManager.add({ id: videoId, title });
        DebugManager.updateStats();
        return win;
    }

    static _destroy(key, winEl) {
        const rec = this._windows.get(key);
        if (!rec) {
            if (winEl) winEl.remove();
            return;
        }
        const { el, onMsg, pollId } = rec;
        try { clearInterval(pollId?.()); } catch {}
        window.removeEventListener("message", onMsg);
        el.style.transition = "opacity .2s, transform .2s";
        el.style.opacity = "0";
        el.style.transform = "scale(0.95)";
        setTimeout(() => { el.remove(); this._windows.delete(key); DebugManager.updateStats(); }, 220);
    }

    static _bringToFront(win) {
        this._winCount++;
        win.style.zIndex = 5000 + this._winCount;
    }
}

// ---------- Context menu ----------
class ContextMenu {
    static current = null;
    static show(x, y, data) {
        this.current = data;
        const menu = document.getElementById("contextMenu");
        if (!menu) return;
        menu.style.display = "block";
        const w = menu.offsetWidth || 200, h = menu.offsetHeight || 260;
        menu.style.left = Math.min(x, window.innerWidth - w - 8) + "px";
        menu.style.top = Math.min(y, window.innerHeight - h - 8) + "px";
    }
    static hide() {
        const m = document.getElementById("contextMenu");
        if (m) m.style.display = "none";
        this.current = null;
    }
    static init() {
        document.addEventListener("click", () => this.hide());
        document.addEventListener("contextmenu", (e) => { if (!e.target.closest(".video-card")) this.hide(); });
        document.getElementById("ctxPlay")?.addEventListener("click", () => this.current && WindowManager.createWindow(this.current.videoId, this.current.title));
        document.getElementById("ctxQueue")?.addEventListener("click", () => this.current && QueueManager.add({ id: this.current.videoId, title: this.current.title, channel: this.current.channel }));
        document.getElementById("ctxWatchLater")?.addEventListener("click", () => this.current && WatchLater.add({ id: this.current.videoId, title: this.current.title, channel: this.current.channel }));
        document.getElementById("ctxFav")?.addEventListener("click", () => this.current && FavoritesManager.toggle({ id: this.current.videoId, title: this.current.title, channel: this.current.channel }));
        document.getElementById("ctxNote")?.addEventListener("click", () => this.current && Notes.add(this.current.videoId));
        document.getElementById("ctxTag")?.addEventListener("click", () => this.current && Tags.edit(this.current.videoId));
        document.getElementById("ctxCopy")?.addEventListener("click", () => {
            if (!this.current) return;
            navigator.clipboard?.writeText(`https://youtu.be/${this.current.videoId}`);
            Toast.show(Translator.t("toast_url_copied"), "success");
        });
        document.getElementById("ctxMute")?.addEventListener("click", () => {
            if (this.current?.channel) ChannelMute.toggle(this.current.channel);
        });
        document.getElementById("ctxClose")?.addEventListener("click", () => this.hide());
    }
}

// ---------- YouTube manager (search/trending/channel) ----------
class YouTubeManager {
    constructor() {
        this.searchIds  = new Set();
        this.channelIds = new Set();
        this.currentContinuation = null;
        this.currentChannelContinuation = null;
        this.currentChannelId = null;
        this.currentChannelTab = "videos";
        this.currentFilter = "all";
        this.allResults = [];
        this.trendingLoaded = false;
        this._lastTrendCategory = null;
        this._smartFilters = null;
        this._inFlight = null;
        this._loadingMore = false;
    }

    static enc(s) { return encodeURIComponent((s || "").trim()); }

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
            if (!q) { if (box) box.style.display = "none"; return; }
            timer = setTimeout(async () => {
                try {
                    const data = await safeFetch(`${WORKER_URL}?suggest=${YouTubeManager.enc(q)}`, { timeout: 6000, retries: 1 });
                    if (!box) return;
                    if (Array.isArray(data) && data.length) {
                        box.innerHTML = "";
                        data.slice(0, 8).forEach(s => {
                            const d = document.createElement("div");
                            d.className = "suggest-item";
                            d.textContent = s;
                            d.onclick = () => { input.value = s; box.style.display = "none"; this.search(); };
                            box.appendChild(d);
                        });
                        box.style.display = "block";
                    } else { box.style.display = "none"; }
                } catch { if (box) box.style.display = "none"; }
            }, 260);
        });
        clearBtn?.addEventListener("click", () => {
            input.value = "";
            clearBtn.classList.remove("visible");
            if (box) box.style.display = "none";
            input.focus();
        });
        document.addEventListener("click", (e) => { if (e.target !== input && box) box.style.display = "none"; });
    }

    initFilterPills() {
        document.querySelectorAll("#filterPills .pill").forEach(pill => {
            pill.addEventListener("click", () => {
                document.querySelectorAll("#filterPills .pill").forEach(p => p.classList.remove("active"));
                pill.classList.add("active");
                this.currentFilter = (pill.dataset.filter || "all").toLowerCase();
                this.applyFilter();
            });
        });
    }

    applyFilter() {
        const f = this.currentFilter;
        const grids = [document.getElementById("searchResultsGrid"), document.getElementById("channelResultsGrid")];
        grids.forEach(grid => {
            if (!grid) return;
            grid.querySelectorAll(".video-card").forEach(card => {
                const type = (card.dataset.type || "video").toLowerCase();
                const channel = card.dataset.channel || "";
                if (ChannelMute.isMuted(channel)) { card.style.display = "none"; return; }
                if (type === "channel") { card.style.display = ""; return; }
                card.style.display = (f === "all" || type === f) ? "" : "none";
            });
        });
    }

    async search(isLoadMore = false) {
        const input = document.getElementById("searchInput");
        const grid  = document.getElementById("searchResultsGrid");
        const loadMore = document.getElementById("loadMoreBtn");
        const sortBar = document.getElementById("sortBar");
        const countEl = document.getElementById("resultCount");
        if (!input || !grid) return;

        const rawQ = input.value.trim();
        if (!rawQ) return;
        if (this._loadingMore && isLoadMore) return;

        // direct channel detect
        if (!isLoadMore && (rawQ.startsWith("@") || /^UC[\w-]{20,}$/.test(rawQ) || rawQ.includes("youtube.com/") || rawQ.includes("youtu.be/"))) {
            this.currentChannelTab = "videos";
            this.resetSubTabUI();
            this.openChannel(rawQ, rawQ);
            return;
        }

        const parsed = SmartSearch.parse(rawQ);
        const q = parsed.q || rawQ;
        if (!isLoadMore) this._smartFilters = parsed.filters;

        if (!isLoadMore) {
            grid.innerHTML = '<div class="loading">Searching…</div>';
            this.searchIds.clear();
            this.allResults = [];
            this.currentContinuation = null;
            if (loadMore) loadMore.style.display = "none";
            if (sortBar) sortBar.style.display = "none";
        }
        if (isLoadMore && loadMore) { loadMore.disabled = true; loadMore.textContent = "..."; }
        this._loadingMore = isLoadMore;

        // cache (initial only)
        if (!isLoadMore) {
            const cached = SearchCache.get(q, this.currentFilter);
            if (cached) {
                this._consumeSearchResults(cached, grid, sortBar, countEl, loadMore, false);
                return;
            }
        }

        let url = `${WORKER_URL}?q=${YouTubeManager.enc(q)}&type=search`;
        if (isLoadMore && this.currentContinuation) {
            url = `${WORKER_URL}?continuation=${YouTubeManager.enc(this.currentContinuation)}&type=search`;
        }

        let data;
        try {
            data = await safeFetch(url, { timeout: 12000, retries: 2 });
            DebugManager.log("OK " + (isLoadMore ? "more" : "search") + " " + q);
        } catch (e) {
            DebugManager.log("ERR " + e.message);
            Toast.show(Translator.t("toast_fetch_error") + e.message, "danger");
            if (!isLoadMore) grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("toast_no_results"))}</div>`;
            if (loadMore) { loadMore.disabled = false; loadMore.textContent = Translator.t("btn_load_more"); }
            this._loadingMore = false;
            return;
        }
        if (!isLoadMore && data) SearchCache.set(q, this.currentFilter, data);
        this._consumeSearchResults(data, grid, sortBar, countEl, loadMore, isLoadMore);
    }

    _consumeSearchResults(data, grid, sortBar, countEl, loadMore, isLoadMore) {
        if (!isLoadMore) grid.innerHTML = "";
        if (data?.results?.length) {
            this.currentContinuation = data.continuation || null;
            // filter pipeline: smart filters + channel mute + dedup
            const filtered = data.results.filter(it => {
                if (!it || it.type === "channel" || !it.videoId) return false;
                if (ChannelMute.isMuted(it.channel)) return false;
                if (this._smartFilters && !SmartSearch.matchesFilters(it, this._smartFilters)) return false;
                return true;
            });
            if (filtered.length > 0) {
                this.renderItems(filtered, grid, this.searchIds, true);
                this.allResults.push(...filtered);
                if (sortBar) sortBar.style.display = "flex";
                if (countEl) countEl.textContent = `${this.searchIds.size}${Translator.t("result_count")}`;
            }
            // auto-fetch more if filter removed everything
            if (filtered.length === 0 && this.currentContinuation && this._smartFilters) {
                this._loadingMore = false;
                this.search(true);
                return;
            }
        } else if (!isLoadMore) {
            grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("toast_no_results"))}</div>`;
        }

        if (loadMore) {
            loadMore.disabled = false;
            loadMore.textContent = Translator.t("btn_load_more");
            loadMore.style.display = this.currentContinuation ? "block" : "none";
        }
        this._loadingMore = false;
    }

    async loadTrending(category = "JP") {
        if (this.trendingLoaded && category === this._lastTrendCategory) return;
        this._lastTrendCategory = category;
        this.trendingLoaded = true;
        const grid = document.getElementById("trendingGrid");
        if (!grid) return;
        grid.innerHTML = '<div class="loading">Loading…</div>';
        const queryMap = { JP: "トレンド 日本", music: "音楽 ランキング", gaming: "ゲーム 人気", news: "ニュース 最新" };
        const q = queryMap[category] || "trending";
        try {
            const data = await safeFetch(`${WORKER_URL}?q=${YouTubeManager.enc(q)}`, { timeout: 12000, retries: 1 });
            grid.innerHTML = "";
            if (data?.results?.length) {
                const seen = new Set();
                data.results.slice(0, 24).forEach((item, idx) => {
                    if (!item.videoId || seen.has(item.videoId)) return;
                    if (ChannelMute.isMuted(item.channel)) return;
                    seen.add(item.videoId);
                    const card = this.buildCard(item, seen, false);
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
                grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("toast_no_results"))}</div>`;
            }
        } catch (e) {
            grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("toast_fetch_error") + e.message)}</div>`;
        }
    }

    async openChannel(handle, displayName, isSubTabClick = false) {
        const tabBtn  = document.getElementById("channelTabBtn");
        const tabLabel = document.getElementById("channelTabLabel");
        const grid    = document.getElementById("channelResultsGrid");
        const loadMore = document.getElementById("channelLoadMoreBtn");
        if (!tabBtn || !grid) return;
        tabBtn.style.display = "flex";
        const shortName = (displayName || "").replace(/^@/, "").substring(0, 16);
        if (tabLabel) tabLabel.textContent = shortName || "Channel";
        tabBtn.setAttribute("data-name", displayName || "");
        if (!isSubTabClick) {
            this.switchToChannelTab();
            this.currentChannelId = handle;
        }
        grid.innerHTML = '<div class="loading">Loading channel…</div>';
        this.channelIds.clear();
        this.currentChannelContinuation = null;
        try {
            const data = await safeFetch(`${WORKER_URL}?q=${YouTubeManager.enc(this.currentChannelId)}&tab=${this.currentChannelTab}`, { timeout: 12000, retries: 2 });
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
                            <img class="channel-hero-avatar" src="${escapeHtml(ch.thumbnail)}" onerror="this.style.display='none'" alt="">
                            <div>
                                <div class="channel-hero-name">${escapeHtml(ch.title)}</div>
                                <div class="channel-hero-sub">${escapeHtml(ch.publishedText || "Channel")}</div>
                            </div>`;
                    }
                }
                this.renderItems(data.results, grid, this.channelIds);
                if (loadMore) loadMore.style.display = this.currentChannelContinuation ? "block" : "none";
            } else {
                grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("toast_no_results"))}</div>`;
                if (loadMore) loadMore.style.display = "none";
            }
        } catch (e) {
            grid.innerHTML = `<div class="no-results">${escapeHtml(Translator.t("toast_fetch_error") + e.message)}</div>`;
        }
        DebugManager.updateStats();
    }

    async loadMoreChannel() {
        if (!this.currentChannelContinuation || this._loadingMore) return;
        const grid = document.getElementById("channelResultsGrid");
        const loadMore = document.getElementById("channelLoadMoreBtn");
        this._loadingMore = true;
        if (loadMore) { loadMore.disabled = true; loadMore.textContent = "..."; }
        try {
            const data = await safeFetch(`${WORKER_URL}?continuation=${YouTubeManager.enc(this.currentChannelContinuation)}&type=browse`, { timeout: 12000, retries: 2 });
            if (data?.results) {
                this.currentChannelContinuation = data.continuation || null;
                this.renderItems(data.results, grid, this.channelIds);
            }
        } catch (e) {
            Toast.show(Translator.t("toast_fetch_error") + e.message, "danger");
        }
        if (loadMore) {
            loadMore.disabled = false;
            loadMore.textContent = Translator.t("btn_load_more");
            loadMore.style.display = this.currentChannelContinuation ? "block" : "none";
        }
        this._loadingMore = false;
    }

    resetSubTabUI() {
        document.getElementById("channelVideosSubTab")?.classList.add("active");
        document.getElementById("channelShortsSubTab")?.classList.remove("active");
    }
    switchSubTab(sel) {
        if (this.currentChannelTab === sel) return;
        this.currentChannelTab = sel;
        const v = document.getElementById("channelVideosSubTab");
        const s = document.getElementById("channelShortsSubTab");
        v?.classList.toggle("active", sel === "videos");
        s?.classList.toggle("active", sel === "shorts");
        const tabBtn = document.getElementById("channelTabBtn");
        const name = tabBtn?.getAttribute("data-name") || "";
        if (this.currentChannelId) this.openChannel(this.currentChannelId, name, true);
    }
    switchToChannelTab() {
        document.querySelectorAll(".nav-tabs .tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
        document.getElementById("channelTabBtn")?.classList.add("active");
        document.getElementById("channelTab")?.classList.add("active");
    }

    renderItems(items, grid, idSet, isSearch = false) {
        const noAnim = !Storage.get("cardAnimEnabled", true);
        const frag = document.createDocumentFragment();
        items.forEach(item => {
            const key = item.type === "channel" ? item.channelId : item.videoId;
            if (!key || idSet.has(key)) return;
            // forced classification per channel sub-tab
            if (item.type !== "channel") {
                if (this.currentChannelTab === "shorts") item.isShort = true;
            }
            idSet.add(key);
            const card = this.buildCard(item, idSet, isSearch, noAnim);
            if (card) frag.appendChild(card);
        });
        grid.appendChild(frag);
        this.applyFilter();
    }

    buildCard(item, idSet, isSearch, noAnim) {
        const card = document.createElement("div");
        card.className = "video-card" + (noAnim ? " no-anim" : "");
        if (item.type === "channel") {
            card.dataset.type = "channel";
            card.innerHTML = `
                <div class="thumbnail-wrapper" style="aspect-ratio:1/1; max-width:120px; margin:18px auto 0; border-radius:50%; border:2px solid var(--accent); overflow:hidden;">
                    <img src="${escapeHtml(item.thumbnail || "")}" onerror="this.src='https://placehold.co/120?text=CH'" loading="lazy" decoding="async" alt="">
                </div>
                <div class="card-info" style="text-align:center;">
                    <div class="card-title">${escapeHtml(item.title)}</div>
                    <div class="card-meta">${icon("channel","icon-xs")} ${escapeHtml(item.publishedText || "Channel")}</div>
                </div>`;
            card.onclick = () => this.openChannel(item.channelId, item.title);
            return card;
        }

        // views
        let rawViews = 0;
        if (item.viewCount) rawViews = parseInt(item.viewCount, 10) || 0;
        else if (item.views) rawViews = parseInt(String(item.views).replace(/[^0-9]/g, ""), 10) || 0;

        const cls = classifyItem(item);
        card.dataset.type = cls.type;
        card.dataset.views = rawViews;
        card.dataset.date = item.uploadDate || item.publishedText || "0";
        card.dataset.id = item.videoId;
        card.dataset.channel = item.channel || "";
        if (ChannelMute.isMuted(item.channel)) card.style.display = "none";

        const canClickChannel = item.channel && !["Unknown", "Channel Video"].includes(item.channel);
        const isFav = FavoritesManager.isFav(item.videoId);
        const prog = Resume.progress(item.videoId);

        const badge = cls.type === "short"
            ? `<span class="badge shorts-badge">SHORTS</span>`
            : cls.type === "live"
                ? `<span class="badge live-badge">LIVE</span>`
                : "";
        const duration = item.duration && cls.type !== "live"
            ? `<span class="duration-badge">${escapeHtml(item.duration)}</span>` : "";

        card.innerHTML = `
            <div class="thumbnail-wrapper">
                <img src="${escapeHtml(item.thumbnail || `https://i.ytimg.com/vi/${item.videoId}/mqdefault.jpg`)}" alt="" loading="lazy" decoding="async" onerror="this.src='https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg'">
                ${badge}
                ${duration}
                <div class="card-fav-dot${isFav ? " active" : ""}" data-id="${item.videoId}" title="favorite">${icon("star", isFav ? "filled" : "")}</div>
                <div class="card-overlay">
                    <button class="overlay-btn play-btn" title="${escapeHtml(Translator.t("btn_play"))}">${icon("play")}</button>
                    <button class="overlay-btn queue-btn" title="${escapeHtml(Translator.t("ctx_queue"))}">${icon("queue", "icon-sm")}</button>
                    <button class="overlay-btn wl-btn" title="${escapeHtml(Translator.t("ctx_watch_later"))}">${icon("bookmark", "icon-sm")}</button>
                    <button class="overlay-btn fav-btn" title="${escapeHtml(Translator.t("ctx_fav"))}">${icon("star", isFav ? "filled" : "")}</button>
                    <button class="overlay-btn copy-btn" title="${escapeHtml(Translator.t("ctx_copy"))}">${icon("link", "icon-sm")}</button>
                </div>
                ${prog > 0 ? `<div class="resume-bar"><span style="width:${prog*100}%"></span></div>` : ""}
            </div>
            <div class="card-info">
                <div class="card-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</div>
                <div class="card-channel${canClickChannel ? " clickable" : ""}">${escapeHtml(item.channel || "")}</div>
                <div class="card-meta">${escapeHtml(item.publishedText || "")}${rawViews ? ` · ${rawViews.toLocaleString()} views` : ""}</div>
            </div>`;

        if (canClickChannel) {
            card.querySelector(".card-channel").onclick = (e) => {
                e.stopPropagation();
                const name = item.channel;
                const q = item.channelId ? item.channelId : (name.startsWith("@") ? name : `@${name}`);
                this.currentChannelTab = "videos";
                this.resetSubTabUI();
                this.openChannel(q, name);
            };
        }

        card.querySelector(".play-btn").onclick  = (e) => { e.stopPropagation(); WindowManager.createWindow(item.videoId, item.title); };
        card.querySelector(".queue-btn").onclick = (e) => { e.stopPropagation(); QueueManager.add({ id: item.videoId, title: item.title, channel: item.channel || "" }); };
        card.querySelector(".wl-btn").onclick    = (e) => { e.stopPropagation(); WatchLater.add({ id: item.videoId, title: item.title, channel: item.channel || "" }); };
        card.querySelector(".fav-btn").onclick   = (e) => {
            e.stopPropagation();
            FavoritesManager.toggle({ id: item.videoId, title: item.title, channel: item.channel || "" });
        };
        card.querySelector(".copy-btn").onclick  = (e) => {
            e.stopPropagation();
            navigator.clipboard?.writeText(`https://youtu.be/${item.videoId}`);
            Toast.show(Translator.t("toast_url_copied"), "success");
        };
        card.querySelector(".card-fav-dot").onclick = (e) => {
            e.stopPropagation();
            FavoritesManager.toggle({ id: item.videoId, title: item.title, channel: item.channel || "" });
        };

        card.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            ContextMenu.show(e.clientX, e.clientY, { videoId: item.videoId, title: item.title, channel: item.channel || "" });
        });
        card.onclick = () => WindowManager.createWindow(item.videoId, item.title);
        return card;
    }
}

// ---------- Debug ----------
class DebugManager {
    static logs = [];
    static init() {
        const head = document.getElementById("debugHeader");
        const panel = document.getElementById("debugPanel");
        const btn = document.getElementById("debugToggleBtn");
        head?.addEventListener("click", () => panel?.classList.toggle("expanded"));
        if (btn) btn.onclick = (e) => { e.stopPropagation(); panel?.classList.toggle("expanded"); };
    }
    static log(msg) {
        this.logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        if (this.logs.length > 30) this.logs.length = 30;
        const el = document.getElementById("debugNetLogs");
        if (el) el.textContent = this.logs.join("\n");
    }
    static updateStats() {
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set("dbSearchIds", window.yt?.searchIds?.size || 0);
        set("dbChannelIds", window.yt?.channelIds?.size || 0);
        set("dbActiveWins", WindowManager._windows.size);
        set("dbQueueLen", QueueManager.queue.length);
        set("dbFavCount", (Storage.get("favorites", []) || []).length);
        set("dbCacheSize", SearchCache.size());
    }
}

// ---------- Keyboard ----------
class KeyboardManager {
    static focused = -1;
    static init(yt) {
        document.addEventListener("keydown", (e) => {
            const tag = document.activeElement?.tagName;
            if (["INPUT","TEXTAREA","SELECT"].includes(tag)) {
                if (e.key === "Escape") document.activeElement.blur();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault(); document.getElementById("searchInput")?.focus(); return;
            }
            switch (e.key) {
                case "/":
                    e.preventDefault(); document.getElementById("searchInput")?.focus(); break;
                case "Escape": {
                    const wins = document.querySelectorAll(".pip-window");
                    if (wins.length) wins[wins.length-1].querySelector(".close-btn")?.click();
                    break;
                }
                case "ArrowRight": document.getElementById("loadMoreBtn")?.click(); break;
                case "ArrowDown": e.preventDefault(); this.navigate(1); break;
                case "ArrowUp":   e.preventDefault(); this.navigate(-1); break;
                case "Enter": {
                    const cards = this.getCards();
                    if (this.focused >= 0 && cards[this.focused]) cards[this.focused].click();
                    break;
                }
                case "q": case "Q": {
                    const cards = this.getCards();
                    if (this.focused >= 0 && cards[this.focused]) cards[this.focused].querySelector(".queue-btn")?.click();
                    break;
                }
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
        this.focused = Math.max(0, Math.min(cards.length-1, this.focused + dir));
        cards.forEach((c,i) => c.style.outline = i === this.focused ? "2px solid var(--accent)" : "");
        cards[this.focused].scrollIntoView({ behavior: "smooth", block: "center" });
    }
}

// ---------- Tabs ----------
class TabManager {
    static init(yt) {
        const map = {
            search: "searchTab", trending: "trendingTab", channel: "channelTab",
            watchlater: "watchlaterTab", queue: "queueTab", favorites: "favoritesTab",
            collections: "collectionsTab", history: "historyTab",
            settings: "settingsTab", about: "aboutTab",
        };
        document.querySelectorAll(".nav-tabs .tab").forEach(tab => {
            tab.addEventListener("click", () => {
                document.querySelectorAll(".nav-tabs .tab").forEach(t => t.classList.remove("active"));
                document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
                tab.classList.add("active");
                const target = map[tab.dataset.tab];
                if (target) document.getElementById(target)?.classList.add("active");
                if (tab.dataset.tab === "trending")    yt.loadTrending();
                if (tab.dataset.tab === "queue")       QueueManager.render();
                if (tab.dataset.tab === "favorites")   FavoritesManager.render();
                if (tab.dataset.tab === "history")     HistoryManager.render();
                if (tab.dataset.tab === "watchlater")  WatchLater.render();
                if (tab.dataset.tab === "collections") Collections.render();
            });
        });
    }
}

// ---------- Session Restore ----------
class SessionManager {
    static save() {
        if (Privacy.incognito) return;
        const session = {
            searchQuery: document.getElementById("searchInput")?.value || "",
            currentTab: document.querySelector(".tab.active")?.dataset.tab || "search",
            openWindows: [...WindowManager._windows.values()].map(w => ({ id: w.videoId, title: w.title })),
            timestamp: Date.now(),
        };
        Storage.set("session", session);
    }
    static async maybeRestore() {
        const mode = Privacy.sessionMode;
        if (mode === "off") return;
        const s = Storage.get("session");
        if (!s) return;
        if (Date.now() - s.timestamp > 86400000) return; // 24h
        const doRestore = (mode === "auto") || confirm(Translator.t("confirm_restore_session"));
        if (!doRestore) return;
        const input = document.getElementById("searchInput");
        if (input && s.searchQuery) input.value = s.searchQuery;
        if (s.currentTab) {
            const t = document.querySelector(`.nav-tabs .tab[data-tab="${s.currentTab}"]`);
            t?.click();
        }
        Toast.show(Translator.t("toast_session_restored"), "success");
    }
}

// ---------- Init ----------
document.addEventListener("DOMContentLoaded", () => {
    Translator.init();
    Privacy.initBadge();

    const yt = new YouTubeManager();
    window.yt = yt;

    ThemeManager.init();
    TabManager.init(yt);
    yt.initSuggest();
    yt.initFilterPills();
    KeyboardManager.init(yt);
    ContextMenu.init();
    DebugManager.init();

    new WaveEngine();
    new ParticleEngine();

    // trending pills
    document.querySelectorAll(".trending-category-pills .pill").forEach(p => {
        p.addEventListener("click", () => {
            document.querySelectorAll(".trending-category-pills .pill").forEach(x => x.classList.remove("active"));
            p.classList.add("active");
            yt.trendingLoaded = false;
            yt.loadTrending(p.dataset.trend);
        });
    });

    // Channel sub tabs
    document.getElementById("channelVideosSubTab")?.addEventListener("click", () => yt.switchSubTab("videos"));
    document.getElementById("channelShortsSubTab")?.addEventListener("click", () => yt.switchSubTab("shorts"));
    document.getElementById("channelMuteBtn")?.addEventListener("click", () => {
        const name = document.getElementById("channelTabBtn")?.getAttribute("data-name");
        if (name) ChannelMute.toggle(name);
    });

    // Search wiring with debounce
    const searchBtn = document.getElementById("searchBtn");
    const searchInput = document.getElementById("searchInput");
    searchBtn?.addEventListener("click", () => yt.search());
    let enterTimer;
    searchInput?.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            clearTimeout(enterTimer);
            enterTimer = setTimeout(() => yt.search(), 50);
        }
    });

    document.getElementById("loadMoreBtn")?.addEventListener("click", () => yt.search(true));
    document.getElementById("channelLoadMoreBtn")?.addEventListener("click", () => yt.loadMoreChannel());

    // Queue
    document.getElementById("clearQueueBtn")?.addEventListener("click",   () => QueueManager.clear());
    document.getElementById("shuffleQueueBtn")?.addEventListener("click", () => QueueManager.shuffle());
    document.getElementById("playAllBtn")?.addEventListener("click",      () => QueueManager.playAll());

    // History
    document.getElementById("clearHistoryBtn")?.addEventListener("click", () => HistoryManager.clearAll());
    let histTimer;
    document.getElementById("historySearch")?.addEventListener("input", (e) => {
        clearTimeout(histTimer);
        histTimer = setTimeout(() => HistoryManager.render(e.target.value), 180);
    });

    // Fav sort
    document.getElementById("favSortSelect")?.addEventListener("change", () => FavoritesManager.render());

    // Watch Later
    document.getElementById("watchLaterPlayAllBtn")?.addEventListener("click", () => WatchLater.playAll());
    document.getElementById("watchLaterClearBtn")?.addEventListener("click", () => WatchLater.clear());

    // Collections
    document.getElementById("newCollectionBtn")?.addEventListener("click", () => Collections.create());

    // Settings
    document.getElementById("windowSizeSelect")?.addEventListener("change", (e) => Storage.set("windowSize", e.target.value));
    document.getElementById("maxWindowsSelect")?.addEventListener("change", (e) => Storage.set("maxWindows", e.target.value));
    document.getElementById("autoplayToggle")?.addEventListener("change", (e) => Storage.set("autoplayEnabled", e.target.checked));

    // Privacy controls
    const incog = document.getElementById("incognitoToggle");
    if (incog) {
        incog.checked = Privacy.incognito;
        incog.addEventListener("change", (e) => Privacy.setIncognito(e.target.checked));
    }
    const histEn = document.getElementById("historyEnabledToggle");
    if (histEn) {
        histEn.checked = Storage.get("historyEnabled", true) !== false;
        histEn.addEventListener("change", (e) => Storage.set("historyEnabled", e.target.checked));
    }
    const resumeSel = document.getElementById("resumeModeSelect");
    if (resumeSel) {
        resumeSel.value = Storage.get("resumeMode", "auto");
        resumeSel.addEventListener("change", (e) => Storage.set("resumeMode", e.target.value));
    }
    const sessSel = document.getElementById("sessionModeSelect");
    if (sessSel) {
        sessSel.value = Storage.get("sessionMode", "ask");
        sessSel.addEventListener("change", (e) => Storage.set("sessionMode", e.target.value));
    }

    // Export / Import
    document.getElementById("exportDataBtn")?.addEventListener("click", () => Privacy.exportAll());
    const importBtn = document.getElementById("importDataBtn");
    const importInput = document.getElementById("importFileInput");
    importBtn?.addEventListener("click", () => importInput?.click());
    importInput?.addEventListener("change", (e) => {
        const f = e.target.files?.[0];
        if (f) Privacy.importAll(f);
    });

    // Sort
    document.querySelectorAll("#sortBar .sort-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll("#sortBar .sort-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            const grid = document.getElementById("searchResultsGrid");
            if (!grid) return;
            const cards = Array.from(grid.querySelectorAll(".video-card"));
            const sortType = btn.dataset.sort;
            if (sortType === "default") return;
            cards.sort((a, b) => {
                if (sortType === "views") return (parseInt(b.dataset.views||0,10)) - (parseInt(a.dataset.views||0,10));
                if (sortType === "date")  return String(b.dataset.date||"").localeCompare(String(a.dataset.date||""));
                return 0;
            });
            const frag = document.createDocumentFragment();
            cards.forEach(c => frag.appendChild(c));
            grid.appendChild(frag);
            yt.applyFilter();
            Toast.show(Translator.t("toast_sort_applied") + btn.textContent.trim(), "success");
        });
    });

    // Initial renders
    WatchLater.updateBadge();
    QueueManager.save();
    FavoritesManager.render();
    HistoryManager.render();
    QueueManager.render();
    WatchLater.render();
    Collections.render();

    // Set settings select initial
    const winSizeSel = document.getElementById("windowSizeSelect");
    const maxWinSel  = document.getElementById("maxWindowsSelect");
    const autoSel    = document.getElementById("autoplayToggle");
    if (winSizeSel) winSizeSel.value = Storage.get("windowSize", "medium");
    if (maxWinSel)  maxWinSel.value  = String(Storage.get("maxWindows", 5));
    if (autoSel)    autoSel.checked  = Storage.get("autoplayEnabled", true);

    Toast.show(Translator.t("toast_init_done"), "success");
    DebugManager.updateStats();

    // Session restore (after init)
    setTimeout(() => SessionManager.maybeRestore(), 600);

    // Save session on unload (privacy-guarded)
    window.addEventListener("beforeunload", () => SessionManager.save());

    // Translator callbacks re-render content
    Translator.onLangChangeCallbacks.push(() => {
        QueueManager.render(); FavoritesManager.render();
        HistoryManager.render(); WatchLater.render(); Collections.render();
    });
});
