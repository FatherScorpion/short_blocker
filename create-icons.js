/**
 * アイコンファイルを生成するスクリプト
 * 実行: npm run create-icons または node create-icons.js
 * （初回は npm install を実行してください）
 */
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

async function createWithJimp() {
  const Jimp = require('jimp');
  const sizes = [16, 48, 128];
  const red = 0xff0000ff;
  const white = 0xffffffff;

  for (const size of sizes) {
    const img = new Jimp(size, size, 0);
    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 2;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r * r) {
          img.setPixelColor(red, x, y);
        }
      }
    }

    const handLen = r * 0.5;
    for (let i = 0; i <= handLen; i++) {
      const py = Math.round(cy - (i / handLen) * handLen);
      img.setPixelColor(white, Math.round(cx), py);
    }
    for (let i = 0; i <= handLen * 0.7; i++) {
      const px = Math.round(cx + (i / (handLen * 0.7)) * handLen * 0.5);
      img.setPixelColor(white, px, Math.round(cy));
    }

    await img.writeAsync(path.join(iconsDir, `icon${size}.png`));
    console.log(`Created icon${size}.png`);
  }
}

function createWithBase64() {
  const iconBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBw1gGE0DBgZGBj+UxAGjP8ZGP5TEAaM/xkY/lMQBgDTPAAGVgQHdQAAAABJRU5ErkJggg==';
  [16, 48, 128].forEach((size) => {
    const buf = Buffer.from(iconBase64, 'base64');
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
    console.log(`Created icon${size}.png (16x16 scaled)`);
  });
}

(async () => {
  try {
    await createWithJimp();
  } catch (e) {
    console.log('jimp が利用できないため、簡易アイコンを生成します。npm install で高品質アイコンを生成できます。');
    createWithBase64();
  }
  console.log('Done. Icons created in icons/');
})();
