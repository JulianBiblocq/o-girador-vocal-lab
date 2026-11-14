import fs from 'node:fs';
import path from 'node:path';

let overLimitCount = 0;
function countRealLines(text) {
  if (!text) return 0;
  return text.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n').length;
}

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(p)) {
      const lines = countRealLines(fs.readFileSync(p, 'utf8'));
      if (lines >= 145) {
        console.error(`⚠️ >= 145 lines: ${lines} lines in ${p}`);
        overLimitCount++;
      }
    }
  }
}

walk('./src');
if (overLimitCount === 0) {
  console.log('✅ ALL files in src/ are strictly < 145 lines (<= 144 real lines)! Zero violations.');
} else {
  console.error(`❌ Found ${overLimitCount} files with >= 145 lines.`);
  process.exit(1);
}
