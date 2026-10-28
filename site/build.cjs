#!/usr/bin/env node
// Build the reading site from the Markdown files in this repository.
// No network access or package installation is required.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Marked } = require('./vendor/marked.umd.js');

const root = path.resolve(__dirname, '..');
const output = path.join(__dirname, 'dist');
const guidesOutput = path.join(output, 'guides');
const repo = 'https://github.com/ned-lin-9527/Ragnarok';
const classOrder = ['初心者', '劍士', '商人', '弓箭手', '服事', '盜賊', '法師', '超級初心者'];
const summaries = {
  '初心者一轉前': '吉芬原野 04 鎖定蟲蛹，完成初學者 Job 10 與基本技能 Lv 9。',
  '雙手劍力敏騎士': '雙手劍普攻與攻速，走 STR／AGI 路線。',
  '十字軍': '雙手矛力敏普攻、聖十字審判與犧牲護隊三路線，含配點、配裝與掛機取捨。',
  '力敏鐵匠': '雙手斧普攻、速度激發與凶砍常駐。',
  '製藥鍊金術師': '生命體護衛升級，優先兼顧主人生存與製藥成功率。',
  '鳥獵': '普攻鳥獵與二連矢混合型，含四階段配點與補給取捨。',
  '詩人與舞孃': '經驗值倍增也讓兩位演奏者受益，並可支援同圖隊友。',
  '六合拳敏系武道家': '拳套普攻觸發六合拳，兼顧高防禦目標。',
  '全輔助祭司': '以增益與支援技能協助隊伍掛機。',
  '爆刺刺客': '拳刃爆擊與雙短劍路線，含四階段配點及現有角色銜接。',
  '二刀連擊雙刀刺客': '雙短劍與二刀連擊，重視命中和配卡取捨。',
  '匕首普攻流氓': '匕首普攻與抄襲技能的培養路線。',
  'ID巫師': '以 INT／DEX 為核心的法術輸出路線。',
  '賢者': '自動念咒敏智、INT／DEX 主動施法與領域／附魔輔助三路線，含配點、配裝及掛機取捨。',
  '各類型裝備保留與賣出清單': '依裝備類型快速判斷保留、條件留與可賣多餘。',
  '裝備逐件保留判定': '逐件查詢裝備 ID、用途與掛機保留優先序。',
  '458 件裝備逐件保留判定': '逐件查詢 458 件裝備的 ID、用途與掛機保留優先序。',
};

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function listMarkdown(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(item => {
    const full = path.join(dir, item.name);
    return item.isDirectory() ? listMarkdown(full) : item.isFile() && item.name.endsWith('.md') ? [full] : [];
  });
}
function sourceUrl(file) {
  const rel = path.relative(root, file).split(path.sep).map(encodeURIComponent).join('/');
  return `${repo}/blob/main/${rel}`;
}
function plainMarkdown(source) {
  return source
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[|*#>`~]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
function titleFrom(source, file) {
  const heading = source.match(/^#\s+(.+)$/m)?.[1] || path.basename(file, '.md');
  return heading.replace(/^RO 放置仙境[：:]\s*/, '').replace(/培養攻略$/, '').trim();
}
function dateFrom(source) {
  return source.match(/\*\*最後查證[：:]\s*(\d{4}-\d{2}-\d{2})/)?.[1] || '待查證';
}

const candidates = [...listMarkdown(path.join(root, 'Role')), ...listMarkdown(path.join(root, '技能')), ...listMarkdown(path.join(root, '裝備'))];
const seen = new Map();
const docs = [];
for (const file of candidates.sort((a, b) => a.localeCompare(b, 'zh-Hant'))) {
  const source = fs.readFileSync(file, 'utf8');
  // 詩人與舞孃在兩個職業目錄有相同的原檔；網站只保留一篇。
  const digest = crypto.createHash('sha256').update(source).digest('hex');
  if (seen.has(digest)) continue;
  seen.set(digest, file);
  const rel = path.relative(root, file);
  const parts = rel.split(path.sep);
  const title = titleFrom(source, file);
  const kind = parts[0] === 'Role' ? 'role' : parts[0] === '技能' ? 'skill' : 'equipment';
  const label = kind === 'role' ? (parts.length > 3 ? `${parts[1]} · ${title === '詩人與舞孃' ? '詩人／舞孃' : parts[2]}` : parts[1]) : kind === 'skill' ? (title === '資料庫其他技能' ? '其他技能' : '職業技能說明') : '裝備分析';
  const slug = path.basename(file, '.md');
  docs.push({ file, source, rel, title, kind, label, first: parts[1], second: parts[2],
    date: dateFrom(source), summary: summaries[title] || (kind === 'skill' ? (title === '資料庫其他技能' ? '資料庫中未列入玩家職業技能樹或生命體技能的條目。' : `${title.replace(/技能說明$/, '')}的技能、最高等級、前置與放置版掛機限制。`) : plainMarkdown(source).slice(0, 90)),
    url: `guides/${encodeURIComponent(slug)}.html` });
}
docs.sort((a, b) => {
  if (a.kind !== b.kind) return ['role', 'skill', 'equipment'].indexOf(a.kind) - ['role', 'skill', 'equipment'].indexOf(b.kind);
  if (a.kind === 'role') {
    const ai = classOrder.indexOf(a.first), bi = classOrder.indexOf(b.first);
    if (ai !== bi) return ai - bi;
  }
  return a.title.localeCompare(b.title, 'zh-Hant');
});
const sourceToDoc = new Map(docs.map(doc => [path.resolve(doc.file), doc]));
// Both copies of the shared guide resolve to the canonical page.
for (const file of candidates) {
  if (!sourceToDoc.has(path.resolve(file))) {
    const source = fs.readFileSync(file, 'utf8');
    const digest = crypto.createHash('sha256').update(source).digest('hex');
    const canonical = sourceToDoc.get(path.resolve(seen.get(digest)));
    if (canonical) sourceToDoc.set(path.resolve(file), canonical);
  }
}

// GitHub Pages 會快取靜態檔約 10 分鐘；資源網址附內容雜湊，更新後立即生效。
const assetVersion = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex').slice(0, 10);
const asset = { style: assetVersion('style.css'), app: assetVersion('app.js'), skills: assetVersion('skills.js') };

function layout({ title, description, body, page = 'home' }) {
  const prefix = page === 'article' ? '../' : '';
  return `<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#121d35"><meta name="description" content="${esc(description)}">
<title>${esc(title)}｜RO 放置仙境攻略</title><link rel="icon" href="${prefix}favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="${prefix}style.css?v=${asset.style}"><script src="${prefix}app.js?v=${asset.app}" defer></script></head>
<body data-page="${page}"><a class="skip-link" href="#main">跳至主要內容</a>
<header class="site-header"><div class="header-inner"><a class="brand" href="${prefix}index.html" aria-label="RO 放置仙境攻略首頁"><span class="brand-mark" aria-hidden="true">R<span>/</span></span><span class="brand-name">RO 放置仙境<span>玩家攻略索引</span></span></a>
<nav class="top-nav" aria-label="主選單"><a href="${prefix}index.html#roles">職業攻略</a><a href="${prefix}index.html#skill-guides">職業技能</a><a href="${prefix}skills.html"${page === 'tool' ? ' aria-current="page"' : ''}>技能模擬器</a><a href="${prefix}index.html#equipment">裝備分析</a><a href="${prefix}index.html#how-to-read">閱讀須知</a><a class="github-link" href="${repo}" target="_blank" rel="noopener noreferrer">GitHub ↗</a></nav></div></header>
${body}<footer class="site-footer"><div><strong>RO 放置仙境攻略手冊</strong><p>非官方玩家整理。攻略會隨遊戲資料與實測更新，使用前請核對最後查證日期。</p></div><div class="footer-links"><a href="https://ro-idle.app/info" target="_blank" rel="noopener noreferrer">遊戲資訊站 ↗</a><a href="${repo}" target="_blank" rel="noopener noreferrer">原始資料與回報 ↗</a></div></footer>
</body></html>`;
}

function renderMarkdown(doc) {
  const toc = [];
  let headingNumber = 0;
  const renderer = new Marked({ gfm: true, breaks: false });
  renderer.use({ renderer: {
    heading(token) {
      const text = this.parser.parseInline(token.tokens);
      const label = token.text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '');
      const id = `section-${++headingNumber}`;
      if (token.depth <= 3) toc.push({ id, label, depth: token.depth });
      return `<h${token.depth} id="${id}">${text}<a class="heading-anchor" href="#${id}" aria-label="連結至${esc(label)}">#</a></h${token.depth}>`;
    },
    link(token) {
      let href = token.href || '';
      if (/^https?:\/\//i.test(href)) {
        return `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${this.parser.parseInline(token.tokens)}</a>`;
      }
      if (href.startsWith('#')) {
        return `<a href="${esc(href)}">${this.parser.parseInline(token.tokens)}</a>`;
      }
      if (!/^[./\w\u3400-\u9fff%\-]+(?:\.md)?(?:#[\w\-]*)?$/u.test(href)) {
        return this.parser.parseInline(token.tokens);
      }
      const [relative, fragment] = href.split('#');
      const target = sourceToDoc.get(path.resolve(path.dirname(doc.file), decodeURI(relative)));
      href = target ? `${encodeURIComponent(path.basename(target.file, '.md'))}.html${fragment ? `#${esc(fragment)}` : ''}` : sourceUrl(path.resolve(path.dirname(doc.file), relative));
      return `<a href="${esc(href)}"${target ? '' : ' target="_blank" rel="noopener noreferrer"'}>${this.parser.parseInline(token.tokens)}</a>`;
    },
    html() { return ''; },
    image(token) {
      // The current guide set has no images. Reject external/unsafe image URLs.
      const url = token.href || '';
      return /^\.\.?\//.test(url) ? `<img src="${esc(url)}" alt="${esc(token.text || '')}" loading="lazy">` : esc(token.text || '');
    }
  } });
  const withoutTitle = doc.source.replace(/^#\s+[^\n]+\n?/, '')
    .replace(/^\*\*最後查證[：:]\s*\d{4}-\d{2}-\d{2}\*\*\s*\n/m, '')
    // CommonMark treats a closing ** followed immediately by CJK text as part of the word.
    // Insert a rendering-only space so the source's intended emphasis is shown.
    .replace(/(\*\*[^*\n]+\*\*)(?=[\u3400-\u9fff])/g, '$1 ');
  const html = renderer.parse(withoutTitle).replace(/<table>/g, '<div class="table-scroll" tabindex="0" aria-label="可水平捲動的表格"><table>').replace(/<\/table>/g, '</table></div>');
  return { html, toc };
}

function renderArticle(doc) {
  const { html, toc } = renderMarkdown(doc);
  const tocHtml = toc.filter(x => x.depth >= 2).map(x => `<a class="toc-level-${x.depth}" href="#${x.id}">${esc(x.label)}</a>`).join('');
  const related = [...docs.filter(x => x !== doc && x.kind === 'role' && x.first === doc.first),
    ...docs.filter(x => x !== doc && x.kind === 'equipment')].slice(0, 3);
  const body = `<main id="main" class="article-shell"><div class="article-top"><a href="../index.html" class="back-link">← 回到攻略目錄</a><span class="eyebrow">${esc(doc.label)}</span><h1>${esc(doc.title)}</h1><p class="article-summary">${esc(doc.summary)}</p><div class="article-meta"><span>最後查證：<time>${esc(doc.date)}</time></span><a href="${sourceUrl(doc.file)}" target="_blank" rel="noopener noreferrer">查看 Markdown 原檔 ↗</a></div></div>
  <div class="article-grid"><aside class="toc"><details class="toc-panel" open><summary>本篇目錄 <span aria-hidden="true">＋</span></summary><nav aria-label="文章章節">${tocHtml}</nav><div class="toc-note">數值與建議請以本文「最後查證」日期及引用來源為準。</div></details></aside>
  <article class="article-content" aria-label="攻略內容">${html}<div class="article-end"><span>閱讀完畢</span><a href="../index.html">探索其他攻略 →</a></div></article></div>
  <section class="related"><h2>延伸閱讀</h2><div class="related-grid">${related.map(x => card(x, '../')).join('')}</div></section></main>`;
  return layout({ title: doc.title, description: doc.summary, body, page: 'article' });
}

function card(doc, prefix = '') {
  const pinned = doc.first === '初心者' && doc.title === '初心者一轉前';
  return `<a class="guide-card${pinned ? ' guide-card-pinned' : ''}" href="${prefix}${doc.url}"><span class="card-type">${esc(pinned ? '置頂 · 初心者' : doc.label)}</span><h3>${esc(doc.title)}</h3><p>${esc(doc.summary)}</p><span class="card-bottom"><span>查證 ${esc(doc.date)}</span><span aria-hidden="true">↗</span></span></a>`;
}

// 技能模擬器使用 data/ 中最新的技能樹快照（tools/擷取技能樹資料.cjs 產生）。
const skillSnapshot = fs.readdirSync(path.join(root, 'data')).filter(f => /^ro-idle技能樹資料_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().pop();
const skillData = skillSnapshot ? JSON.parse(fs.readFileSync(path.join(root, 'data', skillSnapshot), 'utf8')) : null;
// 「放置版重點」（tools/產生職業技能說明.py 產生）沿用查詢日不晚於技能快照的最新一份。
// 若沿用較舊的重點，技能狀態或等級上限有變的技能，以及與其直接前置相連的技能，
// 暫不顯示舊重點並列為待複核，避免把「停用」等過時說明套到新資料上。
let skillNotesDate = null;
const staleNotes = [];
if (skillData) {
  const noteFile = fs.readdirSync(path.join(root, 'data'))
    .filter(f => /^ro-idle技能重點_\d{4}-\d{2}-\d{2}\.json$/.test(f) && f.slice(-15, -5) <= skillData.queried).sort().pop();
  const supplement = noteFile ? JSON.parse(fs.readFileSync(path.join(root, 'data', noteFile), 'utf8')) : {};
  skillNotesDate = supplement.queried || null;
  const stale = new Set();
  const oldTree = skillNotesDate && skillNotesDate !== skillData.queried && path.join(root, 'data', `ro-idle技能樹資料_${skillNotesDate}.json`);
  if (oldTree && fs.existsSync(oldTree)) {
    const old = JSON.parse(fs.readFileSync(oldTree, 'utf8')).skills;
    const changed = Object.keys(skillData.skills).filter(id => old[id] && (old[id].status.kind !== skillData.skills[id].status.kind || old[id].maxLv !== skillData.skills[id].maxLv));
    changed.forEach(id => stale.add(id));
    for (const job of skillData.jobs) for (const node of job.skillTree) {
      for (const req of Object.keys(node.requires || {})) {
        if (changed.includes(req)) stale.add(node.id);
        if (changed.includes(node.id)) stale.add(req);
      }
    }
  }
  const keep = id => !stale.has(id);
  const notes = Object.fromEntries(Object.entries(supplement.notes || {}).filter(([id]) => keep(id)));
  staleNotes.push(...Object.keys(supplement.notes || {}).filter(id => !keep(id)));
  skillData.notes = notes;
  skillData.noIdleEffect = (supplement.noIdleEffect || []).filter(keep);
  skillData.transit = Object.fromEntries(Object.entries(supplement.transit || {}).filter(([id, t]) => keep(id) && t.unlocks.every(keep)));
  // 只連到已產生的職業技能說明，轉生職業尚無說明頁時不顯示連結。
  skillData.guides = listMarkdown(path.join(root, '技能')).map(f => path.basename(f, '.md'));
}

function renderSkills() {
  const unavailable = Object.entries(skillData.skills).filter(([, skill]) => skill.status.kind !== 'ready');
  const disabledCount = unavailable.filter(([, skill]) => skill.status.kind === 'disabled').length;
  const pendingCount = unavailable.filter(([, skill]) => skill.status.kind === 'pending').length;
  const unavailableList = unavailable.map(([id, skill]) => `<li><a href="https://ro-idle.app/info/database?type=skills&amp;id=${encodeURIComponent(id)}" target="_blank" rel="noopener noreferrer">${esc(skill.name)}（${esc(id)}）</a><span>${skill.status.kind === 'disabled' ? '本遊戲停用' : '目前無法學習'}</span><p>${esc(skill.status.reason || '資訊站未提供原因')}</p></li>`).join('');
  const body = `<main id="main" class="article-shell tool-shell"><div class="article-top"><a href="index.html" class="back-link">← 回到攻略目錄</a><span class="eyebrow">工具 · 一轉、二轉與轉生二轉</span><h1>技能配點模擬器</h1><p class="article-summary">選職業、設定 Job Lv，直接點技能加點（右鍵減點），或點刻度設定等級。前置技能會自動補齊，右側記錄學習順序，可複製成攻略「技能配點」表或分享連結。</p><div class="article-meta"><span>資料查詢：<time>${esc(skillData.queried)}</time></span><a href="index.html#skill-guides">各職業技能說明 ↗</a><a href="https://ro-idle.app/info/database?type=jobs" target="_blank" rel="noopener noreferrer">RO 放置仙境資訊站 · 職業 ↗</a><a href="${repo}/blob/main/data/${encodeURIComponent(skillSnapshot)}" target="_blank" rel="noopener noreferrer">資料快照 ↗</a></div></div>
  <div id="skill-sim" class="skill-sim" data-src="skills-data.json?v=${crypto.createHash('sha256').update(JSON.stringify(skillData)).digest('hex').slice(0, 10)}">${unavailable.length ? `<details class="sk-unavailable"><summary>停用技能 ${disabledCount} 項、目前無法學習 ${pendingCount} 項 · 查詢 ${esc(skillData.queried)}</summary><p>依資訊站狀態整理。這些技能與其受影響的前置路線無法投入點數；已失效分享連結中的相關點數會在載入時移除。另有 ${Object.keys(skillData.transit).length} 個可學但掛機無實效的必要過路技能，仍可投入點數；點選卡片可在技能說明欄查看最低等級與解鎖目標。</p><ul>${unavailableList}</ul></details>` : ''}<div id="sk-picker"></div>
  <div class="sk-tools"><button type="button" data-tool="prereq" aria-pressed="false" title="切換點技能時前置技能補到需求等級或直接點滿">前置：補到需求等級</button><button type="button" data-tool="undo">復原上一步</button><button type="button" data-tool="reset">全部重置</button><button type="button" data-tool="md">複製 Markdown 配點表</button><button type="button" data-tool="link" class="primary">複製分享連結</button></div>
  <div class="sk-layout"><div id="sk-board" class="sk-board"><p class="sk-hint">載入技能資料中…</p></div><aside class="sk-side"><section class="sk-panel"><h2>技能說明</h2><div id="sk-detail"></div></section><section class="sk-panel"><h2>學習順序</h2><div id="sk-order"></div></section></aside></div>
  <details class="sk-rules"><summary>點數規則與資料說明</summary><ul><li>每升 1 Job Lv 得 1 技能點：初學者 Job 10 共 9 點、一轉與二轉 Job 50 各 49 點；超級初心者 Job Lv 上限 ${esc(skillData.jobs.find(j => j.id === 'supernovice')?.maxJobLv ?? '待查證')}。</li><li>轉生：${skillData.rebirth ? `二轉職業 Base ${skillData.rebirth.minBaseLv}、Job ${skillData.rebirth.minJobLv} 且技能點用完，費用 ${skillData.rebirth.zeny.toLocaleString('en-US')} Zeny` : '條件待查證'}，重新從進階初學者開始，只能走原本的職業系並轉成對應的轉生二轉（Job 上限 70，最多 69 點）。進階初學者的初學者技能轉生後自動學會、升 Job 不給技能點；進階一轉與一般一轉相同，每升 1 Job Lv 得 1 點（資訊站 2026-10-27 p6.1 更新說明）。轉生二轉的技能前置與「一轉點數須先用完」規則與一般二轉相同。</li><li>一轉 Job 40 以上且技能點用完才能轉二轉；二轉職業預設在一轉 Job 40 轉職，也就是一轉技能點滿 39 點即可學二轉技能，晚轉職時可把「轉職 Job Lv」改成 41～50；二轉專屬技能須先把一轉期間的點數全部投入一轉技能（資訊站的學習判定）。二轉後多出的點數可回補一轉技能。</li><li>任務技能（標示「任務 Job N」）達到 Job Lv 即可學，不扣技能點。</li><li>「本遊戲停用」與「目前無法學習」都不可投入點數，前置被停用時下游也不可學；「可學但放置版不施放」仍可依前置需求投入。技能名稱、等級上限、前置與各級效果擷取自資訊站；「放置版重點」為本攻略依資料整理的摘要，實際掛機收益仍待實測。遊戲更新後以資訊站為準。</li>${skillNotesDate && skillNotesDate !== skillData.queried ? `<li>放置版重點沿用 ${esc(skillNotesDate)} 的整理；轉生二轉新技能尚無重點。${staleNotes.length ? `${staleNotes.map(id => esc(skillData.skills[id]?.name || id)).join('、')}因技能狀態在 ${esc(skillData.queried)} 有變（例如原本停用的技能改為可學），舊重點暫不顯示，待複核。` : ''}</li>` : ''}<li>介面參考 <a href="https://ro.17173.com/content/03312017/175328149.shtml" target="_blank" rel="noopener noreferrer">17173 全職業技能樹</a> 的模擬器形式重新設計。</li></ul></details></div></main>`;
  return `${layout({ title: '技能配點模擬器', description: 'RO 放置仙境一轉、二轉與轉生二轉各職業的技能配點模擬器，依資訊站技能樹資料計算點數與前置。', body, page: 'tool' })}`.replace('</head>', `<script src="skills.js?v=${asset.skills}" defer></script></head>`);
}

function renderHome() {
  const roles = docs.filter(x => x.kind === 'role');
  const starter = roles.find(x => x.first === '初心者' && x.title === '初心者一轉前');
  const equipment = docs.filter(x => x.kind === 'equipment');
  const skillGuides = docs.filter(x => x.kind === 'skill');
  const groups = [...new Set(roles.map(x => x.first))].sort((a, b) => {
    const aa = classOrder.indexOf(a), bb = classOrder.indexOf(b);
    return (aa < 0 ? 99 : aa) - (bb < 0 ? 99 : bb);
  });
  const body = `<main id="main"><section class="hero"><div class="hero-inner"><div class="hero-copy"><span class="eyebrow">玩家自建 · 非官方攻略索引</span><h1>先看條件，<br><em>再選攻略。</em></h1><p>把職業培養、掛機設定與裝備取捨放在同一個閱讀入口。從目前角色與遊玩目標出發，找到下一步，也看得見建議背後的資料與限制。</p><div class="hero-actions"><a class="button-primary" href="${starter ? starter.url : '#roles'}">新手先讀：初心者攻略 <span aria-hidden="true">→</span></a><a class="button-text" href="#roles">瀏覽職業攻略 ↗</a></div></div><div class="hero-board" aria-label="閱讀攻略的三個步驟"><div class="board-top"><span>攻略閱讀路徑</span><span>01 — 03</span></div><div class="board-step"><b>01</b><div><strong>確定目標</strong><span>經驗、Zeny、材料或穩定度</span></div></div><div class="board-step"><b>02</b><div><strong>對照角色</strong><span>等級、技能、裝備與補給條件</span></div></div><div class="board-step"><b>03</b><div><strong>驗證結果</strong><span>擊殺、收益、死亡與中斷紀錄</span></div></div><div class="board-foot">依條件比較，不只給單一答案。</div></div></div></section>
  <section class="intro-strip" aria-label="網站內容"><div><strong>${roles.length}</strong><span>篇職業攻略</span></div><div><strong>${skillGuides.length - 1}</strong><span>份職業技能說明</span></div><div><strong>${equipment.length}</strong><span>篇裝備分析</span></div><p>每篇標明最後查證日期；原始 Markdown 與引用來源可直接開啟。</p></section>
  <section class="content-section role-section" id="roles"><div class="section-heading"><div><span class="eyebrow">職業路線</span><h2>找到你的培養起點</h2><p>從初心者一轉前開始，或依一轉職業閱讀各二轉流派的條件與取捨。</p></div><div class="search-wrap"><label for="site-search">搜尋全部攻略</label><div class="search-box"><span aria-hidden="true">⌕</span><input id="site-search" type="search" placeholder="搜尋職業、技能、裝備、ID…" autocomplete="off"><kbd>/</kbd></div></div></div>
  <a class="sim-banner" href="skills.html"><span class="card-type">工具</span><strong>技能配點模擬器</strong><span>${skillData ? `${skillData.jobs.length} 個職業（含轉生二轉）· 資訊站資料 ${skillData.queried}` : '含轉生二轉職業'}，加點時自動補前置並記錄學習順序。</span><b aria-hidden="true">→</b></a>
  <div id="search-results" class="search-results" hidden aria-live="polite"></div>
  <div id="browse-content"><div class="class-nav" aria-label="依職業篩選"><button type="button" class="active" data-filter="all" aria-pressed="true">全部職業</button>${groups.map(g => `<button type="button" data-filter="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join('')}</div><div class="guide-grid" id="role-grid">${roles.map(doc => `<div data-class="${esc(doc.first)}">${card(doc)}</div>`).join('')}</div></div></section>
  <section class="content-section skill-guide-section" id="skill-guides"><div class="section-heading"><div><span class="eyebrow">技能資料</span><h2>各職業技能說明</h2><p>依職業查最高等級、前置與放置版限制；各級完整數值連至資訊站。</p></div></div><div class="guide-grid">${skillGuides.map(doc => card(doc)).join('')}</div></section>
  <section class="content-section equipment-section" id="equipment"><div class="section-heading"><div><span class="eyebrow">裝備決策</span><h2>先確認用途，再決定保留</h2><p>從類型清單掌握原則，用逐件判定核對裝備 ID 與限制。</p></div><span class="section-icon" aria-hidden="true">02</span></div><div class="equipment-grid">${equipment.map(x => card(x)).join('')}</div></section>
  <section class="reading-section" id="how-to-read"><div class="reading-inner"><div><span class="eyebrow">閱讀方法</span><h2>每個結論，都能追溯依據</h2><p>本攻略會把可查證資料、玩家觀測、計算結果與未驗證建議分開。遊戲可能調整公式、掉落與技能效果，請依角色條件與最新資訊重新判斷。</p><a href="${repo}/blob/main/AGENTS.md" target="_blank" rel="noopener noreferrer">查看完整查證規則 ↗</a></div><div class="evidence-list"><div><span>01</span><strong>已查證的遊戲資料</strong><p>優先引用 RO 放置仙境資訊站，保留名稱、ID 與直達連結。</p></div><div><span>02</span><strong>使用者提供的實測</strong><p>記錄角色、裝備、地圖、測試時長與觀測日期。</p></div><div><span>03</span><strong>依資料計算的結果</strong><p>列出輸入值、公式與適用前提，方便重新計算。</p></div><div><span>04</span><strong>建議與待驗證假設</strong><p>R 版前資料只作候選方案；未在本遊戲確認時會清楚標示。</p></div></div></div></section></main>`;
  return layout({ title: '首頁', description: 'RO 放置仙境非官方攻略：依職業、掛機目標與裝備用途找到適合自己的路線。', body });
}

fs.mkdirSync(guidesOutput, { recursive: true });
for (const doc of docs) fs.writeFileSync(path.join(guidesOutput, `${path.basename(doc.file, '.md')}.html`), renderArticle(doc));
fs.writeFileSync(path.join(output, 'index.html'), renderHome());
if (skillData) {
  fs.writeFileSync(path.join(output, 'skills.html'), renderSkills());
  fs.writeFileSync(path.join(output, 'skills-data.json'), JSON.stringify(skillData));
}
fs.writeFileSync(path.join(output, 'search.json'), JSON.stringify(docs.map(({ title, kind, label, date, summary, url, source }) =>
  ({ title, kind, label, date, summary, url, text: plainMarkdown(source).toLowerCase() }))));
for (const asset of ['style.css', 'app.js', 'skills.js', 'favicon.svg']) fs.copyFileSync(path.join(__dirname, asset), path.join(output, asset));
console.log(`Built ${docs.length} guides into ${path.relative(root, output)}`);
