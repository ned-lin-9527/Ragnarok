#!/usr/bin/env node
// 從 RO-idle 資訊站的前端 bundle 擷取各職業技能樹，產生 data/ 快照。
//
// 用法：
//   curl -sL -o /tmp/ro-idle/bundle.js https://ro-idle.app/assets/<index-xxxx>.js
//   node tools/擷取技能樹資料.cjs /tmp/ro-idle/bundle.js 2026-10-24
//
// bundle 檔名會隨網站更新而變動，請先開啟 https://ro-idle.app/info 確認目前載入的 index-*.js。
// 只擷取純資料的物件字面值，並在無任何全域物件的 vm 環境中求值。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const [bundlePath, date] = process.argv.slice(2);
if (!bundlePath || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
  console.error('用法：node tools/擷取技能樹資料.cjs <bundle.js> <查詢日期 YYYY-MM-DD>');
  process.exit(1);
}
const src = fs.readFileSync(bundlePath, 'utf8');
// 職業清單直接取自 bundle，轉生職業（novice_high、*_high、騎士領主等）開放後會一併收錄。
const JOBS = [...new Set([...src.matchAll(/\{id:`([a-z_]+)`,key:`[A-Za-z_]+`,name:`/g)].map(m => m[1]))];

// 從 start 處的 `{` 找到對應的 `}`，略過字串與樣板字串中的括號。
function objectAt(start) {
  let depth = 0, quote = null;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '`' || c === '"' || c === "'") quote = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      if (--depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error(`找不到結尾：${start}`);
}
function evalLiteral(literal) {
  if (/\$\{/.test(literal)) throw new Error('物件含樣板運算式，非純資料');
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
}
function find(marker) {
  const at = src.indexOf(marker);
  if (at < 0) throw new Error(`bundle 中找不到 ${marker}`);
  return evalLiteral(objectAt(at));
}

const jobs = JOBS.map(id => {
  const job = find(`{id:\`${id}\`,key:\``);
  return {
    id: job.id, name: job.name, maxJobLv: job.maxJobLv,
    jobChange: job.jobChange || null,
    skillTree: job.skillTree.map(s => ({ id: s.id, maxLv: s.maxLv,
      ...(s.requires ? { requires: s.requires } : {}),
      ...(s.questJobLv ? { questJobLv: s.questJobLv } : {}) })),
  };
});

// 技能資料庫含未列於技能樹的任務／通用技能；一併保存以供職業技能說明使用。
const catalogIds = [...src.matchAll(/\{id:`([A-Z][A-Z0-9_]+)`,name:`/g)].map(m => m[1])
  .filter(id => id !== 'PERFORMING'); // 內部演奏狀態，不在公開技能資料庫 269 筆清單。
const skills = {};
for (const id of new Set(catalogIds)) {
  const s = find(`{id:\`${id}\`,name:\``);
  skills[id] = { name: s.name, maxLv: s.maxLv, kind: s.kind, status: s.status || { kind: 'ready' },
    sp: s.sp || [], descs: s.descs || [] };
}

// 轉生條件（Base／Job 等級、費用、屬性點）；找不到時記為 null，網站顯示「待查證」。
const rebirthAt = src.search(/\{minBaseLv:\d+,minJobLv:\d+,zeny:/);
const rebirth = rebirthAt < 0 ? null : evalLiteral(objectAt(rebirthAt));

const out = path.resolve(__dirname, '..', 'data', `ro-idle技能樹資料_${date}.json`);
fs.writeFileSync(out, JSON.stringify({
  source: 'https://ro-idle.app/info/database?type=skills',
  queried: date,
  note: '由資訊站前端資料擷取；含技能資料庫中未列於技能樹的技能。技能點規則（Job Lv−1 點、轉職需用完點數）見各職業 jobChange 與資訊站機制頁。',
  rebirth, jobs, skills,
}, null, 1) + '\n');
console.log(`已寫入 ${path.relative(process.cwd(), out)}：${jobs.length} 個職業、${Object.keys(skills).length} 個技能`);
