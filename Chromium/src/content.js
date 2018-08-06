if (chrome && chrome.webNavigation !== undefined && chrome.webNavigation.onBeforeNavigate !== undefined) {

    chrome.webNavigation.onBeforeNavigate.addListener((result) => {
        // Make sure we aren't on youtube first
        if (!result.url.includes('youtube')) {            
            // Get all iframes
            for (let i in document.getElementsByTagName('iframe')) {
                // filter only iframes that point to youtube
                if (document.getElementsByTagName('iframe')[i].src.includes('youtube')) {
                    // grab the contents of the iframe
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
        }
    });

}