export default {
    async fetch(request, env, ctx) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
                    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
                    "Access-Control-Max-Age": "86400",
                }
            });
        }

        const url = new URL(request.url);
        
        const translateText = url.searchParams.get("translate");
        const sl = url.searchParams.get("sl") || "auto"; 
        const tl = url.searchParams.get("tl") || "ja";   

        const suggestQuery = url.searchParams.get("suggest");
        const rawQ = url.searchParams.get("q");
        const tab = url.searchParams.get("tab") || "videos";
        const continuation = url.searchParams.get("continuation");
        const type = url.searchParams.get("type") || "browse"; 
        let sp = url.searchParams.get("sp"); 
        const isDebug = url.searchParams.get("debug") === "true";

        const cache = caches.default;
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;

        let responseData = null;

        try {
            if (translateText) {
                const targetUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(translateText.trim())}`;
                const res = await fetch(targetUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
                if (!res.ok) throw new Error("Google Translation API Error");
                const data = await res.json();
                
                let translatedResult = "";
                if (data && data[0]) {
                    data[0].forEach(sentence => { if (sentence[0]) translatedResult += sentence[0]; });
                }
                responseData = jsonResponse({ translatedText: translatedResult }, 86400); 
            }
            else if (suggestQuery) {
                const sq = encodeURIComponent(suggestQuery.trim());
                const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${sq}`);
                const data = await res.json();
                responseData = jsonResponse(data[1] || [], 300);
            }
            else if (continuation) {
                const endpoint = (type === "search") ? "search" : "browse";
                const rawData = await fetchWithRetry({ continuation }, endpoint);
                if (isDebug) return jsonResponse({ _debug: `Continuation-${endpoint}`, rawData });

                const parsed = parseYouTubeResponse(rawData, endpoint);

                if (tab === "shorts") {
                    parsed.results.forEach(v => { if (v.type === "video") v.isShort = true; });
                }
                responseData = jsonResponse({ results: parsed.results, continuation: parsed.continuation }, 3600);
            }
            else if (rawQ && (rawQ.startsWith("@") || rawQ.startsWith("UC") || rawQ.includes("youtube.com/"))) {
                let q = decodeSafe(rawQ);
                const channelUrl = buildChannelTabUrl(q, tab);
                const html = await fetchHtml(channelUrl);
                
                const initialData = parseYtInitialData(html);
                if (!initialData) throw new Error("Failed to parse initial data");
                if (isDebug) return jsonResponse({ _debug: "HTML Initial", initialData });

                const parsed = parseYouTubeResponse(initialData, "browse");

                if (tab === "shorts") {
                    parsed.results.forEach(v => { if (v.type === "video") v.isShort = true; });
                }
                responseData = jsonResponse({ results: parsed.results, continuation: parsed.continuation }, 300);
            }
            else if (rawQ) {
                let q = decodeSafe(rawQ);
                let payload = { query: q };
                if (sp) payload.params = sp; 

                const rawData = await fetchWithRetry(payload, "search");
                const parsed = parseYouTubeResponse(rawData, "search");
                responseData = jsonResponse({ results: parsed.results, continuation: parsed.continuation }, 600);
            }
            else {
                const rawData = await fetchWithRetry({ browseId: "FEtrending" }, "browse");
                const parsed = parseYouTubeResponse(rawData, "browse");
                responseData = jsonResponse({ results: parsed.results, continuation: parsed.continuation, isTrending: true }, 1800);
            }

            if (responseData) {
                ctx.waitUntil(cache.put(request, responseData.clone()));
                return responseData;
            }

        } catch (e) {
            console.error(e);
            return jsonResponse({ error: e.message, results: [] });
        }
    }
};

async function fetchWithRetry(payload, endpoint, retries = 2) {
    for (let i = 0; i <= retries; i++) {
        try {
            return await fetchRawFromInnerTube(payload, endpoint);
        } catch (err) {
            if (i === retries) throw err;
            await new Promise(r => setTimeout(r, 800));
        }
    }
}

