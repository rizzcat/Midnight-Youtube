// =============================================================
//   Midnight YouTube V9 — translator.js (設定画面対応版)
// =============================================================

class Translator {
    static currentLang = localStorage.getItem("app_lang") || "ja";

    static locales = {
        ja: {
            tab_search: "検索",
            tab_trending: "急上昇",
            tab_queue: "キュー",
            tab_favorites: "お気に入り",
            tab_history: "履歴",
            tab_settings: "設定",
            pill_all: "すべて",
            pill_video: "動画",
            pill_live: "ライブ表示",
            pill_short: "ショート動画",
            sort_title: "並べ替え",
            sort_default: "関連度順",
            sort_views: "視聴回数順",
            sort_date: "投稿日順",
            load_more: "さらに読み込む",

            // ── 追加：設定画面（日本語） ──
            set_title_appearance: "🎨 外観・テーマデザイン",
            set_base_theme: "ベーステーマ",
            theme_midnight: "Midnight Deep (標準)",
            theme_oled: "Absolute OLED (漆黒)",
            theme_cyber: "Cyber Neon (サイバー)",
            theme_glass: "Frosted Glass (ガラス調)",
            theme_aurora: "Northern Aurora (オーロラ)",
            theme_rose: "Velvet Rose (ローズ)",
            theme_rainbow: "Dynamic Rainbow (虹色)",
            set_accent_color: "カスタムアクセントカラー",
            
            set_title_player: "🪟 プレイヤーウィンドウ制御",
            set_window_size: "デフォルトのウィンドウサイズ",
            size_small: "コンパクト (400x260)",
            size_medium: "スタンダード (520x330)",
            size_large: "シアター (700x430)",
            set_max_windows: "最大同時起動数",
            wins_3: "3 ウィンドウ",
            wins_5: "5 ウィンドウ",
            wins_10: "10 ウィンドウ",
            wins_unlimited: "制限なし (非推奨)",
            set_autoplay: "ウィンドウ展開時に自動再生する",
            
            set_title_effects: "✨ バックグラウンド・エフェクト設定",
            set_wave_anim: "流体ウェーブアニメーションを有効化",
            set_particle_effect: "浮遊パーティクルエフェクトを有効化",
            set_card_anim: "カードホバー時の滑らかなアニメーション効果",
            
            set_title_debug: "⚙️ システムデバッガー設定",
            set_hide_debug: "画面右下のデバッグパネルを完全に非表示にする",
            
            set_title_danger: "⚠️ 危険領域",
            set_danger_desc: "ブラウザのLocalStorageに保存されている設定、お気に入り、キュー、履歴など、すべてのアプリケーションデータを即座に全削除します。",
            set_reset_btn: "すべてのデータを完全リセット"
        },
        en: {
            tab_search: "Search",
            tab_trending: "Trending",
            tab_queue: "Queue",
            tab_favorites: "Favorites",
            tab_history: "History",
            tab_settings: "Settings",
            pill_all: "All Assets",
            pill_video: "Long Videos",
            pill_live: "Live Streams",
            pill_short: "Shorts Filter",
            sort_title: "Sorting",
            sort_default: "Default",
            sort_views: "Most Viewed",
            sort_date: "Upload Date",
            load_more: "Load More Contents",

            // ── 追加：設定画面（英語） ──
            set_title_appearance: "🎨 Appearance & Theme",
            set_base_theme: "Base Theme",
            theme_midnight: "Midnight Deep (Default)",
            theme_oled: "Absolute OLED (Blackout)",
            theme_cyber: "Cyber Neon",
            theme_glass: "Frosted Glass",
            theme_aurora: "Northern Aurora",
            theme_rose: "Velvet Rose",
            theme_rainbow: "Dynamic Rainbow",
            set_accent_color: "Custom Accent Color",
            
            set_title_player: "🪟 Player Window Controls",
            set_window_size: "Default Window Size",
            size_small: "Compact (400x260)",
            size_medium: "Standard (520x330)",
            size_large: "Theater (700x430)",
            set_max_windows: "Max Concurrent Windows",
            wins_3: "3 Windows",
            wins_5: "5 Windows",
            wins_10: "10 Windows",
            wins_unlimited: "No Limit (Not Recommended)",
            set_autoplay: "Autoplay when window opens",
            
            set_title_effects: "✨ Background & Effects",
            set_wave_anim: "Enable fluid wave animation",
            set_particle_effect: "Enable floating particle effects",
            set_card_anim: "Smooth animation on card hover",
            
            set_title_debug: "⚙️ System Debugger Settings",
            set_hide_debug: "Completely hide debug panel in bottom right",
            
            set_title_danger: "⚠️ Danger Zone",
            set_danger_desc: "Instantly clear all application data, including settings, bookmarks, queue, and history stored in LocalStorage.",
            set_reset_btn: "Factory Reset All Data"
        }
    };

    static init() {
        this.apply(this.currentLang);
        
        // 言語ボタンのアクティブ状態をUIに初期反映
        document.querySelectorAll(".lang-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.lang === this.currentLang);
            btn.addEventListener("click", () => {
                const lang = btn.dataset.lang;
                Translator.changeLang(lang);
            });
        });
    }

    static changeLang(lang) {
        this.currentLang = lang;
        localStorage.setItem("app_lang", lang);
        this.apply(lang);
        
        document.querySelectorAll(".lang-btn").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.lang === lang);
        });
        
        if (typeof Toast !== "undefined") {
            Toast.show(lang === "ja" ? "🇯🇵 日本語に切り替えました" : "🇺🇸 Switched to English", "success");
        }
    }

    static apply(lang) {
        const dict = this.locales[lang];
        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.dataset.i18n;
            if (dict[key]) {
                // 子要素にSVGアイコンがある場合は、テキスト部分だけを書き換える
                const icon = el.querySelector(".icon");
                if (icon) {
                    el.innerHTML = "";
                    el.appendChild(icon);
                    el.appendChild(document.createTextNode(" " + dict[key]));
                } else {
                    el.textContent = dict[key];
                }
            }
        });
    }

    static t(key) {
        return this.locales[this.currentLang][key] || key;
    }
}