function youtube_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

let enabled, prevUrl;

function checkUrl(url, tabId, bypass) {
    getStoredStatus(enabled => {
        if (youtube_parser(url) !== false && bypass !== true && enabled) {
            pauseVideoDB(tabId);
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
                         var time    = hours+':'+minutes+':'+seconds;
                         return time;
                     }
    
                    let time = toHHMMSS(Math.round(document.getElementsByTagName('video')[0].currentTime));
                    let prevUrl = window.location.href;
                    window.location.assign('rykentube:PlayVideo?ID=${youtube_parser(url)}&Position=' + time);
                `
                });
            }, 500);
        }
    });
}

function pauseVideo(tabId) {
    chrome.tabs.executeScript(tabId, {
        // Wait a bit for the video controls to load before pausing
        code: `setTimeout(()=>{
            document.getElementsByTagName('video')[0].pause();
        }, 500);`
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

checkUrlDB = debounce(checkUrl, 1000);
let pauseVideoDB = debounce(pauseVideo, 1000)


function setStoredStatus(status) {
    if (chrome && chrome.storage && chrome.storage.local) {
        enabled = status;
        chrome.storage.local.set({ enabled: status });
    } else {
        console.error('Cannot access storage API. State cannot be saved');
    }
}

function getStoredStatus(cb) {
    chrome.storage.local.get(["enabled"], result => {
        if (result.enabled == undefined) setStoredStatus(true);
        cb(result.enabled);
    })
}

if (chrome && chrome.webNavigation !== undefined && chrome.webNavigation.onBeforeNavigate !== undefined) {
    chrome.webNavigation.onBeforeNavigate.addListener((result) => {
        console.log(JSON.stringify(result), window.location.href);
        if (result !== undefined && result.url !== undefined && result.tabId !== undefined) {
            if ((!result.url.includes('autohide=') && !result.url.includes('controls=') && !result.url.includes('rel=') && !result.url.includes('/embed/'))) {
                checkUrlDB(result.url, result.tabId);
            }
        }
    }, {
            url: [{ hostContains: "youtube" }]
        });
}

chrome.tabs.onUpdated.addListener(function(tabId, result, tab) {
    if (result.url && result.url.includes('rykentube:')) {
        setTimeout(() => {
            chrome.tabs.remove(tabId);
        }, 1000);
    }
    if (result !== undefined && result.url !== undefined && result.status == "loading" && result.url !== prevUrl && enabled) {
        // Make sure we didn't grab an embedded video
        if ((!result.url.includes('autohide=') && !result.url.includes('controls=') && !result.url.includes('rel=') && !result.url.includes('/embed/'))) {
            checkUrlDB(result.url, tabId);
        }
    }
});

chrome.runtime.onMessage.addListener(function(request) {
    if (request.changeState !== undefined) {
        setStoredStatus(request.changeState);
    }
    if (request.pauseVideo !== undefined) {
        pauseVideo(request.tabId);
    }

    if (request.checkUrl !== undefined) {
        checkUrl(request.checkUrl, request.tabId, true)
    }
});

getStoredStatus(result => {
    enabled = result;
});
