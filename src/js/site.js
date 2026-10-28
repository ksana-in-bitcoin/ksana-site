// Behavior of every page: the theme toggle, the drawer, search, copy buttons, tabbed code and the docs' contents.
// Pages work without it; it only adds to them. Data comes from the page element (the body, or #page in a preview).

const root = document.getElementById('page') || document.body;
const html = document.documentElement;

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // storage blocked: nothing is remembered
  }
  return null;
}

// Theme -------------------------------------------------------------------------------------------------------------

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function scheme() {
  const theme = html.getAttribute('data-theme');
  if (theme === 'light' || theme === 'dark') return theme;
  return darkQuery.matches ? 'dark' : 'light';
}

function syncTheme() {
  const dark = scheme() === 'dark';
  for (const button of document.querySelectorAll('.theme-toggle')) {
    button.setAttribute('aria-label', dark ? button.dataset.toLight : button.dataset.toDark);
  }
  if (html.hasAttribute('data-theme')) {
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.setAttribute('content', dark ? '#0d1314' : '#f1f4f3');
  }
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.theme-toggle')) return;
  const next = scheme() === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  store('ksana-theme', next);
  syncTheme();
});
darkQuery.addEventListener?.('change', syncTheme);
syncTheme();

// Dialogs: the drawer and search -------------------------------------------------------------------------------------

let openDialog = null;
let returnFocus = null;

function focusables(container) {
  return [...container.querySelectorAll('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => !el.closest('[hidden]') && el.getClientRects().length,
  );
}

function open(dialog, focus) {
  if (openDialog) close();
  returnFocus = document.activeElement;
  dialog.hidden = false;
  openDialog = dialog;
  html.classList.add('is-locked');
  if (dialog.id === 'drawer') document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'true');
  (focus || focusables(dialog)[0])?.focus();
}

function close() {
  if (!openDialog) return;
  const dialog = openDialog;
  dialog.hidden = true;
  openDialog = null;
  html.classList.remove('is-locked');
  if (dialog.id === 'drawer') document.querySelector('.menu-toggle')?.setAttribute('aria-expanded', 'false');
  if (returnFocus && document.contains(returnFocus)) returnFocus.focus();
}

document.addEventListener('click', (event) => {
  if (event.target.closest('.menu-toggle')) open(document.getElementById('drawer'));
  else if (event.target.closest('.search-open')) openSearch();
  else if (openDialog && event.target.closest('[data-close]')) close();
  else if (openDialog?.id === 'drawer' && event.target.closest('#drawer a[href]')) close();
});

document.addEventListener('keydown', (event) => {
  if (openDialog) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      const items = focusables(openDialog);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    return;
  }
  const typing = event.target.closest?.('input, textarea, select, [contenteditable="true"]');
  if ((event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
    event.preventDefault();
    openSearch();
  }
});

// The drawer is for narrow screens only: close it when the screen widens.
matchMedia('(min-width: 860px)').addEventListener?.('change', (event) => {
  if (event.matches && openDialog?.id === 'drawer') close();
});

// Search ---------------------------------------------------------------------------------------------------------------

const search = document.getElementById('search');
const input = search?.querySelector('input');
const results = search?.querySelector('.search-results');
const status = search?.querySelector('.search-status');
let index = null;
let loading = null;
let selected = -1;

