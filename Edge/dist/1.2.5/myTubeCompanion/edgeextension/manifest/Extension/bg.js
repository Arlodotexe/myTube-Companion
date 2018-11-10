if (!(chrome && chrome.tabs) && (browser && browser.tabs)) {
    // Replacing chrome.tabs with browser.tabs for Firefox / other browsers that may need it
    chrome.tabs = browser.tabs;
}

let enabled, prevUrl, closeOnSwitch;

const openByUsernameFeatureReleaseDate = { "month": 12, "day": 25, "year": 2018 };

function featureIsDelayed(feature) {
    return new Promise(resolve => {
        fetch('http://rykenapps.com/mytube/companion/featureDelays.json')
            .then(res => res.json())
            .then((out) => {
                if (new Date().getDay() > out['feature'].day - 1 && new Date().getMonth() > out['feature'].month - 1 && new Date().getFullYear > out['feature'].year - 1) {
                    resolve(false);
                } else {
                    resolve(true);
                }
            })
            .catch(err => {
                if (new Date().getDay() > eval(feature + 'FeatureReleaseDate').day - 1 && new Date().getMonth() > eval(feature + 'FeatureReleaseDate').month - 1 && new Date().getFullYear > eval(feature + 'FeatureReleaseDate').year - 1) {
                    resolve(false);
                } else {
                    resolve(true);
                }
                resolve(eval(feature + 'FeatureReleaseDate'));
                console.error('Could not load resource. Using hardcoded fallback data');
            });
    });
}

function toHHMMSS(secs) {
    if (secs == undefined || secs == null) return null;
    let seconds = parseInt(secs, 10);
    let hours = Math.floor(seconds / 3600);
    let minutes = Math.floor((seconds - (hours * 3600)) / 60);
    seconds = seconds - (hours * 3600) - (minutes * 60);

    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
    return hours + ':' + minutes + ':' + seconds;
}

function isYoutube(url) {
    if (typeof url == 'string') {
        let match = url.match(/^.*(youtube\.[a-z]{0,4})|^.*(youtu\.be)/);
        return (match && match[1]) ? match[1] : null;
    } else console.error('Incorrect data recieved while checking domain');
}
function hasVideo(url) {
    if (typeof url == 'string') {
        let match = url.match(/^.*(?:v=)([a-zA-Z0-9-_]+)/);
        return (match && match[1]) ? match[1] : null;
    } else console.error('Incorrect data recieved while checking for video');
}
function hasPlaylist(url) {
    if (typeof url == 'string') {
        let match = url.match(/^.*(?:list=)([a-zA-Z0-9-_]+)/);
        return (match && match[1]) ? match[1] : null;
    } else console.error('Incorrect data recieved while checking for playlist');
}
function hasTimestamp(url) {
    if (typeof url == 'string') {
        let match = url.match(/^.*(?:\btime_continue=\b|\bt=\b)([0-9]+)/);
        return (match !== null ? toHHMMSS(match[1]) : null);
    } else console.error('Incorrect data recieved while checking for timestamp');
}
async function hasChannel(url) {
    let match = url.match(/^.*(?:youtube\.[a-z]{0,4})(?:\/channel\/)(.{22,})/);
    if (await featureIsDelayed('openByUsername') == false) {
        match = url.match(/^.*(?:youtube\.[a-z]{0,4})(?:\/channel\/|\/user\/)(.{22,})/);
    }
    return (match && match[1]) ? match[1] : null;
}

function checkUrl(url) {
    if (hasPlaylist(url) !== null) { // Is a playlist
        if (hasVideo(url) !== null) { // Is a playlist with a video
            if (hasTimestamp(url) !== null) { // Is a playlist with a video and a timestamp
                console.info('Playlist, video and timestamp detected. Will use protocol: ');
                return `rykentube:PlayVideo?ID=${hasVideo(url)}&PlaylistID=${hasPlaylist(url)}&Position=${hasTimestamp(url)}`;
            } else {
                console.info('Playlist and video detected. Will use protocol: ');
                return `rykentube:PlayVideo?ID=${hasVideo(url)}&PlaylistID=${hasPlaylist(url)}`;
            }
        } else { // Is just a playlist with no video
            console.info('Playlist detected. Will use protocol: ');
            return `rykentube:Playlist?ID=${hasPlaylist(url)}`;
        }
    } else if (hasVideo(url) !== null) { // Is a video
        if (hasTimestamp(url) !== null) { // Is a video with a timestamp
            console.info('Video and timestamp detected. Will use protocol:');
            return `rykentube:PlayVideo?ID=${hasVideo(url)}&Position=${hasTimestamp(url)}`;
        } else {
            console.info('Video detected. Will use protocol: \n ');
            return `rykentube:PlayVideo?ID=${hasVideo(url)}`;
        }
    } else if (hasChannel(url) !== null) { // Is a channel
        console.info('Channel detected. Will use protocol: ');
        return `rykentube:Channel?ID=${hasChannel(url)}`;
    } else {
        console.info('This youtube page is not supported by the myTube Companion');
        return undefined;
    }
}

