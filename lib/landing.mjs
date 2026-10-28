// The landing page (D-125), from the copy of one language (content/<lang>/landing.mjs): a prologue, a story in six acts
// that the scroll plays (the drawings of scenes.mjs, played by src/js/landing.js), then the sections a visitor comes back
// for: the three marks, the reasons, KSA, building, running it, and where the project stands.

import { heroDial, mark, pointIcon, supplyFigure } from './figures.mjs';
import { highlight } from './highlight.mjs';
import { localPath, substitute } from './markdown.mjs';
import { ensoMark, icon, playgroundHref, walletHref } from './render.mjs';
import { SEAL, clockScene, doorScene, laneScene, rebuildScene, sealScene, settleScene } from './scenes.mjs';
import { escapeHtml, relUrl } from './util.mjs';

/**
 * The acts. `tone` is the field the act is painted on; `len` the act's length in screen heights (× 100), the scroll it
 * takes to play; `beats` the progress at which each paragraph of the copy takes over; `story`, for the acts that carry
 * the operation the story follows, its age and mark as `progress:seconds:mark` keyframes (landing.js interpolates the
 * age between them and shows the mark of the last one passed).
 */
const ACTS = [
  { key: 'clock', id: 'ten-minutes', tone: 'paper', len: 250, beats: [0, 0.3, 0.7], scene: clockScene },
  { key: 'lane', id: 'fast-lane', tone: 'qing', len: 300, beats: [0, 0.38, 0.62], scene: laneScene, story: '0.1:0:pending 0.298:4.6:fast 1:40:fast' },
  { key: 'settle', id: 'settlement', tone: 'mo', len: 300, beats: [0, 0.22, 0.6], scene: settleScene, story: '0:40:fast 0.72:600:btc 1:660:btc' },
  { key: 'seal', id: 'finality', tone: 'mo', len: 330, beats: [0, 0.2, 0.86], scene: sealScene, story: sealStory() },
  { key: 'door', id: 'two-ways-in', tone: 'paper', len: 280, beats: [0, 0.32, 0.64], scene: doorScene },
  { key: 'rebuild', id: 'verification', tone: 'night', len: 270, beats: [0, 0.3, 0.8], scene: rebuildScene },
];

/**
 * The seal's act: the operation's age as the Bitcoin blocks after its data's appear, ten minutes apart; its mark turns to
 * six confirmations when the drawing decides the block final, and to the seal when the seal stamps.
 */
function sealStory() {
  const start = 660;
  const frames = [[0, start, 'btc']];
  SEAL.at.forEach((at, k) => frames.push([at, start + (k + 1) * 600, at >= SEAL.decided ? 'deep' : 'btc']));
  const next = frames.findIndex(([at]) => at > SEAL.decided);
  const [a0, t0] = frames[next - 1];
  const [a1, t1] = frames[next];
  frames.splice(next, 0, [SEAL.decided, Math.round(t0 + ((t1 - t0) * (SEAL.decided - a0)) / (a1 - a0)), 'deep']);
  frames.push([SEAL.stamp[0], start + SEAL.at.length * 600, 'final']);
  return frames.map(([at, t, m]) => `${at}:${t}:${m}`).join(' ');
}

const pad = (n) => String(n).padStart(2, '0');

/** Site paths in the copy (href="/…") made relative to the page, in the page's language. */
function linkify(page, html) {
  return html.replace(/href="(\/[^"]*)"/g, (all, path) => {
    const target = localPath(path, page.prefix);
    page.links.push(target);
    return `href="${relUrl(page.path, target, page.preview)}"`;
  });
}

function sectionHead(copy, id, { split = false } = {}) {
  return `<header class="sec-head${split ? ' sec-head--split' : ''}">
  <p class="sec-label"><span>${escapeHtml(copy.label)}</span></p>
  <h2 class="sec-title" id="${id}">${copy.title}</h2>
  ${copy.intro ? `<p class="sec-intro">${copy.intro}</p>` : ''}
</header>`;
}

function more(label, path) {
  return `<a class="more" href="${path}">${escapeHtml(label)}${icon('arrowRight')}</a>`;
}

