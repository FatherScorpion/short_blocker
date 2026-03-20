document.addEventListener('DOMContentLoaded', async () => {
  const timeLimitSelect = document.getElementById('timeLimit');
  const customGroup = document.getElementById('customGroup');
  const customMinutes = document.getElementById('customMinutes');
  const usedTimeDisplay = document.getElementById('usedTimeDisplay');
  const limitDisplay = document.getElementById('limitDisplay');
  const saveBtn = document.getElementById('saveBtn');
  const saveStatus = document.getElementById('saveStatus');

  // カスタム選択時の表示切り替え
  timeLimitSelect.addEventListener('change', () => {
    customGroup.style.display = timeLimitSelect.value === 'custom' ? 'block' : 'none';
  });

  // 設定の読み込みと表示
  const { timeLimit = 30 } = await chrome.storage.local.get('timeLimit');
  const { usedTime = 0, lastResetDate } = await chrome.storage.local.get(['usedTime', 'lastResetDate']);

  if (timeLimit <= 120 && [5, 10, 15, 30, 60, 90, 120].includes(timeLimit)) {
    timeLimitSelect.value = String(timeLimit);
    customGroup.style.display = 'none';
  } else {
    timeLimitSelect.value = 'custom';
    customGroup.style.display = 'block';
    customMinutes.value = timeLimit;
  }

  limitDisplay.textContent = timeLimit;
  usedTimeDisplay.textContent = Math.floor(usedTime / 60);

  // 保存処理
  saveBtn.addEventListener('click', async () => {
    let limit;
    if (timeLimitSelect.value === 'custom') {
      limit = parseInt(customMinutes.value, 10);
      if (isNaN(limit) || limit < 1 || limit > 480) {
        saveStatus.textContent = '1〜480分の範囲で入力してください';
        saveStatus.style.color = '#dc3545';
        return;
      }
    } else {
      limit = parseInt(timeLimitSelect.value, 10);
    }

    await chrome.storage.local.set({ timeLimit: limit });
    limitDisplay.textContent = limit;
    saveStatus.textContent = '保存しました';
    saveStatus.style.color = '#28a745';

    setTimeout(() => {
      saveStatus.textContent = '';
    }, 2000);
  });
});
