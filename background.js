const JST_OFFSET = 9 * 60; // 日本時間 UTC+9

function getTodayJST() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const jst = new Date(utc + JST_OFFSET * 60000);
  return jst.toISOString().slice(0, 10);
}

async function checkAndResetDaily() {
  const { lastResetDate, usedTime, isBlocked } = await chrome.storage.local.get([
    'lastResetDate',
    'usedTime',
    'isBlocked',
  ]);
  const today = getTodayJST();

  if (lastResetDate !== today) {
    await chrome.storage.local.set({
      lastResetDate: today,
      usedTime: 0,
      isBlocked: false,
    });
  }
}

chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    await chrome.storage.local.set({
      timeLimit: 1800,
      timeLimitFormat: 'seconds',
      usedTime: 0,
      lastResetDate: getTodayJST(),
      isBlocked: false,
    });
  } else if (details.reason === 'update') {
    const data = await chrome.storage.local.get(['timeLimit', 'timeLimitFormat']);
    const updates = {};
    if (data.timeLimitFormat === undefined) {
      updates.timeLimitFormat = 'seconds';
      if (data.timeLimit !== undefined && [5, 10, 15, 30, 60, 90, 120].includes(data.timeLimit)) {
        updates.timeLimit = data.timeLimit * 60;
      }
    }
    if (Object.keys(updates).length > 0) {
      await chrome.storage.local.set(updates);
    }
  }
});

chrome.runtime.onStartup.addListener(checkAndResetDaily);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    await checkAndResetDaily();

    switch (message.action) {
      case 'getState': {
        const state = await chrome.storage.local.get([
          'timeLimit',
          'timeLimitFormat',
          'usedTime',
          'isBlocked',
          'lastResetDate',
        ]);
        sendResponse(state);
        break;
      }
      case 'addUsedTime': {
        const { usedTime = 0, timeLimit = 1800, timeLimitFormat } = await chrome.storage.local.get(['usedTime', 'timeLimit', 'timeLimitFormat']);
        const newUsed = usedTime + (message.seconds || 0);
        await chrome.storage.local.set({ usedTime: newUsed });
        sendResponse({ usedTime: newUsed, timeLimit, timeLimitFormat });
        break;
      }
      case 'setBlocked': {
        await chrome.storage.local.set({ isBlocked: message.blocked });
        sendResponse({ ok: true });
        break;
      }
      case 'setBypass': {
        await chrome.storage.local.set({ isBlocked: false, usedTime: 0 });
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true;
});
