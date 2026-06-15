// =============================================================
//  Midnight YouTube V9 — translator.js
// =============================================================

class Translator {
    static currentLang = localStorage.getItem("app_lang") || "ja";

    static locales = {
        ja: {
            logo_sub: "ユーチューブ",
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
            load_more: "さらに読み込む"
        },
        en: {
            logo_sub: "YouTube Client",
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
            load_more: "Load More Contents"
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