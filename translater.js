// =============================================================
//   Midnight YouTube V10 — translater.js (完全i18n対応版)
// =============================================================

class Translator {
    static currentLang = localStorage.getItem("app_lang") || "ja";
    static onLangChangeCallbacks = [];

    static locales = {
        ja: {
            // ── ナビゲーションタブ ──
            tab_search: "検索",
            tab_trending: "急上昇",
            tab_channel: "チャンネル",
            tab_queue: "キュー",
            tab_favorites: "お気に入り",
            tab_history: "履歴",
            tab_settings: "設定",
            tab_about: "情報",
            logo_sub: "Youtube",

            // ── フィルターピル ──
            pill_all: "すべて",
            pill_video: "動画",
            pill_live: "ライブ表示",
            pill_short: "ショート動画",

            // ── ソート関連 ──
            sort_title: "並べ替え",
            sort_default: "関連度順",
            sort_views: "視聴回数順",
            sort_date: "投稿日順",
            result_count: "件",

            // ── ボタン・アクション ──
            btn_queue_play: "▶ 全て展開",
            btn_queue_shuffle: "🔀 シャッフル",
            btn_queue_clear: "🗑 キューをクリア",
            btn_history_clear: "🕒 履歴をクリア",
            btn_load_more: "さらに読み込む",
            opt_fav_date: "追加日順",
            opt_fav_title: "タイトル順",

            // ── プレイボタン系 ──
            btn_play: "再生",
            btn_remove: "削除",
            btn_close: "閉じる",

            // ── テキストテキスト（HTML要素） ──
            search_placeholder: "キーワード、@ハンドル、またはチャンネルID...",
            no_results_search: "検索バーにキーワードを入力して探してみましょう。",
            trending_category_jp: "総合 (日本)",
            trending_category_music: "音楽",
            trending_category_gaming: "ゲーム",
            trending_category_news: "ニュース",
            channel_videos: "動画",
            channel_shorts: "ショート",
            channel_playlists: "プレイリスト",

            // ── 設定画面 ──
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
            set_reset_btn: "すべてのデータを完全リセット",

            // ── トースト通知 ──
            toast_switched: "日本語に切り替えました",
            toast_init_done: "初期化完了",
            toast_theme_changed: "テーマを変更しました: ",
            toast_reset_success: "全データを完全にリセットしました",
            toast_old_win_closed: "最大数に達したため、古いウィンドウを閉じました",
            toast_queue_exists: "既にキューに登録されています",
            toast_queue_added: "キューに追加しました: ",
            toast_queue_cleared: "キューをクリアしました",
            toast_queue_shuffled: "キューをシャッフルしました",
            toast_queue_empty: "キューが空です",
            toast_fav_added: "お気に入りに追加しました",
            toast_fav_removed: "お気に入りから削除しました",
            toast_hist_cleared: "視聴履歴をすべてクリアしました",
            toast_sort_applied: "並べ替えを適用しました: ",

            // ── 確認ダイアログ ──
            confirm_reset: "すべてのデータ（お気に入り、履歴、設定など）を完全に削除しますか？\nこの操作は取り消せません。",
            confirm_hist_clear: "視聴履歴をすべてクリアしますか？",

            // ── 空状態メッセージ ──
            empty_queue: "キューは空です。動画カードのキューボタンを押して追加できます。",
            empty_favorites: "お気に入りはまだありません。★ボタンを押して追加できます。",
            empty_history: "視聴履歴はありません。",
            empty_history_search: "検索条件に一致する履歴が見つかりません。",
            fav_added_at: "追加: ",

            // ── About画面 ──
            about_title: "ℹ️ 情報",
            about_product: "Midnight YouTube",
            about_version: "Version 1.0.0 (2026)",
            about_desc: "Midnight はカスタム YouTube フロントエンドプレイヤーです。洗練されたダークデザインとスムーズなアニメーションエフェクトを備えています。複数のウィンドウコントロールと便利なキューイング機能を搭載しています。",
            about_credit_title: "💻 クレジット",
            about_credit_main: "プライベートに制限なくYoutube動画を閲覧できます。これは Norepted(Weaf) のクレジットです。",
            about_credit_note: "申し訳ありません。AI を使用しました。",
            about_discord: "Discord : ilovetaiwan",

            // ── PiP窓のテキスト ──
            pip_volume: "音量",
            pip_size_small: "小",
            pip_size_medium: "中",
            pip_minimize: "最小化",
            pip_favorite: "お気に入り",
            pip_queue: "キューに追加",

            // ── デバッグパネル ──
            debug_title: "DEBUGLOG",
            debug_system: "SYSTEM STATE",
            debug_search_ids: "Search IDs",
            debug_channel_ids: "Channel IDs",
            debug_active_wins: "Active Wins",
            debug_queue_len: "Queue Len",
            debug_fav_count: "Fav Count",
            debug_network: "NETWORK LOGS",
            debug_storage: "STORAGE SNAPSHOT",
            debug_reload: "RELOAD",

            // ── コンテキストメニュー ──
            ctx_play: "再生",
            ctx_queue: "キューに追加",
            ctx_fav: "お気に入り",
            ctx_copy: "URLをコピー",
            ctx_close: "閉じる",
        },

        en: {
            // ── Navigation Tabs ──
            tab_search: "Search",
            tab_trending: "Trending",
            tab_channel: "Channel",
            tab_queue: "Queue",
            tab_favorites: "Favorites",
            tab_history: "History",
            tab_settings: "Settings",
            tab_about: "About",
            logo_sub: "Youtube",

            // ── Filter Pills ──
            pill_all: "All Assets",
            pill_video: "Long Videos",
            pill_live: "Live Streams",
            pill_short: "Shorts Filter",

            // ── Sorting ──
            sort_title: "Sorting",
            sort_default: "Default",
            sort_views: "Most Viewed",
            sort_date: "Upload Date",
            result_count: " results",

            // ── Buttons & Actions ──
            btn_queue_play: "▶ Play All",
            btn_queue_shuffle: "🔀 Shuffle",
            btn_queue_clear: "🗑 Clear Queue",
            btn_history_clear: "🕒 Clear History",
            btn_load_more: "Load More Contents",
            opt_fav_date: "Date Added",
            opt_fav_title: "Title A-Z",

            // ── Play Buttons ──
            btn_play: "Play",
            btn_remove: "Remove",
            btn_close: "Close",

            // ── Text Content (HTML) ──
            search_placeholder: "Keywords, @handle, or Channel ID...",
            no_results_search: "Enter keywords in the search bar to explore.",
            trending_category_jp: "Overall (Japan)",
            trending_category_music: "Music",
            trending_category_gaming: "Gaming",
            trending_category_news: "News",
            channel_videos: "Videos",
            channel_shorts: "Shorts",
            channel_playlists: "Playlists",

            // ── Settings ──
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
            set_reset_btn: "Factory Reset All Data",

            // ── Toast Notifications ──
            toast_switched: "Switched to English",
            toast_init_done: "Midnight Initialization Done",
            toast_theme_changed: "Theme changed to: ",
            toast_reset_success: "Factory Reset All Data Successful",
            toast_old_win_closed: "Max windows reached. Closed older window.",
            toast_queue_exists: "Already in Queue",
            toast_queue_added: "Added to Queue: ",
            toast_queue_cleared: "Cleared Queue",
            toast_queue_shuffled: "Shuffled Queue",
            toast_queue_empty: "Queue is empty",
            toast_fav_added: "Added to Favorites",
            toast_fav_removed: "Removed from Favorites",
            toast_hist_cleared: "Cleared all History",
            toast_sort_applied: "Applied Sorting: ",

            // ── Confirmation Dialogs ──
            confirm_reset: "Do you want to delete all data (favorites, history, settings)?\nThis action cannot be undone.",
            confirm_hist_clear: "Are you sure you want to clear your watch history?",

            // ── Empty States ──
            empty_queue: "Queue is empty. You can add videos using the queue button on cards.",
            empty_favorites: "No favorites yet. You can add them using the ★ button on cards.",
            empty_history: "No watch history available.",
            empty_history_search: "No history results match your search.",
            fav_added_at: "Added: ",

            // ── About Page ──
            about_title: "ℹ️ Information",
            about_product: "Midnight YouTube",
            about_version: "Version 1.0.0 (2026)",
            about_desc: "Midnight is a custom YouTube front-end player with a sophisticated dark design and smooth animation effects. It features multiple window controls and a convenient queuing function.",
            about_credit_title: "💻 Credit",
            about_credit_main: "Watch YouTube videos privately and unrestricted. Credit to Norepted(Weaf).",
            about_credit_note: "Sorry, I used AI...",
            about_discord: "Discord : ilovetaiwan",

            // ── PiP Window Text ──
            pip_volume: "Volume",
            pip_size_small: "S",
            pip_size_medium: "M",
            pip_minimize: "Min",
            pip_favorite: "Favorite",
            pip_queue: "Queue",

            // ── Debug Panel ──
            debug_title: "DEBUGLOG",
            debug_system: "SYSTEM STATE",
            debug_search_ids: "Search IDs",
            debug_channel_ids: "Channel IDs",
            debug_active_wins: "Active Wins",
            debug_queue_len: "Queue Len",
            debug_fav_count: "Fav Count",
            debug_network: "NETWORK LOGS",
            debug_storage: "STORAGE SNAPSHOT",
            debug_reload: "RELOAD",

            // ── Context Menu ──
            ctx_play: "Play",
            ctx_queue: "Queue",
            ctx_fav: "Favorite",
            ctx_copy: "Copy URL",
            ctx_close: "Close",
        }
    };

    static init() {
        this.apply(this.currentLang);

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
            Toast.show(this.t("toast_switched"), "success");
        }

        this.onLangChangeCallbacks.forEach(callback => {
            try { callback(lang); } catch(e) { console.error(e); }
        });
    }

    static apply(lang) {
        const dict = this.locales[lang];
        if (!dict) return;

        document.querySelectorAll("[data-i18n]").forEach(el => {
            const key = el.dataset.i18n;
            if (dict[key]) {
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

        // Placeholder対応
        document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
            const key = el.getAttribute("data-i18n-placeholder");
            if (dict[key]) {
                el.placeholder = dict[key];
            }
        });
    }

    static t(key) {
        const dict = this.locales[this.currentLang] || this.locales["ja"];
        return dict[key] !== undefined ? dict[key] : key;
    }

    // 動的テンプレート用ヘルパー
    static tpl(key, ...args) {
        let text = this.t(key);
        args.forEach((arg, i) => {
            text = text.replace(`{${i}}`, arg);
        });
        return text;
    }
}