function openInApp(url, tabId, bypass) {
    getStoredStatus('enabled', enabled => {
        if ((isYoutube(url) !== null) && bypass !== true && enabled) {
            let rykentubeProtocol = checkUrl(url, tabId);
            if (rykentubeProtocol !== undefined) {

                console.log(rykentubeProtocol);
                pauseVideo(tabId);

                setTimeout(() => {
                    prevUrl = url;
                    chrome.tabs.executeScript(tabId, {
                        code: `window.location.assign('${rykentubeProtocol}');`
                    }, function() {
                        if (closeOnSwitch == true) chrome.tabs.remove(tabId);
                    });
                }, 500);
            }
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

openInApp = debounce(openInApp, 1000);
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
        if (result[key] == undefined) setStoredStatus(key, true);
        cb(result[key]);
    })
}

if (chrome && chrome.webNavigation !== undefined && chrome.webNavigation.onBeforeNavigate !== undefined) {
    chrome.webNavigation.onBeforeNavigate.addListener((result) => {
        if (result !== undefined && result.tabId !== undefined) {
            chrome.tabs.executeScript(result.tabId, {
                code: `
                ${toHHMMSS.toString()}
                ${isYoutube.toString()}
                ${hasVideo.toString()}
                ${hasTimestamp.toString()}
                ${hasPlaylist.toString()}
                ${hasChannel.toString()}
                ${checkUrl.toString()}
    
                function setLinks() {
                    document.querySelectorAll('a').forEach(element => {
                        if(isYoutube(element.href) !== null) {
                            element.setAttribute('onmousedown', '');
                            element.setAttribute('jsaction', '');
                            element.setAttribute('data-cthref', checkUrl(element.href)); // Screw you google
                            element.setAttribute('href', checkUrl(element.href));
                            element.target='';
                            element.parentNode.replaceChild(element.cloneNode(true), element);
                        }
                    });
                }
    
                window.addEventListener("load", function(event) { 
                    if(isYoutube(window.location.href) == null) setLinks();
                });
                `
            });
        }

        if (result !== undefined && result.url !== undefined && result.tabId !== undefined) {
            if ((result.url.includes('/embed/') && result.url.includes('autoplay=1')) || !result.url.includes('/embed/')) {
                openInApp(result.url, result.tabId);
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
            ${toHHMMSS.toString()}
            ${isYoutube.toString()}
            ${hasVideo.toString()}
            ${hasTimestamp.toString()}
            ${hasPlaylist.toString()}
            ${hasChannel.toString()}
            ${checkUrl.toString()}

            function setLinks() {
                document.querySelectorAll('a').forEach(element => {
                    if(isYoutube(element.href) !== null) {
                        element.setAttribute('onmousedown', '');
                        element.setAttribute('jsaction', '');
                        element.setAttribute('data-cthref', checkUrl(element.href)); // Screw you google
                        element.setAttribute('href', checkUrl(element.href));
                        element.target='';
                        element.parentNode.replaceChild(element.cloneNode(true), element);
                    }
                });
            }

            window.addEventListener("load", function(event) { 
                if(isYoutube(window.location.href) == null) setLinks();
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
            openInApp(result.url, tabId);
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

    if (request.openInApp !== undefined) {
        openInApp(request.openInApp, request.tabId, true)
    }

    if (request.closeOnSwitch !== undefined) {
        setStoredStatus('closeOnSwitch', request.closeOnSwitch);
        closeOnSwitch = request.closeOnSwitch;
    }
});

getStoredStatus('enabled5', result => {
    enabled = result;
});

getStoredStatus('closeOnSwitch', result => {
    closeOnSwitch = result;
});

if (navigator.appVersion.includes('Edge')) {
    setStoredStatus('closeOnSwitch', false);
} 