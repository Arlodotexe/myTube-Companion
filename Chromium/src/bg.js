function youtube_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

let enabled;

function checkUrl(url, tabId, bypass) {
    getStoredStatus(enabled => {
        if (youtube_parser(url) !== false && bypass !== true && enabled) {
            pauseVideoDB(tabId);
            setTimeout(() => {
                chrome.tabs.create({
                    url: 'rykentube:Video?ID=' + youtube_parser(url),
                }, function(tab) {
                    setTimeout(() => {
                        chrome.tabs.remove(tab.id);
                    }, 500);
                });
            }, 500);
        }
    });
}

function pauseVideo(tabId) {
    console.log('Pausing');
    chrome.tabs.executeScript(tabId, {
        // Double pausing here because it doesn't work on page refresh otherwise. pause() doesn't play the video so this is fine.
        code: `document.getElementsByTagName('video')[0].pause();document.getElementsByTagName('video')[0].pause();`
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

chrome.webNavigation.onBeforeNavigate.addListener((result) => {
    if (result.url && result.tabId && result.url && youtube_parser(result.url) !== false) {
        checkUrl(result.url, result.tabId);
    }
}, {
        url:
            [{ hostContains: "youtube" }]
    }
);

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.url && changeInfo.url.includes('rykentube:')) {
        setTimeout(() => {
            chrome.tabs.remove(tabId);
        }, 1000);
    }
    console.log(JSON.stringify  (changeInfo));
    if (changeInfo !== undefined && changeInfo.url !== undefined && changeInfo.status == "loading" && youtube_parser(changeInfo.url) !== false && enabled) {
        checkUrlDB(changeInfo.url, tabId);
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
