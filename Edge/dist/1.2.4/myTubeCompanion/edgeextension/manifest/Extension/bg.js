if (!(chrome && chrome.tabs) && (browser && browser.tabs)) {
    // Replacing chrome.tabs with browser.tabs for Firefox / other browsers that may need it
    chrome.tabs = browser.tabs;
}

function youtube_parser(url, extractTime) {
    var regExp = /^.*(?:youtu.be\/|v\/|\/u\/|(?:\bembed\b)|\bwatch\b)(?:\?|\/)(?:(?:\bv=\b|\btime_continue=\b)?(?:([^#\&\?]*)))?(?:\&v=(.*))?(?:.*)/;
    var match = url.match(regExp);
    if (match && !isNaN(match[1]) && extractTime !== true) match[1] = match[2];
    return (match && match[1]) ? match[1] : false;
}

function youtube_playlist_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(list\=))([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[6].length == 34) ? match[6] : false;
}

let enabled, prevUrl, closeOnSwitch;

function checkUrl(url, tabId, bypass) {
    getStoredStatus('enabled', enabled => {
        if ((youtube_playlist_parser(url) !== false || youtube_parser(url) !== false) && bypass !== true && enabled) {

            let rykentubeProtocol = `rykentube:PlayVideo?ID=${youtube_parser(url)}&Position=`;
            let timeMethod = `
            time = toHHMMSS(Math.round(document.getElementsByTagName('video')[0].currentTime));
            `;
            if (youtube_playlist_parser(url) !== false) {
                if (youtube_parser(url) !== false) {
                    rykentubeProtocol = `rykentube:PlayVideo?ID=${youtube_parser(url)}&PlaylistID=${youtube_playlist_parser(url)}&Position=`;
                }
            }
            if (!isNaN(youtube_parser(url, true))) {
                timeMethod = `time = toHHMMSS(${youtube_parser(url, true)})`;
            }
            pauseVideo(tabId);
            setTimeout(() => {
                prevUrl = url;
                chrome.tabs.executeScript(tabId, {
                    code: `
                        var toHHMMSS = function (secs) { 
                             var seconds = parseInt(secs, 10);
                             var hours   = Math.floor(seconds / 3600);
                             var minutes = Math.floor((seconds - (hours * 3600)) / 60);
                             var seconds = seconds - (hours * 3600) - (minutes * 60);
             
                             if (hours   < 10) {hours   = "0"+hours;}
                             if (minutes < 10) {minutes = "0"+minutes;}
                             if (seconds < 10) {seconds = "0"+seconds;}
                             let time    = hours+':'+minutes+':'+seconds;
                             return time;
                         }
  
                        ${timeMethod}
                        window.location.assign('${rykentubeProtocol}' + time);
                    `
                });
                setTimeout(() => {
                    if (closeOnSwitch == true) chrome.tabs.remove(tabId);
                }, 100);
            }, 500);
        }
    });
}

function pauseVideo(tabId) {
    getStoredStatus('closeOnSwitch', closeOnSwitch => {
        if (closeOnSwitch == false) {
            chrome.tabs.executeScript(tabId, {
                // Confirm that the videos are playing and loaded before trying to pause it
                code: `
                function recursiveVideoCheck() {
                    document.querySelectorAll('video').forEach(vid => {
                        if(vid.currentTime > 0 && !vid.paused) {
                           vid.pause();
                        } else {
                            setTimeout(()=>{
                                recursiveVideoCheck();
                            }, 200);
                        }
                    });
                }
                window.addEventListener("load", function(event) { 
                    recursiveVideoCheck(); // For when it fires before the page is loaded
                });
                recursiveVideoCheck(); // For when it fires after the page is loaded
                `
            });
        }
    });
}

function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};

checkUrl = debounce(checkUrl, 1000);
pauseVideo = debounce(pauseVideo, 1000)

function setStoredStatus(key, status) {
    if (chrome && chrome.storage && chrome.storage.local) {
        if (key == 'enabled') enabled = status;
        toSet = new Object();
        toSet[key] = status;
        chrome.storage.local.set(toSet);
    } else {
        console.error('Cannot access storage API. State cannot be saved');
    }
}

function getStoredStatus(key, cb) {
    chrome.storage.local.get([key], result => {
        if (result == undefined) setStoredStatus(key, true);
        cb(result[key]);
    })
}

if (chrome && chrome.webNavigation !== undefined && chrome.webNavigation.onBeforeNavigate !== undefined) {
    chrome.webNavigation.onBeforeNavigate.addListener((result) => {
        if (result !== undefined && result.tabId !== undefined) {
            chrome.tabs.executeScript(result.tabId, {
                code: `
                ${youtube_parser.toString()}
                
                function setLinks() {
                    document.querySelectorAll('a').forEach(element => {
                        if(youtube_parser(element.href) !== false) {
                            element.setAttribute('onmousedown', '');
                            element.setAttribute('jsaction', '');
                            element.setAttribute('data-cthref', 'rykentube:PlayVideo?ID=' + youtube_parser(element.href)); // Screw you google
                            element.setAttribute('href', 'rykentube:PlayVideo?ID=' + youtube_parser(element.href));
                            element.target='';
                            element.parentNode.replaceChild(element.cloneNode(true), element);
                        }
                    });
                }
    
                window.addEventListener("load", function(event) { 
                    if(window.location.hostname.includes('youtube.') == false) setLinks()
                });
                `
            });
        }

        if (result !== undefined && result.url !== undefined && result.tabId !== undefined) {
            if ((result.url.includes('/embed/') && result.url.includes('autoplay=1')) || !result.url.includes('/embed/')) {
                checkUrl(result.url, result.tabId);
            }
        }
    }, {
            url: [{ hostContains: "youtube" }]
        });
}

chrome.tabs.onUpdated.addListener(function(tabId, result, tab) {
    if (result && (result.status == "complete" || result.status == "loading") && tabId !== undefined) {
        chrome.tabs.executeScript(tabId, {
            code: `
            ${youtube_parser.toString()}
            
            function setLinks() {
                document.querySelectorAll('a').forEach(element => {
                    if(youtube_parser(element.href) !== false) {
                        console.log(element.href, youtube_parser(element.href));
                        element.setAttribute('onmousedown', '');
                        element.setAttribute('jsaction', '');
                        element.setAttribute('data-cthref', 'rykentube:PlayVideo?ID=' + youtube_parser(element.href)); // Screw you google
                        element.setAttribute('href', 'rykentube:PlayVideo?ID=' + youtube_parser(element.href));
                        element.target='';
                        element.parentNode.replaceChild(element.cloneNode(true), element);
                    }
                });
            }

            window.addEventListener("load", function(event) { 
                console.log(window.location.hostname);
                if(window.location.hostname.includes('youtube.') == false) setLinks()
            });
            `
        });
    }

    if (result.url && result.url.includes('rykentube:')) {
        setTimeout(() => {
            chrome.tabs.remove(tabId);
        }, 1000);
    }
    if (result !== undefined && result.url !== undefined && result.status == "loading" && result.url !== prevUrl && enabled) {
        // Make sure we didn't grab an embedded video
        if ((result.url.includes('/embed/') && result.url.includes('autoplay=1')) || !result.url.includes('/embed/')) {
            checkUrl(result.url, tabId);
        }
    }
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.changeState !== undefined) {
        setStoredStatus('enabled', request.changeState);
        enabled = request.enabled;
    }
    if (request.pauseVideo !== undefined) {
        pauseVideo(request.tabId);
    }

    if (request.checkUrl !== undefined) {
        checkUrl(request.checkUrl, request.tabId, true)
    }

    if (request.closeOnSwitch !== undefined) {
        setStoredStatus('closeOnSwitch', request.closeOnSwitch);
        closeOnSwitch = request.closeOnSwitch;
    }
});

getStoredStatus('enabled', result => {
    enabled = result;
});

getStoredStatus('closeOnSwitch', result => {
    closeOnSwitch = result;
});

if (navigator.appVersion.includes('Edge')) {
    setStoredStatus('closeOnSwitch', false);
} 