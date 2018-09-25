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
    });
}

function youtube_parser(url, extractTime) {
    // This regex has no right to work. It has a bug disguised as a feature. But it works so I'm keeping it (for now)
    var regExp = /^.*(?:youtu.be\/|v\/|\/u\/\w\/|embed\/|watch)(?:(?:\?v=)?|(?:\?time_continue=)?)(?:([^#\&\?]*).*)(?:\&?v=(.+))?/;
    var match = url.match(regExp);
    if (match && extractTime) match[2] = parseInt(match[1].replace(/[^0-9]/g, ''));
    return (match && match[2]) ? match[2] : false;
}
function youtube_playlist_parser(url) {
    var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(list\=))([^#\&\?]*).*/;
    var match = url.match(regExp);
    return (match && match[6].length == 34) ? match[6] : false;
}

function checkUrl(url, tabId, bypass) {
    getStoredStatus('enabled', enabled => {
        if ((youtube_parser(url) !== false || youtube_playlist_parser(url) !== false) && (enabled || bypass)) {
            setTimeout(() => {
                prevUrl = url;
                chrome.runtime.sendMessage({ pauseVideo: true, tabId: tabId });
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
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        tab = tab[0];
        if (youtube_parser(tab.url) !== false || youtube_playlist_parser(tab.url) !== false) {
            checkUrl(tab.url, tab.id, true);
        } else {
            console.log('Not a YouTube link!\n', tab.url);
        }
    });
}

getStoredStatus('enabled', result => {
    document.getElementById('enabled').innerText = (result ? 'enabled ' : 'disabled');
    if (result) {
        document.getElementById('onoff').checked = true;
    }
});

getStoredStatus('closeOnSwitch', result => {
    if (result) {
        document.getElementById('closeTab').checked = true;
    }
});


document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('onoff').addEventListener('change', () => {
        chrome.runtime.sendMessage({ changeState: document.getElementById('onoff').checked });
        document.getElementById('enabled').innerText = (document.getElementById('onoff').checked ? 'enabled ' : 'disabled');
    });

    document.getElementById('closeTab').addEventListener('change', () => {
        chrome.runtime.sendMessage({ closeOnSwitch: document.getElementById('closeTab').checked });
    });

    document.getElementById('openInMyTube').addEventListener('click', () => {
        checkCurrentTab();
    });
    if (navigator.appVersion.includes('Edge')) {
        document.querySelector('#closeTab').parentElement.style.display = 'none';
    }
});