/** A group of code panels shown as tabs, the same component as a `::: code-group` in the docs. */
function codeTabs(page, items, ui) {
  const id = 'build-code';
  const tabs = items
    .map(
      (item, i) =>
        `<button type="button" role="tab" id="${id}-tab-${i}" aria-controls="${id}-${i}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${escapeHtml(item.title)}</button>`,
    )
    .join('');
  const panels = items
    .map(
      (item, i) =>
        `<div class="code code--grouped" data-lang="${escapeHtml(item.lang)}" role="tabpanel" id="${id}-${i}" aria-labelledby="${id}-tab-${i}"${i ? ' hidden' : ''}><button class="copy" type="button" data-copied="${escapeHtml(ui.copied)}">${escapeHtml(ui.copy)}</button><pre tabindex="0"><code>${highlight(substitute(item.code, page.site, 'landing').replace(/\n$/, ''), item.lang)}</code></pre></div>`,
    )
    .join('');
  return `<div class="code-group" data-key="build"><div class="code-tabs" role="tablist">${tabs}</div>${panels}</div>`;
}

/** A paragraph of an act: text, or a quotation with its source and a line after it. */
function beatHtml(L, beat) {
  if (typeof beat === 'string') return `<p>${L(beat)}</p>`;
  return `<blockquote class="beat-quote"><p>${beat.quote}</p><footer><cite>${beat.cite}</cite></footer></blockquote><p>${L(beat.text)}</p>`;
}

/** The operation the story follows: its age and its mark, shown while the first acts play (landing.js). */
function storyBar(c, ui) {
  const s = c.story;
  const t = ui.figures;
  const marks = ['pending', 'fast', 'btc', 'deep', 'final'].map((k) => `<span class="story-mark story-mark--${k}">${mark(k, k === 'final' ? 20 : 18)}</span>`).join('');
  const states = { pending: s.pending, fast: t.fast, btc: t.onBtc, deep: t.deep, final: t.final };
  return `<div class="story" data-story data-state="pending" hidden aria-hidden="true" data-s="${escapeHtml(s.units.s)}" data-min="${escapeHtml(s.units.min)}" data-h="${escapeHtml(s.units.h)}"${Object.entries(
    states,
  )
    .map(([k, v]) => ` data-${k}="${escapeHtml(v)}"`)
    .join('')}>
  <span class="story-marks">${marks}</span>
  <span class="story-text"><span class="story-label">${escapeHtml(s.label)}</span><span class="story-state" data-k="state">${escapeHtml(s.pending)}</span></span>
  <span class="story-time" data-k="time">0.0 s</span>
</div>`;
}

