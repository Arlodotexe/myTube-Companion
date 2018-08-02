function youtube_parser(url) {
  var regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#\&\?]*).*/;
  var match = url.match(regExp);
  return (match && match[7].length == 11) ? match[7] : false;
}

function checkUrl(details) {
  if (youtube_parser(details) !== false) {
    window.open('rykentube:Video?ID=' + youtube_parser(details));
  }
}

checkUrl = once(checkUrl);

function once(fn, context) {
  var result;
  return function() {
    if (fn) {
      result = fn.apply(context || this, arguments);
      fn = null;
    }
    return result;
  };
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (document.getElementsByTagName('video')[0] && request.data.url.includes('youtube')) {
    document.getElementsByTagName('video')[0].pause();
  }
});

