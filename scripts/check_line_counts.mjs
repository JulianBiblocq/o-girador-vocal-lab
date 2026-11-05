import fs from 'node:fs';
import path from 'node:path';

let overLimitCount = 0;
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      walk(p);
    } else if (p.endsWith('.ts') || p.endsWith('.tsx') || p.endsWith('.js') || p.endsWith('.jsx')) {
      const lines = fs.readFileSync(p, 'utf8').split('\n').length;
      if (lines > 150) {
        console.error(`⚠️ > 150 lines: ${lines} lines in ${p}`);
        overLimitCount++;
      }
    }
  }
}

walk('./src');
if (overLimitCount === 0) {
  console.log('✅ ALL files in src/ are strictly <= 150 lines! Zero violations.');
} else {
  console.error(`❌ Found ${overLimitCount} files over 150 lines.`);
  process.exit(1);
}
