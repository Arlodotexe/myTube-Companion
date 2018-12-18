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

let enabled, prevUrl, closeOnSwitch;

// This is a minified copy-paste of the code in bg.js
const openByUsernameFeatureReleaseDate={"month":12,"day":25,"year":2018};function featureIsDelayed(feature){return new Promise(resolve=>{fetch('http://rykenapps.com/mytube/companion/featureDelays.txt').then(res=>res.json()).then((out)=>{if(new Date().getDay()>out[feature].day-1&&new Date().getMonth()>out[feature].month-1&&new Date().getFullYear>out[feature].year-1){resolve(false);}else{resolve(true);}}).catch(err=>{console.error('Could not load resource. Using hardcoded fallback data');if(new Date().getDay()>eval(feature+'FeatureReleaseDate').day-1&&new Date().getMonth()>eval(feature+'FeatureReleaseDate').month-1&&new Date().getFullYear>eval(feature+'FeatureReleaseDate').year-1){resolve(false);}else{resolve(true);}});});}
function toHHMMSS(secs){if(secs==undefined||secs==null)return null;let seconds=parseInt(secs,10);let hours=Math.floor(seconds / 3600);let minutes=Math.floor((seconds-(hours*3600))/ 60);seconds=seconds-(hours*3600)-(minutes*60);if(hours<10){hours="0"+hours;}
if(minutes<10){minutes="0"+minutes;}
if(seconds<10){seconds="0"+seconds;}
return hours+':'+minutes+':'+seconds;}
function isYoutube(url){if(typeof url=='string'){let match=url.match(/^.*(youtube\.[a-z]{0,4})|^.*(youtu\.be)/);return(match&&match[1])?match[1]:null;}else console.error('Incorrect data recieved while checking domain');}
function hasVideo(url){if(typeof url=='string'){let match=url.match(/^.*(?:v=)([a-zA-Z0-9-_]+)/);return(match&&match[1])?match[1]:null;}else console.error('Incorrect data recieved while checking for video');}
function hasPlaylist(url){if(typeof url=='string'){let match=url.match(/^.*(?:list=)([a-zA-Z0-9-_]+)/);return(match&&match[1])?match[1]:null;}else console.error('Incorrect data recieved while checking for playlist');}
function hasTimestamp(url){if(typeof url=='string'){let match=url.match(/^.*(?:\btime_continue=\b|\bt=\b)([0-9]+)/);return(match!==null?toHHMMSS(match[1]):null);}else console.error('Incorrect data recieved while checking for timestamp');}
async function hasChannel(url){let match=url.match(/^.*(?:youtube\.[a-z]{0,4})(?:\/channel\/)(.{22,})/);if(await featureIsDelayed('openByUsername')==false){match=url.match(/^.*(?:youtube\.[a-z]{0,4})(?:\/channel\/|\/user\/)(.{22,})/);}
return(match&&match[1])?match[1]:null;}
async function checkUrl(url){if(hasPlaylist(url)!==null){if(hasVideo(url)!==null){if(hasTimestamp(url)!==null){console.info('Playlist, video and timestamp detected. Will use protocol: ');return`rykentube:PlayVideo?ID=${hasVideo(url)}&PlaylistID=${hasPlaylist(url)}&Position=${hasTimestamp(url)}`;}else{console.info('Playlist and video detected. Will use protocol: ');return`rykentube:PlayVideo?ID=${hasVideo(url)}&PlaylistID=${hasPlaylist(url)}`;}}else{console.info('Playlist detected. Will use protocol: ');return`rykentube:Playlist?ID=${hasPlaylist(url)}`;}}else if(hasVideo(url)!==null){if(hasTimestamp(url)!==null){console.info('Video and timestamp detected. Will use protocol:');return`rykentube:PlayVideo?ID=${hasVideo(url)}&Position=${hasTimestamp(url)}`;}else{console.info('Video detected. Will use protocol: \n ');return`rykentube:PlayVideo?ID=${hasVideo(url)}`;}}else if(await hasChannel(url)!==null){console.info('Channel detected. Will use protocol: ');return`rykentube:Channel?ID=${hasChannel(url)}`;}else{console.info('This youtube page is not supported by the myTube Companion');return undefined;}}
function openInApp(url,tabId,bypass){getStoredStatus('enabled',async enabled=>{if((isYoutube(url)!==null)&&(bypass==undefined||bypass==true)&&enabled){console.log(url);let rykentubeProtocol=await checkUrl(url);if(rykentubeProtocol!==undefined){console.log(rykentubeProtocol);pauseVideo(tabId);setTimeout(()=>{prevUrl=url;chrome.tabs.executeScript(tabId,{code:`window.location.assign('${rykentubeProtocol}');`},function(){if(closeOnSwitch==true&&isYoutube(url))chrome.tabs.remove(tabId);});},500);}}});}
function pauseVideo(tabId){getStoredStatus('closeOnSwitch',closeOnSwitch=>{if(closeOnSwitch==false){chrome.tabs.executeScript(tabId,{code:`function recursiveVideoCheck(){document.querySelectorAll('video').forEach(vid=>{if(vid.currentTime>0&&!vid.paused){vid.pause();}else{setTimeout(()=>{recursiveVideoCheck();},200);}});}
window.addEventListener("load",function(event){recursiveVideoCheck();});recursiveVideoCheck();`});}});}

function checkCurrentTab() {
    chrome.tabs.query({ currentWindow: true, active: true }, function(tab) {
        tab = tab[0];
        if (isYoutube(tab.url)) {
            openInApp(tab.url, tab.id, true);
        } else {
            console.log('Not a YouTube link!\n', tab.url);
        }
    });
}

getStoredStatus('enabled', result => {
    document.getElementById('enabled').innerText = (result ? 'enabled ' : 'disabled');
    if (result) {
        enabled = result;
        document.getElementById('onoff').checked = true;
    }
});

getStoredStatus('closeOnSwitch', result => {
    if (result) {
        closeOnSwitch = result;
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
