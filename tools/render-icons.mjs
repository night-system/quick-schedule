// 生成 PWA 主屏图标(黑灰底 + 白色 lucide calendar-days)
// 用法:node tools/render-icons.mjs   依赖 sharp(经 SHARP_PATH 或默认路径加载)
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  sharp = require(process.env.SHARP_PATH || 'C:/Users/33392/AppData/Local/Temp/qs-icon-gen/node_modules/sharp');
}

// lucide-static v1.43.0 calendar-days.svg(ISC License)内部图形
const BODY = `
  <path d="M8 2v3" />
  <path d="M16 2v3" />
  <rect x="3" y="3" width="18" height="18" rx="2" />
  <path d="M3 9h18" />
  <path d="M8 13h.01" />
  <path d="M12 13h.01" />
  <path d="M16 13h.01" />
  <path d="M8 17h.01" />
  <path d="M12 17h.01" />
  <path d="M16 17h.01" />
`;

function make(size, padRatio = 0.19) {
  const pad = Math.round(size * padRatio);
  const scale = (size - pad * 2) / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#141416"/>
  <g transform="translate(${pad},${pad}) scale(${scale.toFixed(4)})" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${BODY}</g>
</svg>`;
}

const out = (name) => fileURLToPath(new URL('../app/' + name, import.meta.url));
await sharp(Buffer.from(make(512))).png().toFile(out('icon-512.png'));
await sharp(Buffer.from(make(180))).png().toFile(out('icon-180.png'));
console.log('OK: app/icon-512.png, app/icon-180.png');