export function landingMain(page, c) {
  const { ui, site } = page;
  const t = ui.figures;
  const href = (path) => {
    const target = localPath(path, page.prefix);
    page.links.push(target);
    return relUrl(page.path, target, page.preview);
  };
  const L = (html) => linkify(page, html);

  const chapters = ACTS.map(
    (a, i) => `<li class="chap chap--${a.key}"><a href="#${a.id}"><span class="chap-num">${pad(i + 1)}</span><span class="chap-label">${escapeHtml(c.acts[a.key].label)}</span></a></li>`,
  ).join('');
  const hero = `<section class="hero" data-tone="paper" aria-labelledby="hero-title">
<div class="wrap hero-grid">
  <div class="hero-text">
    <p class="hero-status"><span class="pulse" aria-hidden="true"></span><span data-live-status data-template="${escapeHtml(c.hero.statusLive('{height}'))}">${escapeHtml(c.hero.status)}</span></p>
    <h1 class="hero-title" id="hero-title">${c.hero.title}</h1>
    <p class="hero-lede">${L(c.hero.lede)}</p>
    <div class="hero-ctas">
      <a class="btn btn--ink" href="${walletHref(page)}" rel="noopener">${escapeHtml(c.hero.primary)}${icon('arrowRight')}</a>
      <a class="btn btn--line" href="${href('/docs/')}">${escapeHtml(c.hero.secondary)}</a>
    </div>
  </div>
  <div class="hero-art">
    ${heroDial(c.hero.dialLabel)}
    <div class="live" data-live data-rpc="${escapeHtml(site.signet.rpc)}" data-lang="${page.langAttr}" hidden>
      <p class="live-label label"><span class="pulse" aria-hidden="true"></span>${escapeHtml(c.live.label)}</p>
      <dl class="live-grid">
        <div class="live-item"><dt>${mark('fast', 12)}${escapeHtml(c.live.fast)}</dt><dd><span class="live-num" data-k="tip">–</span><span class="live-sub" data-k="ago" data-template="${escapeHtml(c.live.ago('{s}'))}" data-tip="${escapeHtml(c.live.tip)}">${escapeHtml(c.live.tip)}</span></dd></div>
        <div class="live-item"><dt>${mark('final', 13)}${escapeHtml(c.live.final)}</dt><dd><span class="live-num" data-k="final">–</span><span class="live-sub" data-k="final-sub">${escapeHtml(c.live.finalSub)}</span></dd></div>
        <div class="live-item"><dt>${mark('btc', 12)}${escapeHtml(c.live.btc)}</dt><dd><span class="live-num" data-k="anchor">–</span><span class="live-sub">${escapeHtml(c.live.btcSub)}</span></dd></div>
      </dl>
    </div>
  </div>
</div>
<div class="wrap hero-foot">
  <nav class="chapters" aria-label="${escapeHtml(c.hero.chapters)}">
    <p class="chapters-cue"><span class="cue-line" aria-hidden="true"></span>${escapeHtml(c.hero.scroll)}</p>
    <ol>${chapters}</ol>
  </nav>
</div>
</section>`;

  const acts = ACTS.map((a, i) => {
    const copy = c.acts[a.key];
    const beats = copy.beats.map((b, k) => `<div class="beat${k ? '' : ' is-on'}" data-beat="${k}">${beatHtml(L, b)}</div>`).join('');
    const dots = copy.beats.map((b, k) => `<i${k ? '' : ' class="is-on"'}></i>`).join('');
    return `<section class="act act--${a.key}" id="${a.id}" data-scene="${a.key}" data-tone="${a.tone}" data-beats="${a.beats.join(' ')}"${a.story ? ` data-story-at="${a.story}"` : ''} style="--len:${a.len}" aria-labelledby="${a.id}-title">
<div class="act-stage">
  ${a.key === 'seal' ? `<div class="flood" data-flood="${SEAL.flood.join(' ')}" aria-hidden="true"></div>` : ''}
  <header class="act-head">
    <p class="act-label"><span class="act-num">${pad(i + 1)}</span><span class="act-of">/ ${pad(ACTS.length)}</span><span class="act-name">${escapeHtml(copy.label)}</span></p>
    <h2 class="act-title" id="${a.id}-title">${copy.title}</h2>
  </header>
  <div class="act-visual">${a.scene(copy.tags)}</div>
  <div class="beats">${beats}<p class="beat-dots" aria-hidden="true">${dots}</p></div>
</div>
</section>`;
  });

  const marks = `<section class="sec sec--marks" data-tone="paper" aria-labelledby="marks-title">
<div class="wrap">
  ${sectionHead(c.marks, 'marks-title', { split: true })}
  <ol class="stages">${c.marks.stages
    .map(
      (s) => `<li class="stage stage--${s.key}">
      <div class="stage-mark">${mark(s.key, 52)}</div>
      <p class="stage-time">${escapeHtml(s.time)}</p>
      <h3 class="stage-name">${escapeHtml(s.name)}</h3>
      <p class="stage-text">${L(s.text)}</p>
    </li>`,
    )
    .join('')}</ol>
  ${more(c.marks.more, href(c.marks.moreHref))}
</div>
</section>`;

  const reasons = `<section class="sec sec--reasons" data-tone="night" aria-labelledby="reasons-title">
<div class="wrap">
  ${sectionHead(c.reasons, 'reasons-title')}
  <ul class="points">${c.reasons.points
    .map((p, i) => `<li class="point"><span class="point-num">${pad(i + 1)}</span>${pointIcon(p.icon)}<h3>${escapeHtml(p.title)}</h3><p>${L(p.text)}</p></li>`)
    .join('')}</ul>
</div>
</section>`;

  const ksa = `<section class="sec sec--ksa" data-tone="paper" aria-labelledby="ksa-title">
<div class="wrap">
  <div class="ksa">
    <div>
      ${sectionHead(c.ksa, 'ksa-title')}
      <dl class="stats">${c.ksa.stats.map((s) => `<div class="stat"><dt>${escapeHtml(s.value)}</dt><dd>${escapeHtml(s.label)}</dd></div>`).join('')}</dl>
      <p class="ksa-note">${L(c.ksa.note)}</p>
      ${more(c.ksa.more, href(c.ksa.moreHref))}
    </div>
    <figure class="ksa-chart">
      ${supplyFigure(t)}
      <figcaption class="supply-caption">${L(c.ksa.chartCaption)}</figcaption>
    </figure>
  </div>
</div>
</section>`;

  const build = `<section class="sec sec--build" data-tone="paper" aria-labelledby="build-title">
<div class="wrap build">
  <div class="build-side">
    ${sectionHead(c.build, 'build-title')}
    <ul class="build-links">${c.build.links.map((l) => `<li><a href="${href(l.href)}">${escapeHtml(l.label)}${icon('arrowRight')}</a></li>`).join('')}</ul>
    <div class="build-play">
      <p>${L(c.build.playground.text)}</p>
      <a class="btn btn--ink" href="${playgroundHref(page)}" rel="noopener">${escapeHtml(c.build.playground.cta)}${icon('arrowRight')}</a>
    </div>
  </div>
  ${codeTabs(page, c.build.code, ui)}
</div>
</section>`;

  const run = `<section class="sec sec--run" data-tone="paper" aria-labelledby="run-title">
<div class="wrap">
  ${sectionHead(c.run, 'run-title')}
  <div class="run">${c.run.cards
    .map(
      (card, i) => `<article class="run-card">
      <p class="run-num">${pad(i + 1)}</p>
      <h3>${escapeHtml(card.title)}</h3>
      <p>${L(card.text)}</p>
      <a class="run-cta" href="${href(card.href)}">${escapeHtml(card.cta)}${icon('arrowRight')}</a>
    </article>`,
    )
    .join('')}</div>
</div>
</section>`;

  const status = `<section class="sec sec--status" data-tone="paper" aria-labelledby="status-title">
<div class="wrap">
  ${sectionHead(c.status, 'status-title')}
  <ol class="timeline">${c.status.items
    .map(
      (item) => `<li class="tl-item tl-item--${item.state}">
      <span class="tl-dot" aria-hidden="true"></span>
      <p class="tl-state">${escapeHtml(c.status.states[item.state])}</p>
      <h3 class="tl-title">${escapeHtml(item.title)}</h3>
      <p class="tl-text">${L(item.text)}</p>
    </li>`,
    )
    .join('')}</ol>
</div>
</section>`;

  const coda = `<section class="coda" data-tone="night" aria-labelledby="coda-title">
<div class="wrap">
  <span class="coda-mark" aria-hidden="true">${ensoMark(96)}</span>
  <h2 class="coda-title" id="coda-title">${c.coda.title}</h2>
  <div class="hero-ctas">
    <a class="btn btn--paper" href="${walletHref(page)}" rel="noopener">${escapeHtml(c.coda.primary)}${icon('arrowRight')}</a>
    <a class="btn btn--line" href="${href(c.coda.secondaryHref)}">${escapeHtml(c.coda.secondary)}</a>
  </div>
</div>
</section>`;

  return `<div class="grain" aria-hidden="true"></div>
<main id="main" class="landing">
${hero}
${acts.slice(0, 4).join('\n')}
${marks}
${acts.slice(4).join('\n')}
${reasons}
${ksa}
${build}
${run}
${status}
${coda}
${storyBar(c, ui)}
</main>`;
}
