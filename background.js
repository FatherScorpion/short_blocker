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

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.storage.local.set({
    timeLimit: 30,
    usedTime: 0,
    lastResetDate: getTodayJST(),
    isBlocked: false,
  });
});

chrome.runtime.onStartup.addListener(checkAndResetDaily);

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    await checkAndResetDaily();

    switch (message.action) {
      case 'getState': {
        const state = await chrome.storage.local.get([
          'timeLimit',
          'usedTime',
          'isBlocked',
          'lastResetDate',
        ]);
        sendResponse(state);
        break;
      }
      case 'addUsedTime': {
        const { usedTime = 0, timeLimit = 30 } = await chrome.storage.local.get(['usedTime', 'timeLimit']);
        const newUsed = usedTime + (message.seconds || 0);
        await chrome.storage.local.set({ usedTime: newUsed });
        sendResponse({ usedTime: newUsed, timeLimit });
        break;
      }
      case 'setBlocked': {
        await chrome.storage.local.set({ isBlocked: message.blocked });
        sendResponse({ ok: true });
        break;
      }
      case 'setBypass': {
        await chrome.storage.local.set({ isBlocked: false });
        sendResponse({ ok: true });
        break;
      }
      default:
        sendResponse({ error: 'Unknown action' });
    }
  })();
  return true;
});