/** A site path ('/docs/rpc/#methods') as a URL relative to this page. */
function siteUrl(path) {
  const [file, hash] = path.split('#');
  let url = (root.dataset.root || './') + file.replace(/^\//, '');
  if (root.dataset.preview && url.endsWith('/')) url += 'index.html';
  if (url.startsWith('./') && url.length > 2) url = url.slice(2);
  return url + (hash ? `#${hash}` : '');
}

function fold(text) {
  return text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function loadIndex() {
  if (!loading) {
    status.textContent = status.dataset.loading;
    loading = fetch(root.dataset.search)
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then((entries) => {
        index = entries.map((entry) => ({ ...entry, f: { page: fold(entry.page), title: fold(entry.title), text: fold(entry.text) } }));
        runSearch();
      })
      .catch(() => {
        loading = null;
        status.textContent = status.dataset.failed;
      });
  }
  return loading;
}

function openSearch() {
  if (!search) return;
  open(search, input);
  input.select();
  if (!index) loadIndex();
}

function escape(text) {
  return text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** The text around the first match, the matches marked. */
function excerpt(entry, terms) {
  const folded = entry.f.text;
  let at = -1;
  for (const term of terms) {
    const i = folded.indexOf(term);
    if (i >= 0 && (at < 0 || i < at)) at = i;
  }
  const start = Math.max(0, at - 50);
  let text = entry.text.slice(start, start + 180);
  if (start > 0) text = `…${text}`;
  if (start + 180 < entry.text.length) text += '…';
  let out = escape(text);
  for (const term of terms) {
    if (term.length < 2 && !/[^\x00-\x7f]/.test(term)) continue;
    const pattern = new RegExp(escape(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(pattern, (m) => `<mark>${m}</mark>`);
  }
  return out;
}

function runSearch() {
  if (!index) return;
  const query = fold(input.value.trim());
  results.innerHTML = '';
  selected = -1;
  if (!query) {
    status.textContent = '';
    return;
  }
  const terms = query.split(/\s+/).filter(Boolean);
  const hits = [];
  for (const entry of index) {
    let score = 0;
    let all = true;
    for (const term of terms) {
      const inTitle = entry.f.title.includes(term);
      const inPage = entry.f.page.includes(term);
      const inText = entry.f.text.includes(term);
      if (!inTitle && !inPage && !inText) {
        all = false;
        break;
      }
      score += (inTitle ? 12 : 0) + (inPage ? 5 : 0) + (inText ? 1 : 0);
      if (entry.f.title.startsWith(term)) score += 4;
    }
    if (all) hits.push({ entry, score: score - entry.depth * 0.5 });
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 24);
  status.textContent = top.length ? '' : status.dataset.empty;
  results.innerHTML = top
    .map(
      ({ entry }, i) =>
        `<li role="option" id="search-hit-${i}" aria-selected="false"><a href="${escape(siteUrl(entry.url))}"><span class="search-hit-page">${escape(entry.page)}</span><span class="search-hit-title">${escape(entry.title)}</span>${entry.text ? `<span class="search-hit-text">${excerpt(entry, terms)}</span>` : ''}</a></li>`,
    )
    .join('');
  if (top.length) select(0);
}

function select(i) {
  const items = results.querySelectorAll('[role="option"]');
  if (!items.length) return;
  selected = (i + items.length) % items.length;
  items.forEach((item, k) => item.setAttribute('aria-selected', String(k === selected)));
  input.setAttribute('aria-activedescendant', items[selected].id);
  items[selected].scrollIntoView({ block: 'nearest' });
}

input?.addEventListener('input', runSearch);
input?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    select(selected + 1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    select(selected - 1);
  } else if (event.key === 'Enter') {
    const link = results.querySelectorAll('[role="option"] a')[selected];
    if (link) {
      event.preventDefault();
      close();
      link.click();
    }
  }
});
results?.addEventListener('click', (event) => {
  if (event.target.closest('a')) close();
});

// Copy buttons -------------------------------------------------------------------------------------------------------

document.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy');
  if (!button) return;
  const code = button.closest('.code')?.querySelector('pre code');
  if (!code) return;
  const text = code.textContent.replace(/\n+$/, '');
  const done = () => {
    const label = button.textContent;
    button.textContent = button.dataset.copied;
    button.classList.add('is-copied');
    setTimeout(() => {
      button.textContent = label;
      button.classList.remove('is-copied');
    }, 1600);
  };
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    // no clipboard access: select the code so that it can be copied by hand
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
});

// Tabbed code ----------------------------------------------------------------------------------------------------------

function showTab(group, tab, remember) {
  const tabs = [...group.querySelectorAll('[role="tab"]')];
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    const panel = document.getElementById(t.getAttribute('aria-controls'));
    if (panel) panel.hidden = !on;
  }
  if (remember && group.dataset.key) store(`ksana-tab-${group.dataset.key}`, tab.textContent);
}

for (const group of document.querySelectorAll('.code-group')) {
  const tabs = [...group.querySelectorAll('[role="tab"]')];
  const saved = group.dataset.key ? store(`ksana-tab-${group.dataset.key}`) : null;
  const match = saved && tabs.find((t) => t.textContent === saved);
  if (match) showTab(group, match, false);
  group.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    if (!tab) return;
    showTab(group, tab, true);
    // other groups with the same key follow
    for (const other of document.querySelectorAll(`.code-group[data-key="${group.dataset.key}"]`)) {
      if (other === group) continue;
      const same = [...other.querySelectorAll('[role="tab"]')].find((t) => t.textContent === tab.textContent);
      if (same) showTab(other, same, false);
    }
  });
  group.querySelector('[role="tablist"]')?.addEventListener('keydown', (event) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (event.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    if (event.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    if (event.key === 'Home') next = tabs[0];
    if (event.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      event.preventDefault();
      next.focus();
      showTab(group, next, true);
    }
  });
}

// The docs: the section in view is marked in the contents --------------------------------------------------------------

const toc = document.querySelector('.toc');
if (toc) {
  const links = new Map([...toc.querySelectorAll('a[href^="#"]')].map((a) => [decodeURIComponent(a.getAttribute('href').slice(1)), a]));
  const headings = [...document.querySelectorAll('.prose h2[id], .prose h3[id]')].filter((h) => links.has(h.id));
  let current = null;
  let queued = false;
  const update = () => {
    queued = false;
    const line = 120;
    let active = headings[0];
    for (const h of headings) {
      if (h.getBoundingClientRect().top - line <= 0) active = h;
      else break;
    }
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) active = headings[headings.length - 1];
    const link = active && links.get(active.id);
    if (link === current) return;
    current?.classList.remove('is-current');
    link?.classList.add('is-current');
    current = link;
  };
  addEventListener(
    'scroll',
    () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

// The contents on narrow screens close once a section is picked.
document.addEventListener('click', (event) => {
  const link = event.target.closest('.toc-inline a');
  if (link) link.closest('details').open = false;
});
