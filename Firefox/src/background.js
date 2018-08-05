function youtube_parser(url) {
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
  var match = url.match(regExp);
  return (match && match[7].length == 11) ? match[7] : false;
}

let enabled;

function checkUrl(url, tabId, bypass) {
  getStoredStatus(enabled => {
    if (youtube_parser(url) !== false && (enabled || bypass)) {
      pauseVideoDB();
      browser.tabs.create({
        url: 'rykentube:Video?ID=' + youtube_parser(url),
      })
        .then(function(tab) {
          setTimeout(() => {
            browser.tabs.remove(tab.id);
          }, 500);
        });
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

function checkCurrentTab() {
  browser.tabs.query({ active: true })
    .then(function(tab) {
        checkUrl(tab[0].url, tab[0].id, true);
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

var filter = {
  url:
    [
      { hostContains: "youtube" }
    ]
}

function setStoredStatus(status) {
  if (chrome && chrome.storage && chrome.storage.local) {
    enabled = status;
    chrome.storage.local.set({ enabled: status });
  } else {
    console.error('Cannot access storage API. State cannot be saved');
  }
}

function getStoredStatus(cb) {
  browser.storage.local.get(["enabled"])
    .then(result => {
      if (result.enabled == undefined) setStoredStatus(true);
      cb(result.enabled);
    })
}


if (chrome && chrome.browserAction && chrome.browserAction.onClicked) {
  chrome.browserAction.onClicked.addListener(function(tab) {
    setStoredStatus(!enabled);
    enabled = !enabled;
    console.log((enabled ? 'Enabled' : 'Disabled') + ' myTube integration');
  })
} else {
  console.error('Cannot access chrome.browserAction.onClicked');
}

browser.webNavigation.onBeforeNavigate.addListener((result) => {
  if (result.status == 'loading' && result.url && youtube_parser(result.url)) {
    getStoredStatus(enabled => {
      if (enabled) {
        checkUrl(result.url, result.tabId);
      }
    });
  }
}, filter);

browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  console.log('updated');
  console.log(JSON.stringify(changeInfo));
  if (changeInfo !== undefined && changeInfo.status == "loading" && changeInfo.url !== undefined && youtube_parser(changeInfo.url) !== false && enabled) {
    checkUrlDB(changeInfo.url, tabId);
  }
});

chrome.runtime.onMessage.addListener(function(request) {
  if (request.changeState !== undefined) {
    setStoredStatus(request.changeState);
  }
  if (request.check == 'currentTab') {
    checkCurrentTab();
  }
});

getStoredStatus(result => {
  enabled = result;
})