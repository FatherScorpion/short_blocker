(function () {
  'use strict';

  const OVERLAY_MESSAGES = {
    0: {
      title: '本日の視聴時間は終了テレ',
      body: 'まだ見たいならテレを倒して見せよテレ',
      primary: 'テレサくんを倒す',
      showCancel: false,
    },
    1: {
      title: 'まじっすかテレ',
      body: 'え、本当に可愛いテレを倒すつもりテレか？',
      primary: 'はい',
      showCancel: true,
    },
    2: {
      title: '冗談ですやんwww',
      body: 'え、まさか本気にしたテレかwww',
      primary: 'テレサくんを殴る',
      showCancel: true,
    },
    3: {
      title: '（泣）',
      body: '暴力反対テレ！',
      primary: '視聴を続ける',
      showCancel: true,
    },
  };

  let overlayEl = null;
  let timeDisplayEl = null;
  let lastReportedTime = 0;
  let accumulatedSeconds = 0;
  let trackedVideo = null;
  let timeUpdateHandler = null;
  let isBypassed = false;

  function isShortsPage() {
    return /\/shorts\//.test(window.location.pathname);
  }

  function getVideoElement() {
    const sel = document.querySelector('video.html5-main-video') || document.querySelector('video');
    if (sel) return sel;
    const shorts = document.querySelector('ytd-shorts');
    if (shorts) {
      const walk = (root) => {
        const v = root.querySelector?.('video');
        if (v) return v;
        for (const el of root.querySelectorAll?.('*') || []) {
          if (el.shadowRoot) {
            const found = walk(el.shadowRoot);
            if (found) return found;
          }
        }
        return null;
      };
      return walk(shorts) || walk(document);
    }
    return document.querySelector('video');
  }

  function showOverlay(step) {
    if (overlayEl) {
      overlayEl.remove();
    }
    const msg = OVERLAY_MESSAGES[step];
    overlayEl = document.createElement('div');
    overlayEl.id = 'shorts-blocker-overlay';
    overlayEl.innerHTML = `
      <div class="shorts-blocker-modal">
        <h2 class="shorts-blocker-title">${msg.title}</h2>
        <p class="shorts-blocker-body">${msg.body}</p>
        <div class="shorts-blocker-buttons">
          ${msg.showCancel ? '<button class="shorts-blocker-btn shorts-blocker-cancel">やめる</button>' : ''}
          <button class="shorts-blocker-btn shorts-blocker-primary">${msg.primary}</button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      #shorts-blocker-overlay {
        position: fixed;
        inset: 0;
        z-index: 2147483647;
        background: rgba(0,0,0,0.85);
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .shorts-blocker-modal {
        background: #212121;
        color: #fff;
        padding: 32px;
        border-radius: 16px;
        max-width: 360px;
        text-align: center;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
      }
      .shorts-blocker-title {
        margin: 0 0 16px 0;
        font-size: 20px;
        font-weight: 600;
      }
      .shorts-blocker-body {
        margin: 0 0 24px 0;
        font-size: 14px;
        line-height: 1.6;
        color: #aaa;
      }
      .shorts-blocker-buttons {
        display: flex;
        gap: 12px;
        justify-content: center;
        flex-wrap: wrap;
      }
      .shorts-blocker-btn {
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 600;
        border: none;
        border-radius: 8px;
        cursor: pointer;
      }
      .shorts-blocker-primary {
        background: #ff0000;
        color: #fff;
      }
      .shorts-blocker-primary:hover {
        background: #cc0000;
      }
      .shorts-blocker-cancel {
        background: #333;
        color: #fff;
      }
      .shorts-blocker-cancel:hover {
        background: #444;
      }
    `;
    overlayEl.appendChild(style);

    const primaryBtn = overlayEl.querySelector('.shorts-blocker-primary');
    const cancelBtn = overlayEl.querySelector('.shorts-blocker-cancel');

    primaryBtn.addEventListener('click', () => {
      if (step === 0 || step === 1) {
        showOverlay(step + 1);
      } else if (step === 2 || step === 3) {
        if (step === 3) {
          chrome.runtime.sendMessage({ action: 'setBypass' }, () => {
            isBypassed = true;
            const video = getVideoElement();
            if (video) lastReportedTime = video.currentTime;
            hideOverlay();
            resumeVideo();
            startTimeTracking();
          });
        } else {
          showOverlay(step + 1);
        }
      }
    });

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        hideOverlay();
        showOverlay(0);
      });
    }

    document.body.appendChild(overlayEl);
    pauseVideo();
  }

  function hideOverlay() {
    if (overlayEl) {
      overlayEl.remove();
      overlayEl = null;
    }
  }

  function pauseVideo() {
    const video = getVideoElement();
    if (video) {
      video.pause();
    }
  }

  function resumeVideo() {
    const video = getVideoElement();
    if (video) {
      video.play();
    }
  }

  async function checkStateAndAct() {
    if (!isShortsPage()) return;

    const response = await chrome.runtime.sendMessage({ action: 'getState' });
    const { timeLimit = 30, usedTime = 0, isBlocked = false } = response;

    if (isBlocked && !isBypassed) {
      showOverlay(0);
      return;
    }

    if (isBypassed) {
      hideOverlay();
      return;
    }

    startTimeTracking();
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function updateTimeDisplay(usedSeconds, limitSeconds) {
    if (!timeDisplayEl) return;
    timeDisplayEl.textContent = `${formatTime(usedSeconds)} / ${formatTime(limitSeconds)}`;
  }

  function showTimeDisplay() {
    if (timeDisplayEl) return;
    timeDisplayEl = document.createElement('div');
    timeDisplayEl.id = 'shorts-blocker-time-display';
    const style = document.createElement('style');
    style.textContent = `
      #shorts-blocker-time-display {
        position: fixed;
        bottom: 80px;
        left: 16px;
        z-index: 9999;
        background: rgba(0,0,0,0.7);
        color: #fff;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
    document.body.appendChild(timeDisplayEl);
  }

  function hideTimeDisplay() {
    if (timeDisplayEl) {
      timeDisplayEl.remove();
      timeDisplayEl = null;
    }
  }

  function startTimeTracking() {
    if (timeUpdateHandler) return;

    const video = getVideoElement();
    if (!video) return;

    trackedVideo = video;
    lastReportedTime = video.currentTime;
    showTimeDisplay();

    const onTimeUpdate = async () => {
      if (!video || video.paused) return;

      const currentTime = video.currentTime;
      accumulatedSeconds += currentTime - lastReportedTime;
      lastReportedTime = currentTime;

      const toReport = Math.floor(accumulatedSeconds);
      if (toReport <= 0) return;

      accumulatedSeconds -= toReport;
      try {
        const response = await chrome.runtime.sendMessage({
          action: 'addUsedTime',
          seconds: toReport,
        });
        const usedSeconds = response?.usedTime ?? 0;
        const timeLimit = response?.timeLimit ?? 30;
        const limitSeconds = timeLimit * 60;
        updateTimeDisplay(usedSeconds, limitSeconds);

        if (usedSeconds >= limitSeconds) {
          stopTimeTracking();
          await chrome.runtime.sendMessage({ action: 'setBlocked', blocked: true });
          showOverlay(1);
        }
      } catch (_) {}
    };

    timeUpdateHandler = onTimeUpdate;
    video.addEventListener('timeupdate', onTimeUpdate);

    chrome.runtime.sendMessage({ action: 'getState' }, (r) => {
      if (r?.usedTime != null && r?.timeLimit != null) {
        updateTimeDisplay(r.usedTime, r.timeLimit * 60);
      }
    });
  }

  function stopTimeTracking() {
    if (trackedVideo && timeUpdateHandler) {
      trackedVideo.removeEventListener('timeupdate', timeUpdateHandler);
    }
    trackedVideo = null;
    timeUpdateHandler = null;
    accumulatedSeconds = 0;
    hideTimeDisplay();
  }

  function init() {
    if (!isShortsPage()) return;

    const video = getVideoElement();
    if (video) {
      lastReportedTime = video.currentTime;
      accumulatedSeconds = 0;
    }

    checkStateAndAct();
  }

  window.addEventListener('yt-navigate-finish', () => {
    stopTimeTracking();
    isBypassed = false;
    hideOverlay();
    init();
    scheduleInitRetry();
  });

  const observer = new MutationObserver(() => {
    if (isShortsPage() && getVideoElement() && !overlayEl) {
      init();
    }
  });

  let initRetryId = null;
  function scheduleInitRetry() {
    if (initRetryId) {
      clearInterval(initRetryId);
      initRetryId = null;
    }
    const id = setInterval(() => {
      if (!isShortsPage()) return;
      if (overlayEl) return;
      if (timeUpdateHandler) {
        clearInterval(id);
        initRetryId = null;
        return;
      }
      if (getVideoElement()) {
        init();
        clearInterval(id);
        initRetryId = null;
      }
    }, 500);
    initRetryId = id;
    setTimeout(() => {
      if (initRetryId === id) {
        clearInterval(id);
        initRetryId = null;
      }
    }, 15000);
  }

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      init();
      scheduleInitRetry();
    });
  } else {
    init();
    scheduleInitRetry();
  }
})();
