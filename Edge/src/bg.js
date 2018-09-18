if (!(chrome && chrome.tabs) && (browser && browser.tabs)) {
    // Replacing chrome.tabs with browser.tabs for Firefox / other browsers that may need it
    chrome.tabs = browser.tabs;
  }
  
  function youtube_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
  }
  
  function youtube_playlist_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(list\=))([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[6].length == 34) ? match[6] : false;
  }
  
  let enabled, prevUrl, closeOnSwitch;
  
  function checkUrl(url, tabId, bypass) {
    getStoredStatus('enabled', enabled => {
        if ((youtube_parser(url) !== false || youtube_playlist_parser(url) !== false) && bypass !== true && enabled) {
            let rykentubeProtocol = `rykentube:PlayVideo?ID=${youtube_parser(url)}&Position=`;
            pauseVideoDB(tabId);
            // Can't open videos if they are in a playlist now. Fix it! :D
            if (youtube_playlist_parser(url) !== false) {
                rykentubeProtocol = `rykentube:PlayVideo?ID=${youtube_parser(url)}&PlaylistID=${youtube_playlist_parser(url)}&Position=`;
            }
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
  
                        time = toHHMMSS(Math.round(document.getElementsByTagName('video')[0].currentTime));
                        window.location.assign('${rykentubeProtocol}' + time);
                    `
                });
                if (closeOnSwitch == true) chrome.tabs.remove(tabId);
            }, 500);
        }
    });
  }
  
  function pauseVideo(tabId) {
    getStoredStatus('closeOnSwitch', closeOnSwitch => {
        if (closeOnSwitch == false) {
            chrome.tabs.executeScript(tabId, {
                // Confirm that the video is playing and loaded before trying to pause it
                code: `
                function recursiveVideoCheck() {
                    let vid = document.getElementsByTagName('video')[0];
                    if(vid.currentTime > 0 && !vid.paused) {
                        document.getElementsByTagName('video')[0].pause();
                    } else {
                        setTimeout(()=>{
                            recursiveVideoCheck();
                        }, 200);
                    }
                }
                recursiveVideoCheck();
                
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
  let pauseVideoDB = debounce(pauseVideo, 1000)
  
  
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
                function youtube_parser(url) {
                    var regExp = /^.*((youtu.be\\/)|(v\\/)|(\\/u\\/\\w\\/)|(embed\\/)|(watch\\?))\\??v?=?([^#\\&\\?]*).*/;
                    var match = url.match(regExp);
                    return (match && match[7].length == 11) ? match[7] : false;
                }
                
                document.querySelectorAll('a').forEach(element => {
                    if(youtube_parser(element.href) !== false) {
                        element.href = 'rykentube:PlayVideo?ID=' + youtube_parser(element.href);
                        element.target='';
                    }
                });
                `
            });
        }
  
        if (result !== undefined && result.url !== undefined && result.tabId !== undefined) {
            if ((!result.url.includes('autohide=') && !result.url.includes('controls=') && !result.url.includes('rel=') && !result.url.includes('/embed/'))) {
                checkUrl(result.url, result.tabId);
            }
        }
    }, {
            url: [{ hostContains: "youtube" }]
        });
  }
  
chrome.tabs.onUpdated.addListener(function(tabId, result, tab) {
    if (result && result.status == "complete" && tabId !== undefined) {
        chrome.tabs.executeScript(tabId, {
            code: `
            function youtube_parser(url) {
                var regExp = /^.*((youtu.be\\/)|(v\\/)|(\\/u\\/\\w\\/)|(embed\\/)|(watch\\?))\\??v?=?([^#\\&\\?]*).*/;
                var match = url.match(regExp);
                return (match && match[7].length == 11) ? match[7] : false;
            }
            
            document.querySelectorAll('a').forEach(element => {
                if(youtube_parser(element.href) !== false) {
                    element.href = 'rykentube:PlayVideo?ID=' + youtube_parser(element.href);
                    element.target='';
                }
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
        if ((!result.url.includes('autohide=') && !result.url.includes('controls=') && !result.url.includes('rel=') && !result.url.includes('/embed/'))) {
            checkUrl(result.url, tabId);
        }
    }
  });
  
  chrome.runtime.onMessage.addListener(function(request) {
    if (request.changeState !== undefined) {
        setStoredStatus('enabled', request.changeState);
    }
    if (request.pauseVideo !== undefined) {
        pauseVideo(request.tabId);
    }
  
    if (request.checkUrl !== undefined) {
        checkUrl(request.checkUrl, request.tabId, true)
    }
  
    if (request.closeOnSwitch !== undefined) {
        setStoredStatus('closeOnSwitch', request.closeOnSwitch);
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