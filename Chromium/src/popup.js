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

                        time = toHHMMSS(Math.round(document.getElementsByTagName('video')[0].currentTime));
                        window.location.assign('rykentube:PlayVideo?ID=${youtube_parser(url)}&Position=' + time);
                    `
                });
            }, 500);
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

