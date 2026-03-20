(function () {
  'use strict';

  const runtime = typeof chrome !== 'undefined' && chrome?.runtime;
  if (!runtime) return;

  function safeSendMessage(msg) {
    try {
      if (typeof chrome === 'undefined' || !chrome?.runtime?.sendMessage) {
        return Promise.resolve(null);
      }
      return chrome.runtime.sendMessage(msg);
    } catch (e) {
      return Promise.resolve(null);
    }
  }

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
  let lastReportedUsedSeconds = 0;
  let timeLimitMinutes = 30;
  let pollIntervalId = null;
  let displayIntervalId = null;
  let isBypassed = false;

  function isShortsPage() {
    return /\/shorts\//.test(window.location.pathname);
  }

  function getVideoElement() {
    const videos = Array.from(document.querySelectorAll('video'));
    if (videos.length === 0) return null;
    const playing = videos.find((v) => !v.paused);
    if (playing) return playing;
    const main = document.querySelector('video.html5-main-video') || document.querySelector('#movie_player video');
    if (main) return main;
    return videos.find((v) => v.videoWidth > 100) || videos[0];
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
          safeSendMessage({ action: 'setBypass' }).then(() => {
            isBypassed = true;
            lastReportedUsedSeconds = 0;
            const video = getVideoElement();
            if (video) lastReportedTime = video.currentTime;
            hideOverlay();
            resumeVideo();
            startTimeTracking();
          }).catch(() => {});
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
    if (!runtime) return;

    let response;
    try {
      response = await safeSendMessage({ action: 'getState' });
    } catch (e) {
      return;
    }
    const { timeLimit = 30, usedTime = 0, isBlocked = false } = response || {};

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

  function formatTime(seconds, decimals = 1) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (decimals > 0) {
      return `${m}:${s < 10 ? '0' : ''}${s.toFixed(decimals)}`;
    }
    return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
  }

  function updateTimeDisplay(usedSeconds, limitSeconds) {
    if (!timeDisplayEl) return;
    timeDisplayEl.textContent = `${formatTime(usedSeconds, 0)} / ${formatTime(limitSeconds, 0)}`;
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
    if (pollIntervalId) return;

    const video = getVideoElement();
    if (!video) return;

    lastReportedTime = video.currentTime;
    showTimeDisplay();

    safeSendMessage({ action: 'getState' }).then((r) => {
      lastReportedUsedSeconds = r?.usedTime ?? 0;
      timeLimitMinutes = r?.timeLimit ?? 30;
      updateTimeDisplay(lastReportedUsedSeconds, timeLimitMinutes * 60);
    }).catch(() => {});

    displayIntervalId = setInterval(() => {
      const v = getVideoElement();
      if (!v || !timeDisplayEl) return;
      const limitSeconds = timeLimitMinutes * 60;
      const ct = v.currentTime;
      const delta = ct >= lastReportedTime ? ct - lastReportedTime : 0;
      const liveUsed = lastReportedUsedSeconds + delta;
      updateTimeDisplay(liveUsed, limitSeconds);
    }, 100);

    pollIntervalId = setInterval(async () => {
      const v = getVideoElement();
      if (!v || v.paused) return;

      const currentTime = v.currentTime;
      const limitSeconds = timeLimitMinutes * 60;

      if (currentTime < lastReportedTime) {
        lastReportedTime = currentTime;
        return;
      }
      const delta = currentTime - lastReportedTime;
      const toReport = Math.floor(delta);
      if (toReport < 1) return;

      lastReportedTime = currentTime;
      try {
        const response = await safeSendMessage({
          action: 'addUsedTime',
          seconds: toReport,
        });
        lastReportedUsedSeconds = response?.usedTime ?? lastReportedUsedSeconds;
        timeLimitMinutes = response?.timeLimit ?? timeLimitMinutes;
        const limSec = timeLimitMinutes * 60;

        if (lastReportedUsedSeconds >= limSec) {
          stopTimeTracking();
          await safeSendMessage({ action: 'setBlocked', blocked: true });
          showOverlay(1);
        }
      } catch (_) {}
    }, 1000);
  }

  function stopTimeTracking() {
    if (displayIntervalId) {
      clearInterval(displayIntervalId);
      displayIntervalId = null;
    }
    if (pollIntervalId) {
      clearInterval(pollIntervalId);
      pollIntervalId = null;
    }
    lastReportedTime = 0;
    hideTimeDisplay();
  }

  function init() {
    if (!isShortsPage()) return;

    const video = getVideoElement();
    if (video) {
      lastReportedTime = video.currentTime;
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

  let initDebounceId = null;
  const observer = new MutationObserver(() => {
    if (!isShortsPage() || overlayEl) return;
    if (initDebounceId) clearTimeout(initDebounceId);
    initDebounceId = setTimeout(() => {
      initDebounceId = null;
      if (getVideoElement()) init();
    }, 300);
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
      if (pollIntervalId) {
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