async function fetchRawFromInnerTube(payload, endpoint) {
    let clientVersion = "2.20260612.01.00"; 
    const INNER_TUBE_KEY = "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8";

    if (payload.continuation) {
        try {
            const decoded = atob(decodeURIComponent(payload.continuation));
            const versionMatch = decoded.match(/2\.\d{8}\.\d{2}\.\d{2}/);
            if (versionMatch) clientVersion = versionMatch[0];
        } catch (e) {}
    }
    
    const apiBody = {
        context: {
            client: { 
                clientName: "WEB", 
                clientVersion: clientVersion, 
                hl: "ja", 
                gl: "JP", 
                utcOffsetMinutes: 540 
            }
        },
        ...payload
    };

    const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNER_TUBE_KEY}&prettyPrint=false`, {
        method: "POST",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Content-Type": "application/json",
            "Origin": "https://www.youtube.com",
            "Referer": "https://www.youtube.com/"
        },
        body: JSON.stringify(apiBody)
    });

    if (!res.ok) throw new Error(`InnerTube HTTP ${res.status}`);
    return await res.json();
}

function parseYouTubeResponse(json, endpoint = "search") {
    let results = [];
    const tokenContainer = { token: "" };

    function findContinuationToken(obj) {
        if (!obj || typeof obj !== "object") return;
        let foundToken = "";

        if (obj.nextContinuationData?.continuation) foundToken = obj.nextContinuationData.continuation;
        else if (obj.continuationCommand?.token) foundToken = obj.continuationCommand.token;
        else if (obj.continuationEndpoint?.continuationCommand?.token) foundToken = obj.continuationEndpoint.continuationCommand.token;

        if (foundToken) {
            if (endpoint === "search") {
                if (!tokenContainer.token || foundToken.length < tokenContainer.token.length) tokenContainer.token = foundToken;
            } else {
                if (!tokenContainer.token || foundToken.length > tokenContainer.token.length) tokenContainer.token = foundToken;
            }
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) findContinuationToken(obj[key]);
        }
    }

    function findItems(obj) {
        if (!obj || typeof obj !== "object") return;

        if (obj.lockupViewModel && obj.lockupViewModel.contentType === "LOCKUP_CONTENT_TYPE_VIDEO") {
            const item = parseLockupViewModel(obj.lockupViewModel);
            if (item) results.push(item);
        } 
        else if (obj.lockupViewModel && obj.lockupViewModel.contentType === "LOCKUP_CONTENT_TYPE_SHORT") {
            const item = parseLockupViewModel(obj.lockupViewModel);
            if (item) { item.isShort = true; results.push(item); }
        }
        else if (obj.videoRenderer) results.push(parseVideoItem(obj.videoRenderer)); 
        else if (obj.gridVideoRenderer) results.push(parseVideoItem(obj.gridVideoRenderer)); 
        else if (obj.compactVideoRenderer) results.push(parseVideoItem(obj.compactVideoRenderer)); 
        else if (obj.shortsLockupViewModel) results.push(parseShortsItem(obj.shortsLockupViewModel)); 
        else if (obj.reelItemRenderer) results.push(parseReelItem(obj.reelItemRenderer));
        else if (obj.channelRenderer) {
            const item = parseChannelItem(obj.channelRenderer);
            if (item) results.push(item);
        }

        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) findItems(obj[key]);
        }
    }

    findContinuationToken(json);
    findItems(json);

    const seen = new Set();
    results = results.filter(item => {
        if (!item) return false;
        const key = item.videoId || item.channelId;
        if (!key) return true;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    results.sort((a, b) => {
        const scoreA = parsePublishedTimeToSeconds(a.publishedText);
        const scoreB = parsePublishedTimeToSeconds(b.publishedText);
        return scoreA - scoreB;
    });

    return { results, continuation: tokenContainer.token };
}

function detectLiveStatus(v, viewCountText = "", publishedText = "") {
    if (!v) return false;
  
    const lengthText = v.lengthText?.simpleText || v.lengthText?.runs?.[0]?.text || "";
    if (lengthText && !lengthText.includes("LIVE") && !lengthText.includes("ライブ")) {
        return false; 
    }

    const pubTextLower = (publishedText || "").toLowerCase();
    if (pubTextLower.includes("前") || 
        pubTextLower.includes("ago") || 
        pubTextLower.includes("配信済み") || 
        pubTextLower.includes("streamed") || 
        pubTextLower.includes("公開済")) {
        return false;
    }

    const overlays = v.thumbnailOverlays || [];
    for (const overlay of overlays) {
        if (overlay.thumbnailOverlayTimeStatusRenderer?.style === "LIVE") return true;
        if (overlay.thumbnailOverlayLiveStatusRenderer) return true; // 新UI用
    }

    // 2. メタデータバッジ（システムスタイル）
    const badges = v.badges || [];
    for (const badge of badges) {
        const meta = badge.metadataBadgeRenderer || badge;
        if (meta.style === "BADGE_STYLE_TYPE_LIVE_NOW") return true;
    }

    const viewText = (viewCountText || "").toLowerCase();
    if (viewText.includes("視聴中") || viewText.includes("watching")) {
        return true;
    }

    return false;
}

function detectUpcomingStatus(v) {
    return !!(v.upcomingEventData || v.thumbnailOverlays?.some(o => 
        o.thumbnailOverlayTimeStatusRenderer?.style === "UPCOMING"
    ));
}

function detectLiveArchiveStatus(isLive, publishedText) {
    if (isLive) return false;
    const archiveKeywords = ["配信済み", "streamed", "premiered", "公開済", "に配信済み"];
    return archiveKeywords.some(k => publishedText.toLowerCase().includes(k));
}

function parseVideoItem(v) {
    const videoId = v.videoId;
    if (!videoId) return null;

    const title = v.title?.runs?.[0]?.text || v.title?.simpleText || "No Title";
    const bylineRun = v.longBylineText?.runs?.[0] || v.shortBylineText?.runs?.[0];
    const channelName = bylineRun?.text || "YouTube Video";
    const channelId = bylineRun?.navigationEndpoint?.browseEndpoint?.browseId || "";
    
    const viewCountText = v.viewCountText?.simpleText || 
                          v.viewCountText?.runs?.map(r => r.text).join("") || 
                          v.shortViewCountText?.simpleText || 
                          v.shortViewCountText?.runs?.map(r => r.text).join("") || "";

    const duration = v.lengthText?.simpleText || "";
    const publishedText = v.publishedTimeText?.simpleText || v.publishedTimeText?.runs?.map(r => r.text).join("") || "";

    const isLive = detectLiveStatus(v, viewCountText, publishedText);
    const isUpcoming = detectUpcomingStatus(v);
    const isLiveArchive = detectLiveArchiveStatus(isLive, publishedText);

    let displayPublished = publishedText;
    if (isLive) displayPublished = "🔴 ライブ配信中";
    else if (isUpcoming) displayPublished = "📅 配信予定";
    else if (isLiveArchive) displayPublished = publishedText || "配信済み";

    const isShort = detectShortsStatus(v, title);

    return { 
        type: "video", 
        videoId, 
        title, 
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, 
        channel: channelName, 
        channelId, 
        publishedText: displayPublished,
        isLive, 
        isLiveArchive, 
        isUpcoming,
        isShort, 
        duration
    };
}
function detectShortsStatus(v, title) {
    const endpointUrl = v.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || "";
    const lowTitle = title.toLowerCase();
    return !!(endpointUrl.includes("/shorts/") || 
              lowTitle.includes("#shorts") || 
              lowTitle.includes("#ショート"));
}

function parsePublishedTimeToSeconds(text) {
    if (!text) return 99999999;
    if (text.includes("ライブ配信中")) return 1;
    if (text.includes("配信予定")) return 2;
    if (text.includes("配信済み")) return 10;

    const num = parseInt(text) || 0;
    if (text.includes("秒前")) return num;
    if (text.includes("分前")) return num * 60;
    if (text.includes("時間前")) return num * 3600;
    if (text.includes("日前")) return num * 86400;
    if (text.includes("週間前")) return num * 86400 * 7;
    if (text.includes("か月前")) return num * 86400 * 30;
    if (text.includes("年前")) return num * 86400 * 365;

    return 99999998;
}

function parseLockupViewModel(vm) {
    const videoId = vm.contentId;
    if (!videoId) return null;
    const title = vm.metadata?.lockupMetadataViewModel?.title?.content || "No Title";
    const sources = vm.contentImage?.thumbnailViewModel?.image?.sources;
    const thumbnail = sources && sources.length > 0 ? sources[sources.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const isShort = vm.contentType === "LOCKUP_CONTENT_TYPE_SHORT";

    return { 
        type: "video", 
        videoId, 
        title, 
        thumbnail, 
        channel: "YouTube Video", 
        publishedText: isShort ? "Shorts" : "Video", 
        isShort, 
        duration: isShort ? "0:30" : "",
        isLive: false,
        isLiveArchive: false,
        isUpcoming: false
    };
}

function parseShortsItem(s) {
    const videoId = s.onTap?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url?.split("/shorts/")?.[1] || "";
    if (!videoId) return null;
    const title = s.overlayMetadata?.primaryText?.content || "Shorts Video";
    return { type: "video", videoId, title, isShort: true, duration: "0:30", thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, channel: "Shorts", publishedText: "Shorts" };
}

function parseReelItem(r) {
    const videoId = r.videoId;
    if (!videoId) return null;
    return { type: "video", videoId, title: r.headline?.simpleText || "Short Video", thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, channel: "Shorts", publishedText: "Shorts", isShort: true, duration: "0:30" };
}

function parseChannelItem(c) {
    const channelId = c.channelId;
    if (!channelId) return null;
    const title = c.title?.simpleText || c.title?.runs?.[0]?.text || "Unknown Channel";
    const thumbnails = c.thumbnail?.thumbnails;
    const thumbnail = thumbnails && thumbnails.length > 0 ? "https:" + thumbnails[thumbnails.length - 1].url.replace(/^https?:/, '') : "";
    return { type: "channel", channelId, title, thumbnail, publishedText: c.videoCountText?.simpleText || "Channel" };
}

function buildChannelTabUrl(input, tab) {
    let baseUrl = input.trim();
    if (baseUrl.includes("youtube.com/")) {
        baseUrl = baseUrl.split(/[?#]/)[0].replace(/\/+$/, "");
        const tabRegex = /\/(videos|shorts|streams|playlists)\/?$/i;
        if (tabRegex.test(baseUrl)) return baseUrl.replace(tabRegex, `/${tab}`);
        return `${baseUrl}/${tab}`;
    }
    if (baseUrl.startsWith("@")) return `https://www.youtube.com/@${encodeURIComponent(baseUrl.substring(1))}/${tab}`;
    if (baseUrl.startsWith("UC")) return `https://www.youtube.com/channel/${encodeURIComponent(baseUrl)}/${tab}`;
    return `https://www.youtube.com/@${encodeURIComponent(baseUrl)}/${tab}`;
}

async function fetchHtml(url) {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ja,ja-JP;q=0.9" } });
    return res.text();
}

function parseYtInitialData(html) {
    const match = html.match(/ytInitialData\s*=\s*(\{[\s\S]*?\});/);
    if (!match) return null;
    try { return JSON.parse(match[1]); } catch { return null; }
}

function decodeSafe(str) { 
    try { return decodeURIComponent(str).trim(); } catch { return str.trim(); } 
}

function jsonResponse(data, cacheTtlSeconds = 0) {
    const headers = { 
        "Content-Type": "application/json; charset=utf-8", 
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, HEAD",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With"
    };
    if (cacheTtlSeconds > 0) headers["Cache-Control"] = `s-maxage=${cacheTtlSeconds}`;
    return new Response(JSON.stringify(data), { headers });
}
