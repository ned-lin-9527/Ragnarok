(() => {
  const filterButtons = [...document.querySelectorAll('[data-filter]')];
  const roleCards = [...document.querySelectorAll('[data-class]')];
  filterButtons.forEach(button => button.addEventListener('click', () => {
    const selected = button.dataset.filter;
    filterButtons.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    roleCards.forEach(card => { card.hidden = selected !== 'all' && card.dataset.class !== selected; });
  }));

  const input = document.getElementById('site-search');
  const results = document.getElementById('search-results');
  const browse = document.getElementById('browse-content');
  let indexPromise;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const normalize = value => String(value).normalize('NFKC').toLowerCase();
  function renderResults(docs, query) {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const matches = docs.map(doc => {
      const title = normalize(doc.title), label = normalize(doc.label), summary = normalize(doc.summary);
      const haystack = `${title} ${label} ${summary} ${doc.text}`;
      if (!words.every(word => haystack.includes(word))) return null;
      const score = words.reduce((total, word) => total + (title.includes(word) ? 5 : 0) + (label.includes(word) ? 3 : 0) + (summary.includes(word) ? 2 : 0), 0);
      return { doc, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score).slice(0, 24);
    results.innerHTML = `<p>找到 ${matches.length} 篇相關攻略${matches.length === 24 ? '（顯示前 24 篇）' : ''}</p><div class="search-list">${matches.map(({ doc }) => `<a class="search-hit" href="${doc.url}"><strong>${escapeHtml(doc.title)}</strong><span>${escapeHtml(doc.label)} · 最後查證 ${escapeHtml(doc.date)}</span></a>`).join('')}</div>`;
  }
  if (input) {
    input.addEventListener('input', async () => {
      const query = input.value.trim();
      results.hidden = !query;
      browse.hidden = !!query;
      if (!query) return;
      results.innerHTML = '<p>搜尋中…</p>';
      try {
        indexPromise ||= fetch('search.json').then(response => {
          if (!response.ok) throw new Error('搜尋資料載入失敗');
          return response.json();
        });
        const docs = await indexPromise;
        if (input.value.trim() === query) renderResults(docs, query);
      } catch {
        results.innerHTML = '<p>搜尋暫時無法使用，請從下方目錄瀏覽攻略。</p>';
        browse.hidden = false;
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        event.preventDefault(); input.focus();
      }
    });
  }

  const tocLinks = [...document.querySelectorAll('.toc nav a')];
  const tocPanel = document.querySelector('.toc-panel');
  if (tocPanel && window.matchMedia('(max-width: 760px)').matches) tocPanel.open = false;
  if (tocLinks.length && 'IntersectionObserver' in window) {
    const byId = new Map(tocLinks.map(link => [link.hash.slice(1), link]));
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        tocLinks.forEach(link => link.classList.toggle('active', link === byId.get(entry.target.id)));
      }
    }, { rootMargin: '-100px 0px -70% 0px' });
    byId.forEach((_, id) => { const heading = document.getElementById(id); if (heading) observer.observe(heading); });
  }
})();
