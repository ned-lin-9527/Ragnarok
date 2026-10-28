#!/usr/bin/env node
// 用法：node tools/擷取賢者攻略資料.cjs <資訊站 index-*.js> <YYYY-MM-DD>
// 只讀取公開前端 bundle 的純資料字面值；不執行整份程式。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const [bundle, queried] = process.argv.slice(2);
if (!bundle || !/^\d{4}-\d{2}-\d{2}$/.test(queried || '')) throw new Error('須提供 bundle 與查詢日期');
const src = fs.readFileSync(bundle, 'utf8');
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


const objects = [...src.matchAll(/\{id:(?:[0-9]+|`[^`]+`),(?:key|name|group|town):/g)].flatMap(m => {
  try { return [evalLiteral(objectAt(m.index))]; } catch { return []; }
});
const jobs = ['novice', 'mage', 'sage'].map(id => find(`{id:\`${id}\`,key:\``));
const skillIds = new Set(jobs.flatMap(j => j.skillTree.map(s => s.id)));
const skills = Object.fromEntries([...skillIds].map(id => [id, find(`{id:\`${id}\`,name:\``)]));
const itemIds = new Set([1550,1551,1560,1607,1610,2101,2102,2321,2322,2503,2504,2403,2404,2285,2233,2602,2607,4003,4014,4052,4133,4100,4070,4064,4015,4027,4102,4159,4375,715,716,717,990,991,992,993]);
const items = objects.filter(x => x.category && itemIds.has(x.id));
if (items.length !== itemIds.size) throw new Error('裝備／物品資料缺漏');
const maps = objects.filter(x => x.spawns && ['gef_fild04','mjo_dun01','prt_fild03','yuno_fild08','yuno_fild10','lhz_dun03'].includes(x.id));
const monsterIds = new Set(maps.flatMap(m => [...m.spawns, ...(m.timed || [])].map(s => s.monsterId)));
const monsters = objects.filter(x => x.hp && (monsterIds.has(x.id) || [...(x.drops || []), ...(x.card ? [x.card] : [])].some(d => itemIds.has(d.itemId))));
const shops = objects.filter(x => x.town && x.items?.some(i => itemIds.has(i.itemId))).map(x => ({...x, items: x.items.filter(i => itemIds.has(i.itemId))}));
const mechanics = objects.filter(x => x.text && x.group && ['sage','points','job40','resetNpc','rebirth','cast','matk','hit','aspd','weight','death','offline','town-buy','storage'].includes(x.id));
const data = {queried, source:'https://ro-idle.app/info', bundleSha256:crypto.createHash('sha256').update(src).digest('hex'),
  note:'賢者攻略專用快照；不取代全職業技能模擬器資料。怪物 drops.rate 以萬分率儲存；商店 price 才是實際商店標價，物品 buy 是基準價。',
  jobs, skills, items, shops, maps, monsters, mechanics};
const out = path.resolve(__dirname, '..', 'data', `ro-idle賢者攻略資料_${queried}.json`);
fs.writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`已寫入 ${out}：${jobs.length} 職業、${skillIds.size} 技能、${items.length} 物品、${maps.length} 地圖`);
