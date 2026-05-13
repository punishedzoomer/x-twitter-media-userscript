// ==UserScript==
// @name         X Network Intercept Media Gallery (Clean Syntax)
// @namespace    http://tampermonkey.net/
// @version      13.1
// @description  Intercepts X's background data and correctly parses extended_entities to build a media gallery.
// @match        https://twitter.com/*
// @match        https://x.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    // Store media: { mediaUrl: string, tweetUrl: string, isVideo: boolean }
    const galleryData = new Map();
    const renderedMedia = new Set();

    // 1. Intercept Fetch API
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const response = await originalFetch.apply(this, args);
        
        let url = '';
        if (typeof args[0] === 'string') url = args[0];
        else if (args[0] instanceof URL) url = args[0].href;
        else if (args[0] && args[0].url) url = args[0].url;

        if (url && url.includes('/graphql/')) {
            if (url.includes('variables=') && /Timeline|Tweets|Media|Search|Likes|Bookmarks/i.test(url)) {
                const headers = {};
                if (args[0] instanceof Request) {
                    for (let [k, v] of args[0].headers.entries()) headers[k] = v;
                }
                if (args[1] && args[1].headers) {
                    const h = args[1].headers;
                    if (typeof h.entries === 'function') {
                        for (let [k, v] of h.entries()) headers[k] = v;
                    } else {
                        Object.assign(headers, h);
                    }
                }
                window.lastTwitterRequest = { url: url, headers: headers };
            }

            response.clone().json().then(function (data) {
                parseTwitterJSON(data);
            }).catch(function (e) {
                // Ignore parse errors on non-timeline fetches
            });
        }
        return response;
    };

    // 2. Intercept XHR (Just in case X routes through older network protocols)
    const originalXHROpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function (method, url) {
        const urlStr = url ? String(url) : '';
        this.addEventListener('load', function () {
            if (urlStr.includes('/graphql/')) {
                try {
                    const data = JSON.parse(this.responseText);
                    parseTwitterJSON(data);
                } catch (e) {
                    // ignore
                }
            }
        });
        originalXHROpen.apply(this, arguments);
    };

    // 3. The Fixed JSON Parser (Hunts down 'extended_entities')
    function parseTwitterJSON(data) {
        function searchForMedia(node, currentTweetId, currentUsername) {
            if (!node || typeof node !== 'object') return;

            // Track the Tweet ID
            if (node.__typename === 'Tweet' && node.rest_id) {
                currentTweetId = node.rest_id;
            }
            // Track the Username
            if (node.core && node.core.user_results && node.core.user_results.result && node.core.user_results.result.legacy) {
                currentUsername = node.core.user_results.result.legacy.screen_name;
            } else if (node.screen_name) {
                currentUsername = node.screen_name;
            }

            // FIND THE CURSOR
            if (node.cursorType === 'Bottom' && node.value) {
                window.nextTwitterCursor = node.value;
            }

            // FIND THE MEDIA
            if (node.extended_entities && Array.isArray(node.extended_entities.media)) {
                node.extended_entities.media.forEach(function (m) {
                    const username = currentUsername || 'i';
                    const tweetUrl = currentTweetId ? ('https://x.com/' + username + '/status/' + currentTweetId) : '#';

                    const isVideo = m.type === 'video' || m.type === 'animated_gif';
                    const mediaUrl = m.media_url_https;

                    let videoUrl = null;
                    if (isVideo && m.video_info && Array.isArray(m.video_info.variants)) {
                        const mp4s = m.video_info.variants.filter(function (v) { return v.content_type === 'video/mp4'; });
                        if (mp4s.length > 0) {
                            mp4s.sort(function (a, b) { return (b.bitrate || 0) - (a.bitrate || 0); });
                            videoUrl = mp4s[0].url;
                        }
                    }

                    if (mediaUrl && !galleryData.has(mediaUrl)) {
                        galleryData.set(mediaUrl, { mediaUrl: mediaUrl, tweetUrl: tweetUrl, isVideo: isVideo, videoUrl: videoUrl });
                    }
                });
            }

            // Recursively search every level
            Object.values(node).forEach(function (child) {
                searchForMedia(child, currentTweetId, currentUsername);
            });
        }

        searchForMedia(data, null, null);
        updatePopupUI();
    }

    // 4. Create the Floating Button
    function ensureUI() {
        if (!document.body) return;
        if (document.getElementById('network-gallery-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'network-gallery-btn';
        btn.innerText = 'Media Gallery';

        Object.assign(btn.style, {
            position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
            minHeight: '52px', padding: '0 32px',
            backgroundColor: '#eff3f4', color: '#0f1419',
            border: 'none', borderRadius: '9999px', fontWeight: '700', fontSize: '17px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'rgba(255, 255, 255, 0.1) 0px 0px 15px', transition: 'background-color 0.2s'
        });

        btn.onmouseenter = function () { this.style.backgroundColor = '#d7dbdc'; };
        btn.onmouseleave = function () { this.style.backgroundColor = '#eff3f4'; };

        btn.onclick = function () {
            const popup = document.getElementById('network-media-popup');
            if (popup) popup.style.display = 'flex';
        };
        document.body.appendChild(btn);

        buildPopup();
    }

    // 5. Build the Interactive Popup
    function buildPopup() {
        if (document.getElementById('network-media-popup')) return;

        const popup = document.createElement('div');
        popup.id = 'network-media-popup';

        Object.assign(popup.style, {
            position: 'fixed', top: '5%', left: '10%', width: '80%', height: '90%',
            backgroundColor: '#000000', zIndex: '100000', borderRadius: '16px',
            boxShadow: '0 0 40px rgba(255,255,255,0.05)', display: 'none', flexDirection: 'column',
            border: '1px solid #2f3336'
        });

        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '16px 24px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', borderBottom: '1px solid #2f3336'
        });

        const title = document.createElement('h2');
        title.id = 'gallery-title';
        title.innerText = 'Gallery: 0 items (Scroll timeline to load more)';
        title.style.color = 'white';
        title.style.margin = '0';
        title.style.fontFamily = 'system-ui, sans-serif';

        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width: 20px; height: 20px; fill: white;"><path d="M13.414 12l5.793-5.793c.39-.39.39-1.023 0-1.414s-1.023-.39-1.414 0L12 10.586 6.207 4.793c-.39-.39-1.023-.39-1.414 0s-.39 1.023 0 1.414L10.586 12l-5.793 5.793c-.39.39-.39 1.023 0 1.414.195.195.45.293.707.293s.512-.098.707-.293L12 13.414l5.793 5.793c.195.195.45.293.707.293s.512-.098.707-.293c.39-.39.39-1.023 0-1.414L13.414 12z"></path></svg>';
        Object.assign(closeBtn.style, {
            width: '36px', height: '36px', borderRadius: '50%', border: 'none',
            backgroundColor: 'transparent', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s',
            padding: '0', marginLeft: '8px'
        });
        closeBtn.onmouseenter = function() { this.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'; };
        closeBtn.onmouseleave = function() { this.style.backgroundColor = 'transparent'; };
        closeBtn.onclick = function () {
            popup.style.display = 'none';
        };

        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.innerText = '⬇️ Fetch More Media';
        Object.assign(loadMoreBtn.style, {
            padding: '8px 16px', backgroundColor: '#eff3f4', color: '#0f1419',
            border: 'none', borderRadius: '999px', cursor: 'pointer', fontWeight: 'bold',
            marginLeft: 'auto', marginRight: '16px', fontSize: '14px', fontFamily: 'system-ui, sans-serif'
        });
        
        loadMoreBtn.onclick = function() {
            if (!window.lastTwitterRequest || !window.nextTwitterCursor) {
                if (loadMoreBtn.innerText.includes('Auto-scrolling')) return;
                
                loadMoreBtn.innerText = 'Auto-scrolling to capture API...';
                const initialScroll = window.scrollY;
                let checkAttempts = 0;
                
                const checkInterval = setInterval(function() {
                    checkAttempts++;
                    if (window.lastTwitterRequest && window.nextTwitterCursor) {
                        clearInterval(checkInterval);
                        window.scrollTo({ top: initialScroll, behavior: 'smooth' });
                        loadMoreBtn.innerText = '⬇️ Fetch More Media';
                        loadMoreBtn.click();
                    } else if (checkAttempts > 10) {
                        clearInterval(checkInterval);
                        loadMoreBtn.innerText = 'Failed. Try manual scroll.';
                        setTimeout(function() { loadMoreBtn.innerText = '⬇️ Fetch More Media'; }, 2000);
                    } else {
                        window.scrollTo(0, document.body.scrollHeight);
                    }
                }, 400);
                return;
            }
            
            loadMoreBtn.innerText = 'Loading...';
            const req = window.lastTwitterRequest;
            try {
                const urlObj = new URL(req.url, window.location.origin);
                const varsStr = urlObj.searchParams.get('variables');
                if (varsStr) {
                    const vars = JSON.parse(varsStr);
                    vars.cursor = window.nextTwitterCursor;
                    urlObj.searchParams.set('variables', JSON.stringify(vars));
                    
                    originalFetch(urlObj.toString(), { headers: req.headers })
                        .then(function(res) { return res.json(); })
                        .then(function(data) {
                            parseTwitterJSON(data);
                            loadMoreBtn.innerText = '⬇️ Fetch More Media';
                        })
                        .catch(function(e) {
                            loadMoreBtn.innerText = 'Error!';
                            setTimeout(function() { loadMoreBtn.innerText = '⬇️ Fetch More Media'; }, 2000);
                        });
                }
            } catch (e) {
                loadMoreBtn.innerText = 'Error!';
            }
        };

        header.appendChild(title);
        header.appendChild(loadMoreBtn);
        header.appendChild(closeBtn);

        const grid = document.createElement('div');
        grid.id = 'network-gallery-grid';
        Object.assign(grid.style, {
            flex: '1', overflowY: 'auto', padding: '0px', display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)', gap: '3px', minHeight: '0',
            alignContent: 'start'
        });

        popup.appendChild(header);
        popup.appendChild(grid);
        document.body.appendChild(popup);
        
        // Ensure any early intercepted data is populated
        updatePopupUI();
    }

    // 5.5 Lightbox Viewer
    function openLightbox(data) {
        let viewer = document.getElementById('network-lightbox');
        if (!viewer) {
            viewer = document.createElement('div');
            viewer.id = 'network-lightbox';
            Object.assign(viewer.style, {
                position: 'fixed', top: '0', left: '0', width: '100vw', height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.9)', zIndex: '100001',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            });
            viewer.onclick = function () { viewer.style.display = 'none'; viewer.innerHTML = ''; };
            viewer.tabIndex = -1;
            viewer.style.outline = 'none';
            document.body.appendChild(viewer);
        }
        viewer.innerHTML = '';
        
        if (data.isVideo && data.videoUrl) {
            const vid = document.createElement('video');
            vid.src = data.videoUrl;
            vid.controls = true;
            vid.autoplay = true;
            Object.assign(vid.style, { maxWidth: '80%', maxHeight: '80%', outline: 'none' });
            vid.onclick = function (e) { e.stopPropagation(); };
            viewer.appendChild(vid);
        } else {
            const img = document.createElement('img');
            img.src = data.mediaUrl;
            Object.assign(img.style, { maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' });
            img.onclick = function (e) { e.stopPropagation(); };
            viewer.appendChild(img);
        }
        
        const closeBtn = document.createElement('button');
        closeBtn.innerText = '✕';
        Object.assign(closeBtn.style, {
            position: 'absolute', top: '24px', left: '24px', color: 'white',
            background: 'rgba(0,0,0,0.5)', border: 'none', fontSize: '24px',
            width: '48px', height: '48px', borderRadius: '50%', cursor: 'pointer',
            display: 'flex', justifyContent: 'center', alignItems: 'center'
        });
        viewer.appendChild(closeBtn);

        const tweetLink = document.createElement('a');
        tweetLink.href = data.tweetUrl;
        tweetLink.target = '_blank';
        tweetLink.innerText = 'View Original Tweet ↗';
        Object.assign(tweetLink.style, {
            position: 'absolute', bottom: '24px', right: '24px', color: 'white',
            background: 'rgb(29, 155, 240)', padding: '12px 24px', borderRadius: '999px',
            textDecoration: 'none', fontFamily: 'system-ui, sans-serif', fontWeight: 'bold'
        });
        tweetLink.onclick = function (e) { e.stopPropagation(); };
        viewer.appendChild(tweetLink);

        const bookmarkBtn = document.createElement('button');
        bookmarkBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: white;"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5zM6.5 4c-.276 0-.5.22-.5.5v14.56l6-4.29 6 4.29V4.5c0-.28-.224-.5-.5-.5h-11z"></path></svg>';
        Object.assign(bookmarkBtn.style, {
            position: 'absolute', bottom: '24px', left: '24px', background: 'rgba(0,0,0,0.5)',
            border: 'none', borderRadius: '50%', width: '48px', height: '48px',
            cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center',
            transition: 'transform 0.2s'
        });
        
        bookmarkBtn.onclick = async function(e) {
            e.stopPropagation();
            if (!window.lastTwitterRequest) return alert('Timeline API keys not captured yet.');
            
            const originalHTML = bookmarkBtn.innerHTML;
            bookmarkBtn.innerHTML = '⏳';
            
            if (!window.bookmarkQueryId) {
                const scriptUrls = Array.from(document.querySelectorAll('script[src]'))
                    .map(function(s) { return s.src; })
                    .filter(function(src) { return src.includes('client-web/'); });
                    
                await Promise.all(scriptUrls.map(async function(url) {
                    if (window.bookmarkQueryId) return;
                    try {
                        const text = await fetch(url).then(function(r) { return r.text(); });
                        const match = text.match(/queryId:"([^"]+)",operationName:"CreateBookmark"/);
                        if (match) window.bookmarkQueryId = match[1];
                    } catch(err) {}
                }));
            }
            
            if (!window.bookmarkQueryId) {
                bookmarkBtn.innerHTML = '❌';
                setTimeout(function() { bookmarkBtn.innerHTML = originalHTML; }, 2000);
                return;
            }
            
            const targetId = data.tweetUrl.split('/status/').pop().split('?')[0];
            const url = 'https://' + window.location.host + '/i/api/graphql/' + window.bookmarkQueryId + '/CreateBookmark';
            const payload = {
                variables: { tweet_id: targetId },
                queryId: window.bookmarkQueryId
            };
            
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: Object.assign({}, window.lastTwitterRequest.headers, { 'content-type': 'application/json' }),
                    body: JSON.stringify(payload)
                });
                const json = await res.json();
                if (json.errors) throw new Error('API Error');
                
                bookmarkBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: rgb(29, 155, 240);"><path d="M4 4.5C4 3.12 5.119 2 6.5 2h11C18.881 2 20 3.12 20 4.5v18.44l-8-5.71-8 5.71V4.5z"></path></svg>';
                bookmarkBtn.style.transform = 'scale(1.2)';
                setTimeout(function() { bookmarkBtn.style.transform = 'scale(1)'; }, 200);
            } catch (err) {
                bookmarkBtn.innerHTML = '❌';
                setTimeout(function() { bookmarkBtn.innerHTML = originalHTML; }, 2000);
            }
        };
        viewer.appendChild(bookmarkBtn);

        const mediaArray = Array.from(galleryData.values());
        const currentIndex = mediaArray.findIndex(function (m) { return m.mediaUrl === data.mediaUrl; });

        if (currentIndex > 0) {
            const leftBtn = document.createElement('button');
            leftBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: white;"><path d="M14.2 18.26l-6.2-6.26 6.2-6.26.7.7-5.5 5.56 5.5 5.56-.7.7z"></path></svg>';
            Object.assign(leftBtn.style, {
                position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                width: '48px', height: '48px', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            });
            leftBtn.onclick = function (e) {
                e.stopPropagation();
                openLightbox(mediaArray[currentIndex - 1]);
            };
            viewer.appendChild(leftBtn);
        }

        if (currentIndex >= 0 && currentIndex < mediaArray.length - 1) {
            const rightBtn = document.createElement('button');
            rightBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width: 24px; height: 24px; fill: white;"><path d="M9.8 18.26l-.7-.7 5.5-5.56-5.5-5.56.7-.7 6.2 6.26-6.2 6.26z"></path></svg>';
            Object.assign(rightBtn.style, {
                position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                width: '48px', height: '48px', cursor: 'pointer',
                display: 'flex', justifyContent: 'center', alignItems: 'center'
            });
            rightBtn.onclick = function (e) {
                e.stopPropagation();
                openLightbox(mediaArray[currentIndex + 1]);
            };
            viewer.appendChild(rightBtn);
        }
        
        viewer.onkeydown = function(e) {
            if (e.key === 'ArrowLeft' && currentIndex > 0) {
                openLightbox(mediaArray[currentIndex - 1]);
            } else if (e.key === 'ArrowRight' && currentIndex < mediaArray.length - 1) {
                openLightbox(mediaArray[currentIndex + 1]);
            } else if (e.key === 'Escape') {
                viewer.style.display = 'none';
                viewer.innerHTML = '';
            }
        };
        
        viewer.style.display = 'flex';
        viewer.focus();
    }

    // 6. Populate Grid
    function updatePopupUI() {
        const grid = document.getElementById('network-gallery-grid');
        const title = document.getElementById('gallery-title');
        if (!grid || !title) return;

        title.innerText = 'Gallery: ' + galleryData.size + ' items (Scroll timeline to load more)';

        const wasAtBottom = grid.scrollHeight - grid.scrollTop - grid.clientHeight < 50;
        let addedNew = false;

        galleryData.forEach(function (data, mediaUrl) {
            if (renderedMedia.has(mediaUrl)) return;
            renderedMedia.add(mediaUrl);
            addedNew = true;

            const link = document.createElement('div');
            link.style.cursor = 'pointer';
            link.onclick = function () { openLightbox(data); };
            
            Object.assign(link.style, {
                position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: '#000',
                display: 'block', overflow: 'hidden'
            });

            // Replaced the arrow functions here to fix the lines 173 and 174 syntax errors
            link.onmouseenter = function () { this.style.opacity = '0.8'; };
            link.onmouseleave = function () { this.style.opacity = '1'; };

            const img = document.createElement('img');
            img.src = data.mediaUrl;
            Object.assign(img.style, { 
                position: 'absolute', top: '0', left: '0', 
                width: '100%', height: '100%', objectFit: 'cover' 
            });
            link.appendChild(img);

            if (data.isVideo) {
                const play = document.createElement('div');
                play.innerHTML = '<svg viewBox="0 0 24 24" style="width: 28px; height: 28px; fill: white; margin-left: 4px;"><path d="M8 5.14v14l11-7-11-7z"></path></svg>';
                Object.assign(play.style, {
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    width: '56px', height: '56px', backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    pointerEvents: 'none', backdropFilter: 'blur(4px)'
                });
                link.appendChild(play);
            }

            grid.appendChild(link);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureUI);
    } else {
        ensureUI();
    }
    setInterval(ensureUI, 2000);

})();