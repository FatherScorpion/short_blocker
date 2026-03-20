/**
 * アイコンファイルを生成するスクリプト
 * 実行: node create-icons.js
 */
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 16x16 のシンプルな赤い円のPNG (base64)
const icon16Base64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAOklEQVQ4T2NkYGD4z0ABYBw1gGE0DBgZGBj+UxAGjP8ZGP5TEAaM/xkY/lMQBgDTPAAGVgQHdQAAAABJRU5ErkJggg==';
const icon48Base64 = icon16Base64;
const icon128Base64 = icon16Base64;

[16, 48, 128].forEach((size, i) => {
  const base64 = size === 16 ? icon16Base64 : size === 48 ? icon48Base64 : icon128Base64;
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), buf);
  console.log(`Created icon${size}.png`);
});

console.log('Done. Icons created in icons/');
