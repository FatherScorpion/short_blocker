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
  let lastReportedTime = 0;
  let checkIntervalId = null;
  let isBypassed = false;

  function isShortsPage() {
    return /\/shorts\//.test(window.location.pathname);
  }

  function getVideoElement() {
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

  function startTimeTracking() {
    if (checkIntervalId) return;

    checkIntervalId = setInterval(async () => {
      const video = getVideoElement();
      if (!video || video.paused) return;

      const currentTime = video.currentTime;
      const delta = Math.floor(currentTime - lastReportedTime);
      if (delta <= 0) {
        lastReportedTime = currentTime;
        return;
      }

      lastReportedTime = currentTime;
      const response = await chrome.runtime.sendMessage({
        action: 'addUsedTime',
        seconds: delta,
      });

      const usedSeconds = response?.usedTime ?? 0;
      const timeLimit = response?.timeLimit ?? 30;
      const limitSeconds = timeLimit * 60;

      if (usedSeconds >= limitSeconds) {
        clearInterval(checkIntervalId);
        checkIntervalId = null;
        await chrome.runtime.sendMessage({ action: 'setBlocked', blocked: true });
        showOverlay(1);
      }
    }, 1000);
  }

  function stopTimeTracking() {
    if (checkIntervalId) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
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
  });

  const observer = new MutationObserver(() => {
    if (isShortsPage() && getVideoElement() && !overlayEl) {
      init();
    }
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
