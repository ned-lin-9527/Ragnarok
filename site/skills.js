// 技能配點模擬器：資料來自 data/ro-idle技能樹資料_*.json，由 build.cjs 輸出為 skills-data.json。
// 點數規則依資訊站前端的學習判定：每升 1 Job Lv 得 1 點；一轉 Job 40 以上且點數用完才能轉職；
// 二轉專屬技能須在一轉期間的點數全部投入一轉技能後才能學；任務技能不扣點。
(() => {
  const root = document.getElementById('skill-sim');
  if (!root) return;
  const INFO = 'https://ro-idle.app/info/database?type=skills&id=';
  const KIND = { passive: '被動', self: '自身', attack: '攻擊', ground: '地面', support: '輔助' };
  const NOVICE = ['NV_BASIC', 'NV_FIRSTAID'];
  const LINES = ['swordman', 'mage', 'archer', 'acolyte', 'merchant', 'thief'];
  const CODE = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const $ = sel => root.querySelector(sel);

  let data, jobs, state, ctx, selected = null;

  function context(job) {
    const from = job.jobChange?.from;
    const first = from && from !== 'novice' ? jobs[from] : null;
    const kind = job.id === 'novice' ? 'novice' : job.id === 'supernovice' ? 'super' : first ? 'second' : 'first';
    const firstIds = new Set(first ? first.skillTree.map(s => s.id) : []);
    const tree = new Map(job.skillTree.map(s => [s.id, s]));
    const free = id => tree.get(id)?.questJobLv !== undefined;
    // 初學者以外，基本技能固定在初學者階段點滿 9 級，不佔用此處的點數。
    const fixed = kind === 'novice' ? {} : { NV_BASIC: 9 };
    const jobLvRange = kind === 'novice' ? [1, 10] : kind === 'super' ? [1, job.maxJobLv] : kind === 'second' ? [first.jobChange.minJobLv ?? 40, first.maxJobLv] : [1, job.maxJobLv];
    return { job, first, kind, firstIds, tree, free, fixed, jobLvRange };
  }

  // 依目前順序逐點重播，回傳等級與每一步的階段、Job Lv 與問題。
  function replay() {
    const pool1 = state.c - 1, pool2 = ctx.kind === 'second' ? state.l - 1 : 0;
    const levels = { ...ctx.fixed };
    let used = 0, firstSpent = 0;
    const steps = state.order.map(id => {
      const node = ctx.tree.get(id), skill = data.skills[id];
      levels[id] = (levels[id] || 0) + 1;
      const step = { id, lv: levels[id], free: ctx.free(id), issues: [] };
      if (!step.free) {
        used++;
        if (ctx.kind === 'second' && ctx.firstIds.has(id)) firstSpent++;
        step.point = used;
        step.phase = used <= pool1 ? 1 : 2;
        step.jobLv = step.phase === 1 ? used + 1 : used - pool1 + 1;
        if (used > pool1 + pool2) step.issues.push('超過可用技能點');
        if (ctx.kind === 'second' && !ctx.firstIds.has(id) && step.phase === 1) step.issues.push(`一轉期間的 ${pool1} 點須先投入一轉技能`);
      } else {
        const q = node.questJobLv;
        const reach = ctx.kind === 'second' ? Math.max(state.c, state.l) : state.c;
        if (reach < q) step.issues.push(`任務技能需 Job Lv ${q}`);
      }
      for (const [req, need] of Object.entries(node.requires || {})) {
        if ((levels[req] || 0) < need) step.issues.push(`需要 ${data.skills[req].name} Lv ${need}`);
      }
      if (levels[id] > node.maxLv) step.issues.push('超過最高等級');
      if (skill.status.kind !== 'ready') step.issues.push(skill.status.reason);
      return step;
    });
    return { levels, used, firstSpent, pool1, pool2, steps, issues: steps.filter(s => s.issues.length) };
  }

  // 把技能提升到 target：先補齊前置（依設定補到需求等級或點滿），再以重播檢查是否合法。
  function tryRaise(id, target, fillMax) {
    const add = [];
    const levels = { ...replay().levels };
    (function raise(skillId, lv) {
      const node = ctx.tree.get(skillId);
      for (const [req, need] of Object.entries(node.requires || {})) {
        raise(req, fillMax && data.skills[req].status.kind === 'ready' ? ctx.tree.get(req).maxLv : need);
      }
      while ((levels[skillId] || 0) < lv) { levels[skillId] = (levels[skillId] || 0) + 1; add.push(skillId); }
    })(id, target);
    const before = replay().issues.length;
    const prev = state.order;
    state.order = [...prev, ...add];
    const after = replay();
    const fresh = after.steps.slice(prev.length).flatMap(s => s.issues);
    if (fresh.length || after.issues.length > before) {
      state.order = prev;
      return fresh[0] || '無法再提升';
    }
    return null;
  }
  // 依序嘗試：目標等級＋前置點滿 → 目標等級＋前置補到需求 → 逐級降低目標，盡量完成。
  function setLevel(id, target) {
    const cur = replay().levels[id] || 0;
    if (target <= cur) {
      while ((replay().levels[id] || 0) > target && state.order.includes(id)) decrement(id);
      return null;
    }
    let first = null;
    for (let lv = target; lv > cur; lv--) {
      const modes = state.p === 'max' ? [true, false] : [false];
      for (const fillMax of modes) {
        const err = tryRaise(id, lv, fillMax);
        if (!err) {
          if (lv < target) return `${first}；已提升到 Lv ${lv}`;
          return fillMax || state.p !== 'max' ? null : '點數不足以點滿前置，前置只補到需求等級';
        }
        first ||= err;
      }
    }
    return first;
  }
  const increment = id => setLevel(id, (replay().levels[id] || 0) + 1);

  // −1：移除最後一次學習；前置不足的技能連帶歸零。
  function decrement(id) {
    const at = state.order.lastIndexOf(id);
    if (at < 0) return;
    state.order = state.order.filter((_, i) => i !== at);
    cascade();
  }
  function cascade() {
    for (let changed = true; changed;) {
      changed = false;
      const { levels } = replay();
      for (const [sid, lv] of Object.entries(levels)) {
        if (!lv || ctx.fixed[sid]) continue;
        const req = ctx.tree.get(sid)?.requires || {};
        if (Object.entries(req).some(([r, need]) => (levels[r] || 0) < need)) {
          state.order = state.order.filter(x => x !== sid);
          changed = true;
        }
      }
    }
  }

  function depthMap(ids) {
    const memo = {};
    const depth = id => memo[id] ??= Math.max(0, ...Object.keys(ctx.tree.get(id).requires || {}).filter(r => ids.includes(r)).map(r => depth(r) + 1));
    ids.forEach(depth);
    return memo;
  }

  function card(id, levels, cls = '', style = '') {
    const node = ctx.tree.get(id), skill = data.skills[id], lv = levels[id] || 0;
    const fixed = ctx.fixed[id] !== undefined;
    const blocked = skill.status.kind !== 'ready';
    const reqs = Object.entries(node.requires || {}).map(([req, need]) =>
      `<span class="req${(levels[req] || 0) >= need ? ' met' : ''}">${esc(data.skills[req].name)} ${need}</span>`).join('');
    const tags = [node.questJobLv ? `<span class="tag quest">任務 Job ${node.questJobLv}</span>` : '', blocked ? `<span class="tag off">${skill.status.kind === 'disabled' ? '本遊戲停用' : '無法學習'}</span>` : ''].join('');
    return `<div class="sk-card${lv ? ' on' : ''}${lv === node.maxLv ? ' max' : ''}${blocked ? ' blocked' : ''}${selected === id ? ' sel' : ''}${cls}" data-id="${id}"${style ? ` style="${style}"` : ''}>
      <button type="button" class="sk-name" data-act="inc" title="點一下升 1 級（自動補前置）；右鍵降 1 級">${esc(skill.name)}</button><small class="sk-id" title="${id}">${id}</small>
      <div class="sk-lv"><button type="button" data-act="dec" aria-label="${esc(skill.name)} 降 1 級"${!lv || fixed ? ' disabled' : ''}>−</button><b>${lv}<span>/${node.maxLv}</span></b><button type="button" data-act="inc" aria-label="${esc(skill.name)} 升 1 級"${lv >= node.maxLv || fixed || blocked ? ' disabled' : ''}>＋</button></div>
      ${node.maxLv > 1 && !fixed && !blocked ? `<div class="sk-pips" role="group" aria-label="${esc(skill.name)} 直接設定等級">${Array.from({ length: node.maxLv }, (_, i) => `<button type="button" data-act="set" data-lv="${i + 1 === lv ? i : i + 1}" class="${i < lv ? 'on' : ''}" aria-label="設為 Lv ${i + 1 === lv ? i : i + 1}" title="Lv ${i + 1}"></button>`).join('')}</div>` : ''}
      ${tags || reqs ? `<div class="sk-meta">${tags}${reqs}</div>` : ''}</div>`;
  }

  // 依前置深度分欄，子技能盡量排在主要前置（同區最深的前置）的同一列右側。
  // 沒有前置也沒有後續技能的獨立技能另外排成一列，避免樹狀區過長。
  function section(title, note, ids, levels) {
    if (!ids.length) return '';
    const depth = depthMap(ids);
    const parent = {}, children = {};
    for (const id of ids) {
      const reqs = Object.keys(ctx.tree.get(id).requires || {}).filter(r => ids.includes(r));
      if (!reqs.length) continue;
      parent[id] = reqs.reduce((a, b) => depth[b] > depth[a] ? b : a);
      (children[parent[id]] ||= []).push(id);
    }
    const needed = new Set(ids.flatMap(id => Object.keys(ctx.tree.get(id).requires || {})));
    const loose = ids.filter(id => depth[id] === 0 && !needed.has(id));
    const taken = new Set(), cells = [];
    let rows = 0;
    const place = (id, row) => {
      let r = row;
      while (taken.has(`${r}:${depth[id]}`)) r++;
      taken.add(`${r}:${depth[id]}`);
      rows = Math.max(rows, r + 1);
      cells.push({ id, r, linked: parent[id] && cells.some(c => c.id === parent[id] && c.r === r && depth[parent[id]] === depth[id] - 1) });
      (children[id] || []).forEach(child => place(child, r));
    };
    ids.filter(id => depth[id] === 0 && !loose.includes(id)).forEach(id => place(id, rows));
    const cols = Math.max(1, ...cells.map(c => depth[c.id] + 1));
    const spent = ids.filter(id => !ctx.free(id) && !ctx.fixed[id]).reduce((t, id) => t + (levels[id] || 0), 0);
    return `<section class="sk-tree"><header><h3>${esc(title)}</h3><span>${note}　已投入 <b>${spent}</b> 點</span></header>
      ${loose.length ? `<div class="sk-loose"><span class="sk-depth">獨立技能</span><div>${loose.map(id => card(id, levels)).join('')}</div></div>` : ''}
      ${cols > 5 ? '<p class="sk-hint">此技能樹較深，可左右捲動查看。</p>' : ''}${cells.length ? `<div class="sk-grid" style="--cols:${cols}">${cells.map(c => card(c.id, levels, c.linked ? ' linked' : '', `grid-row:${c.r + 1};grid-column:${depth[c.id] + 1}`)).join('')}</div>` : ''}</section>`;
  }

  function runs(r) {
    const out = [];
    for (const s of r.steps) {
      const last = out[out.length - 1];
      if (last && last.id === s.id && last.free === s.free && last.phase === s.phase) { last.to = s.lv; last.jobTo = s.jobLv; last.point = s.point; last.issues.push(...s.issues); }
      else out.push({ id: s.id, free: s.free, phase: s.phase, from: s.lv, to: s.lv, jobFrom: s.jobLv, jobTo: s.jobLv, point: s.point, issues: [...s.issues] });
    }
    return out;
  }
  const phaseName = p => ctx.kind === 'second' ? (p === 1 ? ctx.first.name : ctx.job.name) : ctx.job.name;
  const runJob = x => x.free ? `任務（Job ${ctx.tree.get(x.id).questJobLv}）` : `${phaseName(x.phase)} Job ${x.jobFrom}${x.jobTo !== x.jobFrom ? `–${x.jobTo}` : ''}`;

  function markdown(r) {
    const rows = runs(r).map(x => `| ${runJob(x)} | ${data.skills[x.id].name}（${x.id}） | Lv ${x.from === x.to ? x.to : `${x.from}→${x.to}`} | ${x.free ? '不扣點' : x.point} |`);
    const head = ctx.kind === 'second' ? `${ctx.first.name} Job ${state.c} 轉職 → ${ctx.job.name} Job ${state.l}` : `${ctx.job.name} Job ${state.c}`;
    return `${head}（資料：RO 放置仙境資訊站，查詢 ${data.queried}）\n\n| Job Lv | 技能（ID） | 等級 | 累計點數 |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`;
  }

  function detail(r) {
    if (!selected || !ctx.tree.has(selected)) return '<p class="sk-hint">點技能卡片升 1 級、右鍵降 1 級，點下方刻度可直接設定等級；前置技能會自動補齊。滑過卡片會標出前置（藍）與可解鎖技能（橘）。</p>';
    const node = ctx.tree.get(selected), skill = data.skills[selected], lv = r.levels[selected] || 0;
    const unlocks = [...ctx.tree.values()].filter(s => s.requires?.[selected]).map(s => `${esc(data.skills[s.id].name)}（需 ${s.requires[selected]}）`);
    const reqs = Object.entries(node.requires || {}).map(([q, n]) => `${esc(data.skills[q].name)} Lv ${n}`);
    const rows = skill.descs.map((d, i) => `<li class="${i + 1 === lv ? 'cur' : ''}"><b>Lv ${i + 1}</b>${esc(d)}</li>`).join('');
    return `<h3>${esc(skill.name)} <small>${selected}</small></h3>
      <p class="sk-facts"><span>${KIND[skill.kind] || skill.kind}</span><span>最高 Lv ${node.maxLv}</span>${node.questJobLv ? `<span>任務技能 · Job ${node.questJobLv} · 不扣點</span>` : ''}</p>
      ${skill.status.kind !== 'ready' ? `<p class="sk-warn">${esc(skill.status.reason)}</p>` : ''}
      <dl><dt>前置</dt><dd>${reqs.join('、') || '無'}</dd><dt>解鎖</dt><dd>${unlocks.join('、') || '無'}</dd></dl>
      ${rows ? `<ol class="sk-descs">${rows}</ol>` : ''}
      <a class="sk-src" href="${INFO}${encodeURIComponent(selected)}" target="_blank" rel="noopener noreferrer">在資訊站查看 ↗</a>`;
  }

  function render(message) {
    const r = replay();
    const job = ctx.job;
    // 基本技能與緊急治療屬於初學者，只在初學者頁顯示。
    const pointIds = [...ctx.tree.keys()].filter(id => ctx.kind === 'novice' || !NOVICE.includes(id));
    const firstSec = ctx.kind === 'second' ? pointIds.filter(id => ctx.firstIds.has(id)) : [];
    const ownSec = pointIds.filter(id => !firstSec.includes(id));
    const budget = r.pool1 + r.pool2;
    const lvInput = (key, label, [min, max]) => `<label class="sk-num"><span>${label}</span><input type="number" data-key="${key}" min="${min}" max="${max}" value="${state[key]}"></label>`;
    const ready = ctx.kind === 'second'
      ? (r.firstSpent >= r.pool1 ? `已在 ${ctx.first.name} Job ${state.c} 用完 ${r.pool1} 點，可轉職` : `${ctx.first.name}技能尚差 ${r.pool1 - r.firstSpent} 點才能轉職`)
      : ctx.kind === 'first' ? (state.c >= 40 && r.used === r.pool1 ? 'Job 40 以上且點數用完，可轉二轉' : `轉二轉需 Job 40 以上且點數用完（目前剩 ${r.pool1 - r.used} 點）`)
      : ctx.kind === 'novice' ? ((r.levels.NV_BASIC || 0) >= 9 ? '基本技能 Lv 9，可轉一轉（Job 10）' : '轉一轉需 Job 10、基本技能 Lv 9')
      : '超級初心者：由初學者 Job 10、Base 45 轉職；基本技能已計入';
    const list = runs(r);
    $('#sk-board').innerHTML = `
      <div class="sk-points">
        ${ctx.kind === 'second' ? lvInput('c', `${esc(ctx.first.name)}轉職 Job Lv`, ctx.jobLvRange) + lvInput('l', `${esc(job.name)} Job Lv`, [1, job.maxJobLv]) : lvInput('c', `${esc(job.name)} Job Lv`, ctx.jobLvRange)}
        <div class="sk-meter"><span>剩餘技能點</span><strong class="${r.used > budget ? 'bad' : ''}">${budget - r.used}</strong><em>已用 ${r.used} / ${budget}</em></div>
        <div class="sk-ready ${r.issues.length ? 'bad' : ''}">${r.issues.length ? `有 ${r.issues.length} 個步驟不合規則，請調整 Job Lv 或移除標紅步驟` : esc(ready)}</div>
      </div>
      ${message ? `<p class="sk-toast" role="status">${esc(message)}</p>` : ''}
      ${ctx.kind !== 'novice' ? `<p class="sk-fixed">初學者技能（基本技能 NV_BASIC Lv 9、緊急治療 NV_FIRSTAID）在初學者頁配點，不列入本頁。</p>` : ''}
      ${section(ctx.kind === 'second' ? `${ctx.first.name}技能` : `${job.name}技能`, ctx.kind === 'second' ? `一轉期間 ${r.pool1} 點須全部用在此區` : `可用 ${budget} 點`, ctx.kind === 'second' ? firstSec : ownSec, r.levels)}
      ${ctx.kind === 'second' ? section(`${job.name}技能`, `二轉 ${r.pool2} 點；未用完的二轉點數也可回補一轉技能`, ownSec, r.levels) : ''}`;
    $('#sk-detail').innerHTML = detail(r);
    $('#sk-order').innerHTML = list.length
      ? `<ol>${list.map(x => `<li class="${x.issues.length ? 'bad' : ''}${x.free ? ' free' : ''}"><span>${esc(runJob(x))}</span><b>${esc(data.skills[x.id].name)}</b><em>Lv ${x.from === x.to ? x.to : `${x.from}→${x.to}`}</em>${x.issues.length ? `<small>${esc([...new Set(x.issues)].join('；'))}</small>` : ''}</li>`).join('')}</ol>`
      : '<p class="sk-hint">按「＋」依序加點，這裡會記錄學習順序，可複製成攻略的技能配點表。</p>';
    root.querySelectorAll('.sk-jobs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.job === job.id)));
    const prereq = root.querySelector('[data-tool="prereq"]');
    prereq.setAttribute('aria-pressed', String(state.p === 'max'));
    prereq.textContent = state.p === 'max' ? '前置：直接點滿' : '前置：補到需求等級';
    writeHash();
  }

  function writeHash() {
    const ids = ctx.job.skillTree.map(s => s.id);
    const o = state.order.map(id => CODE[ids.indexOf(id)]).join('');
    history.replaceState(null, '', `#${new URLSearchParams({ j: ctx.job.id, c: state.c, ...(ctx.kind === 'second' ? { l: state.l } : {}), ...(state.p === 'max' ? { p: 'max' } : {}), ...(o ? { o } : {}) })}`);
  }
  function setJob(id, preset = {}) {
    const job = jobs[id] || jobs.knight;
    ctx = context(job);
    const [min, max] = ctx.jobLvRange;
    const clamp = (v, lo, hi, d) => Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
    const ids = job.skillTree.map(s => s.id);
    state = {
      c: clamp(Number(preset.c), min, max, max),
      l: clamp(Number(preset.l), 1, job.maxJobLv, job.maxJobLv),
      p: preset.p === 'max' || (preset.p === undefined && state?.p === 'max') ? 'max' : 'need',
      order: [...(preset.o || '')].map(ch => ids[CODE.indexOf(ch)]).filter(x => x && !ctx.fixed[x] && (ctx.kind === 'novice' || !NOVICE.includes(x))),
    };
    if (selected && !ctx.tree.has(selected)) selected = null;
  }

  function jobPicker() {
    const btn = j => `<button type="button" data-job="${j.id}" aria-pressed="false">${esc(j.name)}</button>`;
    const seconds = from => Object.values(jobs).filter(j => j.jobChange?.from === from);
    return `<div class="sk-jobs" role="group" aria-label="選擇職業">
      <div class="sk-line"><span>初學者</span>${btn(jobs.novice)}${btn(jobs.supernovice)}</div>
      ${LINES.map(id => `<div class="sk-line"><span>${esc(jobs[id].name)}系</span>${btn(jobs[id])}<i aria-hidden="true">→</i>${seconds(id).map(btn).join('')}</div>`).join('')}</div>`;
  }

  root.addEventListener('click', async event => {
    const jobBtn = event.target.closest('[data-job]');
    if (jobBtn) { setJob(jobBtn.dataset.job); render(); return; }
    const act = event.target.closest('[data-act]');
    if (act) {
      const id = act.closest('[data-id]').dataset.id;
      if (act.dataset.act === 'set') { selected = id; render(setLevel(id, Number(act.dataset.lv))); }
      else if (act.dataset.act === 'inc') { selected = id; render(increment(id)); }
      else if (act.dataset.act === 'dec') { selected = id; decrement(id); render(); }
      root.querySelector(`[data-id="${id}"] [data-act="${act.dataset.act}"]`)?.focus();
      return;
    }
    // 點卡片空白處也當作升 1 級。
    const cardEl = event.target.closest('.sk-card');
    if (cardEl && !event.target.closest('a,button')) {
      selected = cardEl.dataset.id;
      render(increment(selected));
      return;
    }
    const tool = event.target.closest('[data-tool]')?.dataset.tool;
    if (tool === 'reset') { state.order = []; render(); }
    if (tool === 'prereq') { state.p = state.p === 'max' ? 'need' : 'max'; render(state.p === 'max' ? '之後點技能時，前置技能會直接點滿' : '之後點技能時，前置技能只補到需求等級'); }
    if (tool === 'undo') { state.order = state.order.slice(0, -1); cascade(); render(); }
    if (tool === 'link' || tool === 'md') {
      const text = tool === 'link' ? location.href : markdown(replay());
      try { await navigator.clipboard.writeText(text); render(tool === 'link' ? '已複製分享連結' : '已複製 Markdown 技能配點表'); }
      catch { window.prompt('請手動複製：', text); }
    }
  });
  root.addEventListener('contextmenu', event => {
    const cardEl = event.target.closest('.sk-card');
    if (!cardEl) return;
    event.preventDefault();
    decrement(cardEl.dataset.id); render();
  });
  root.addEventListener('change', event => {
    const key = event.target.dataset.key;
    if (!key) return;
    const [min, max] = key === 'c' ? ctx.jobLvRange : [1, ctx.job.maxJobLv];
    state[key] = Math.min(max, Math.max(min, Math.round(Number(event.target.value)) || min));
    render();
  });
  // 滑過卡片時標出前置與可解鎖的技能。
  root.addEventListener('mouseover', event => {
    const cardEl = event.target.closest('.sk-card');
    root.querySelectorAll('.is-pre,.is-next').forEach(el => el.classList.remove('is-pre', 'is-next'));
    if (!cardEl) return;
    const id = cardEl.dataset.id;
    for (const req of Object.keys(ctx.tree.get(id).requires || {})) root.querySelector(`.sk-card[data-id="${req}"]`)?.classList.add('is-pre');
    for (const s of ctx.tree.values()) if (s.requires?.[id]) root.querySelector(`.sk-card[data-id="${s.id}"]`)?.classList.add('is-next');
  });

  fetch(root.dataset.src).then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(json => {
    data = json;
    jobs = Object.fromEntries(json.jobs.map(j => [j.id, j]));
    $('#sk-picker').innerHTML = jobPicker();
    const load = () => {
      const params = new URLSearchParams(location.hash.slice(1));
      setJob(params.get('j') || 'knight', Object.fromEntries(params));
      render();
    };
    load();
    // 只有使用者貼上或切換連結時才重新載入；writeHash 用 replaceState 不會觸發。
    window.addEventListener('hashchange', load);
  }).catch(() => { $('#sk-board').innerHTML = '<p class="sk-warn">技能資料載入失敗，請重新整理頁面。</p>'; });
})();
