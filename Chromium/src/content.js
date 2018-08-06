setTimeout(() => {

    chrome.webNavigation.onBeforeNavigate.addListener((result) => {
        for (let i in document.getElementsByTagName('iframe')) {
            if (document.getElementsByTagName('iframe')[i].src.includes('youtube')) {
                let video = document.getElementsByTagName('iframe')[i].contentWindow;
                // This code isn't reachable?
                for (let o in video.getElementsByClassName('ytp-youtube-button')) {
                    setInterval(() => {
                        video.getElementsByClassName('ytp-youtube-button')[o].href = '#';

                        video.getElementsByClassName('ytp-youtube-button')[o].title = 'Watch in myTube!'
                    }, 1000);

                }

                /*                 video.getElementsByClassName('ytp-youtube-button')[o].addEventListener('click', function() {
                                    chrome.runtime.sendMessage({ checkUrl: document.getElementsByTagName('iframe')[i].src, tabId: result.tabId });
                                }); */
            }
        }
    });

}, 500);