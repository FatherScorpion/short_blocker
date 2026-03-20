document.addEventListener('DOMContentLoaded', async () => {
  const timeLimitSelect = document.getElementById('timeLimit');
  const customGroup = document.getElementById('customGroup');
  const customMinutes = document.getElementById('customMinutes');
  const customSeconds = document.getElementById('customSeconds');
  const usedTimeDisplay = document.getElementById('usedTimeDisplay');
  const limitDisplay = document.getElementById('limitDisplay');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

  const PRESET_SECONDS = [300, 600, 900, 1800, 3600, 5400, 7200];

  function toStorageFormat(val) {
    if ([5, 10, 15, 30, 60, 90, 120].includes(val)) {
      return val * 60;
    }
    return val;
  }

  timeLimitSelect.addEventListener('change', () => {
    customGroup.style.display = timeLimitSelect.value === 'custom' ? 'block' : 'none';
  });

  const { timeLimit: rawLimit = 30, timeLimitFormat } = await chrome.storage.local.get(['timeLimit', 'timeLimitFormat']);
  const { usedTime = 0 } = await chrome.storage.local.get(['usedTime', 'lastResetDate']);
  const limitSeconds = timeLimitFormat === 'seconds' ? rawLimit : toStorageFormat(rawLimit);

  const presetVal = PRESET_SECONDS.find((s) => s === limitSeconds);
  if (presetVal !== undefined) {
    timeLimitSelect.value = String(presetVal);
    customGroup.style.display = 'none';
  } else {
    timeLimitSelect.value = 'custom';
    customGroup.style.display = 'block';
    customMinutes.value = Math.floor(limitSeconds / 60);
    customSeconds.value = limitSeconds % 60;
  }

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };
  limitDisplay.textContent = formatTime(limitSeconds);
  usedTimeDisplay.textContent = formatTime(usedTime);

  saveBtn.addEventListener('click', async () => {
    let limitSecondsToSave;
    if (timeLimitSelect.value === 'custom') {
      const min = parseInt(customMinutes.value, 10) || 0;
      const sec = parseInt(customSeconds.value, 10) || 0;
      limitSecondsToSave = min * 60 + sec;
      if (limitSecondsToSave < 1) {
        saveStatus.textContent = '1秒以上を指定してください';
        saveStatus.style.color = '#dc3545';
        return;
      }
      if (limitSecondsToSave > 28800) {
        saveStatus.textContent = '480分（28800秒）以内で指定してください';
        saveStatus.style.color = '#dc3545';
        return;
      }
    } else {
      limitSecondsToSave = parseInt(timeLimitSelect.value, 10);
    }

    const { usedTime = 0 } = await chrome.storage.local.get('usedTime');
    const updates = { timeLimit: limitSecondsToSave, timeLimitFormat: 'seconds' };
    if (limitSecondsToSave > usedTime) {
      updates.isBlocked = false;
    }
    await chrome.storage.local.set(updates);
    limitDisplay.textContent = formatTime(limitSecondsToSave);
    saveStatus.textContent = '保存しました';
    saveStatus.style.color = '#28a745';

    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  });
});
