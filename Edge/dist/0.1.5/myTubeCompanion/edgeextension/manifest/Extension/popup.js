function setStoredStatus(status) {
    if (chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set({ enabled: status });
    } else {
        console.error('Cannot access storage API. State cannot be saved');
    }
}

function getStoredStatus(cb) {
    chrome.storage.local.get(["enabled"], result => {
        if (result.enabled == undefined) setStoredStatus(true);
        cb(result.enabled);
    });
}

function youtube_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[7].length == 11) ? match[7] : false;
}

function checkUrl(url, tabId, bypass) {
    getStoredStatus(enabled => {
        if (youtube_parser(url) !== false && (enabled || bypass)) {
            chrome.tabs.create({
                url: 'rykentube:Video?ID=' + youtube_parser(url),
            }, function(tab) {
                chrome.tabs.remove(tab.id);
                setTimeout(() => {

                    if (tabId) {
                        chrome.tabs.executeScript(tabId, {
                            code: `document.getElementsByTagName('video')[0].pause();`
                        });
                    }
                }, 500);
            });
        }
    });
}

function checkCurrentTab() {
    chrome.tabs.getSelected(null, function(tab) {
        if (youtube_parser(tab.url) !== false) {
            checkUrl(tab.url, tab.id, true);
        } else {
            console.log('Not a YouTube link!');
        }
    });
}

getStoredStatus(result => {
    document.getElementById('status').innerText = (result ? 'enabled ' : 'disabled');
    if (result) {
        document.getElementById('onoff').checked = true;
    }
});


document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('onoff').addEventListener('change', () => {
        chrome.runtime.sendMessage({ changeState: document.getElementById('onoff').checked });
        document.getElementById('status').innerText = (document.getElementById('onoff').checked ? 'enabled ' : 'disabled');
    });

    document.getElementById('openInMyTube').addEventListener('click', () => {
        checkCurrentTab();
    });
});

