// The landing page (D-125): the dial's ticks, the six acts that the scroll plays, the operation the story follows, the
// top bar taking the color of the field under it, and the signet's live readings. Without it, or with reduced motion,
// the page shows the same drawings in their final state, one section after another.

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
// the same query as the pinned layout of 07-landing.css: where it does not hold, the acts are ordinary sections
const playing = matchMedia('(prefers-reduced-motion: no-preference) and (scripting: enabled)');

// The dial ---------------------------------------------------------------------------------------------------------------
// 120 ticks are one Bitcoin block of ten minutes at one fast-lane block per five seconds. The ticks start where this
// ten-minute round of the clock stands and then fall at the pace of blocks: on average every five seconds, at random
// like proof of work. A full round turns the ticks to ink, the seal stamps, and the round starts over.

const dial = document.querySelector('.dial');
if (dial) {
  const ticks = [...dial.querySelectorAll('.tick')];
  const hand = dial.querySelector('.dial-hand');
  const seal = dial.querySelector('.dial-seal');
  const n = ticks.length;
  let pos = Math.floor(((Date.now() / 1000) % 600) / 5) % n;
  let steps = pos;
  const turn = () => {
    hand.style.transform = `rotate(${steps * 3}deg)`;
  };

  if (reduceMotion) {
    for (let i = 0; i < pos; i++) ticks[i].classList.add('is-on');
    turn();
  } else {
    // light the ticks up to where the round stands, after the stroke has drawn itself
    hand.style.transition = 'none';
    turn();
    hand.getBoundingClientRect();
    hand.style.transition = '';
    let i = 0;
    const sweep = () => {
      if (i >= pos) {
        schedule();
        return;
      }
      ticks[i].classList.add('is-on');
      i++;
      setTimeout(sweep, 14);
    };
    setTimeout(sweep, 2300);
  }

  function block() {
    if (pos >= n) {
      for (const tick of ticks) tick.classList.add('is-sealed');
      seal.classList.remove('is-stamped');
      seal.getBoundingClientRect();
      seal.classList.add('is-stamped');
      setTimeout(() => {
        for (const tick of ticks) tick.classList.remove('is-on', 'is-sealed');
        pos = 0;
      }, 1200);
      return 2200;
    }
    const tick = ticks[pos];
    tick.classList.add('is-on', 'is-new');
    setTimeout(() => tick.classList.remove('is-new'), 450);
    pos++;
    steps++;
    turn();
    return 0;
  }

  function schedule() {
    // exponential waiting time with a mean of 5 s, kept between 0.4 s and 20 s
    const wait = Math.min(20000, Math.max(400, -Math.log(1 - Math.random()) * 5000));
    setTimeout(() => {
      const extra = document.hidden ? 0 : block();
      setTimeout(schedule, extra);
    }, wait);
  }
}

// The acts ---------------------------------------------------------------------------------------------------------------
// An act's progress runs from 0, when its stage pins, to 1, when the stage lets go. Every moving part of a drawing says
// in its data attributes what it does between which points of that progress (lib/scenes.mjs); the drawing is written in
// its final state, and this takes it back to where the scroll stands. The progress shown follows the scroll with a short
// lag, so that a wheel's steps play as motion.

const clamp = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const span = (p, [a, b]) => clamp((p - a) / (b - a || 1e-6));
const easeOut = (x) => 1 - (1 - x) ** 3;
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const overshoot = (x) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
const round = (x, k = 1000) => Math.round(x * k) / k;
const numbers = (text) => text.split(' ').map(Number);

/** One moving part of a drawing, read from its data attributes. */
function part(el) {
  const d = el.dataset;
  const it = { el, style: el.getAttribute('style'), cls: el.getAttribute('class'), rx: el.getAttribute('rx'), shown: {} };
  if (d.in) it.in = numbers(d.in);
  if (d.fade) it.fade = numbers(d.fade);
  if (d.out) {
    const [a, b, o = 0] = numbers(d.out);
    it.out = [a, b];
    it.outTo = o;
  }
  if (d.draw) it.draw = numbers(d.draw);
  if (d.move) {
    const frames = d.move.split(' ').map((frame) => {
      const [p, xy] = frame.split(':');
      return [Number(p), ...xy.split(',').map(Number)];
    });
    const [, x1, y1] = frames[frames.length - 1];
    it.move = frames.map(([p, x, y]) => [p, x - x1, y - y1]);
  }
  if (d.rx) {
    const [a, b, from] = numbers(d.rx);
    it.round = [a, b];
    it.rxFrom = from;
    it.rxTo = Number(it.rx);
  }
  if (d.scale) {
    const [a, b, s] = numbers(d.scale);
    it.scale = [a, b];
    it.scaleFrom = s;
  }
  if (d.on) it.on = Number(d.on);
  return it;
}

/** Where a moving part stands at progress p, as an offset from its drawn place. */
function offset(frames, p) {
  if (p <= frames[0][0]) return frames[0].slice(1);
  for (let k = 1; k < frames.length; k++) {
    const [b, bx, by] = frames[k];
    if (p >= b) continue;
    const [a, ax, ay] = frames[k - 1];
    const t = easeInOut((p - a) / (b - a || 1e-6));
    return [ax + (bx - ax) * t, ay + (by - ay) * t];
  }
  return [0, 0];
}

function play(it, p) {
  const { el, shown } = it;
  let opacity = 1;
  let scale = 1;
  let dx = 0;
  let dy = 0;
  if (it.in) {
    const t = span(p, it.in);
    opacity *= Math.min(1, t * 2);
    scale *= 0.3 + 0.7 * overshoot(t);
  }
  if (it.fade) opacity *= easeOut(span(p, it.fade));
  if (it.out) opacity *= 1 - (1 - it.outTo) * easeOut(span(p, it.out));
  if (it.scale) {
    // a stamp gathers speed on its way down
    const t = span(p, it.scale);
    scale *= it.scaleFrom + (1 - it.scaleFrom) * t * t;
  }
  if (it.move) [dx, dy] = offset(it.move, p);
  if (it.draw) {
    const t = span(p, it.draw);
    if (t <= 0) opacity = 0;
    if (!shown.drawing) el.style.strokeDasharray = shown.drawing = '1 1';
    const dash = String(round(1 - easeInOut(t), 10000));
    if (dash !== shown.dash) el.style.strokeDashoffset = shown.dash = dash;
  }
  if (it.round) {
    const rx = String(round(it.rxFrom + (it.rxTo - it.rxFrom) * easeInOut(span(p, it.round)), 100));
    if (rx !== shown.rx) el.setAttribute('rx', (shown.rx = rx));
  }
  if (it.on !== undefined) {
    const on = p >= it.on;
    if (on !== shown.on) el.classList.toggle('is-on', (shown.on = on));
  }
  const o = opacity >= 0.999 ? '' : String(round(Math.max(0, opacity)));
  if (o !== shown.o) el.style.opacity = shown.o = o;
  const tr = dx || dy || scale !== 1 ? `translate(${round(dx, 100)}px, ${round(dy, 100)}px) scale(${round(scale)})` : '';
  if (tr !== shown.tr) el.style.transform = shown.tr = tr;
}

/** Put a part back as it was written: the final state. */
function unplay(it) {
  const { el } = it;
  if (it.style === null) el.removeAttribute('style');
  else el.setAttribute('style', it.style);
  if (it.cls !== null) el.setAttribute('class', it.cls);
  if (it.rx !== null) el.setAttribute('rx', it.rx);
  it.shown = {};
}

// What some acts show besides their drawing: the clock's time and count, and the seal's confirmations.
const readouts = {
  clock(section) {
    const cells = [...section.querySelectorAll('.cell')].map((el) => Number(el.dataset.on));
    const time = section.querySelector('[data-k="clock"]');
    const count = section.querySelector('[data-k="count"]');
    const [from, to] = [cells[0], cells[cells.length - 1]];
    return (p) => {
      // the ten minutes of one Bitcoin block, and how many five-second blocks have been found in them
      const s = Math.round(clamp((p - from) / (to - from)) * 600);
      time.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      count.textContent = count.dataset.template.replace('{n}', cells.filter((at) => p >= at).length);
    };
  },
  seal(section) {
    const blocks = [...section.querySelectorAll('.btc[data-in]')].map((el) => numbers(el.dataset.in)[0]);
    const count = section.querySelector('[data-k="count"]');
    const label = section.querySelector('[data-k="count-label"]');
    return (p) => {
      const n = 1 + blocks.filter((at) => p >= at).length;
      count.textContent = n;
      label.textContent = n === 1 ? label.dataset.one : label.dataset.many;
    };
  },
};

class Act {
  constructor(section) {
    this.section = section;
    this.stage = section.querySelector('.act-stage');
    this.parts = [...section.querySelectorAll('.scene [data-in], .scene [data-fade], .scene [data-out], .scene [data-draw], .scene [data-move], .scene [data-rx], .scene [data-scale], .scene [data-on]')].map(part);
    this.beatAt = numbers(section.dataset.beats);
    this.beats = [...section.querySelectorAll('.beat')];
    this.dots = [...section.querySelectorAll('.beat-dots i')];
    this.story = section.dataset.storyAt
      ? section.dataset.storyAt.split(' ').map((frame) => {
          const [p, t, mark] = frame.split(':');
          return { p: Number(p), t: Number(t), mark };
        })
      : null;
    this.texts = [...section.querySelectorAll('[data-k]')].map((el) => [el, el.textContent]);
    this.readout = readouts[section.dataset.scene]?.(section);
    this.flood = section.querySelector('.flood');
    if (this.flood) {
      this.floodAt = numbers(this.flood.dataset.flood);
      this.floodFrom = section.querySelector('.btc--data');
    }
    this.target = 0;
    this.shown = 0;
    this.played = null;
  }

  measure(vh) {
    const r = this.section.getBoundingClientRect();
    const run = r.height - this.stage.offsetHeight;
    this.top = r.top;
    this.bottom = r.bottom;
    this.target = run > 0 ? clamp(-r.top / run) : r.top < 0 ? 1 : 0;
    this.near = r.bottom > -0.5 * vh && r.top < 1.5 * vh;
    if (this.flood && this.near) {
      // the vermilion spreads from the block the seal stamps, to the stage's farthest corner
      const s = this.stage.getBoundingClientRect();
      const b = this.floodFrom.getBoundingClientRect();
      const x = b.left + b.width / 2 - s.left;
      const y = b.top + b.height / 2 - s.top;
      this.floodCentre = [x, y, Math.hypot(Math.max(x, s.width - x), Math.max(y, s.height - y))];
    }
  }

  play(p) {
    if (p === this.played) return;
    this.played = p;
    for (const it of this.parts) play(it, p);
    let beat = 0;
    this.beatAt.forEach((at, k) => {
      if (p >= at) beat = k;
    });
    if (beat !== this.beat) {
      this.beat = beat;
      this.beats.forEach((el, k) => el.classList.toggle('is-on', k === beat));
      this.dots.forEach((el, k) => el.classList.toggle('is-on', k === beat));
    }
    this.readout?.(p);
    if (this.flood && this.floodCentre) {
      const t = span(p, this.floodAt);
      const [x, y, far] = this.floodCentre;
      this.flood.style.clipPath = `circle(${round(easeInOut(t) * far, 10)}px at ${round(x, 10)}px ${round(y, 10)}px)`;
      this.flood.style.setProperty('--fx', `${round(x, 10)}px`);
      this.flood.style.setProperty('--fy', `${round(y, 10)}px`);
      this.section.classList.toggle('is-flooded', t > 0.12);
      this.section.classList.toggle('is-sealed', t >= 1);
      this.zhu = t > 0.5;
    }
  }

  /** The operation's age and mark at progress p, or null before it is signed. */
  storyAt(p) {
    const frames = this.story;
    if (!frames || p < frames[0].p) return null;
    let k = 0;
    while (k + 1 < frames.length && p >= frames[k + 1].p) k++;
    const a = frames[k];
    const b = frames[k + 1];
    const t = b ? a.t + ((b.t - a.t) * (p - a.p)) / (b.p - a.p) : a.t;
    return { t, mark: a.mark };
  }

  reset() {
    for (const it of this.parts) unplay(it);
    for (const [el, text] of this.texts) el.textContent = text;
    for (const el of this.beats) el.classList.remove('is-on');
    this.beats[0]?.classList.add('is-on');
    this.section.classList.remove('is-flooded', 'is-sealed');
    if (this.flood) this.flood.removeAttribute('style');
    this.beat = undefined;
    this.played = null;
    this.zhu = false;
  }
}

// The operation the story follows: its mark and its age while the acts that carry it play.
const story = document.querySelector('[data-story]');
const storyState = story?.querySelector('[data-k="state"]');
const storyTime = story?.querySelector('[data-k="time"]');
let storyShown = '';

function age(seconds) {
  const d = story.dataset;
  if (seconds < 10) return d.s.replace('{n}', (Math.floor(seconds * 10) / 10).toFixed(1));
  if (seconds < 60) return d.s.replace('{n}', Math.floor(seconds));
  if (seconds < 3600) return d.min.replace('{n}', Math.floor(seconds / 60));
  return d.h.replace('{h}', Math.floor(seconds / 3600)).replace('{m}', Math.floor((seconds % 3600) / 60));
}

function tellStory(at) {
  if (!story) return;
  const key = at ? `${at.mark}|${age(at.t)}` : '';
  if (key === storyShown) return;
  storyShown = key;
  story.classList.toggle('is-shown', Boolean(at));
  if (!at) return;
  story.dataset.state = at.mark;
  storyState.textContent = story.dataset[at.mark];
  storyTime.textContent = age(at.t);
}

// The top bar takes the tone of the section under it, and the vermilion once the seal's act has flooded.
const page = document.getElementById('page') || document.body;
const topbar = document.querySelector('.topbar');
const sections = [...document.querySelectorAll('.landing > [data-tone]')];

function sectionUnderTopbar() {
  const y = topbar ? topbar.getBoundingClientRect().bottom : 0;
  return sections.find((section) => {
    const r = section.getBoundingClientRect();
    return r.top <= y && r.bottom > y;
  });
}

const acts = [...document.querySelectorAll('.act[data-scene]')].map((section) => new Act(section));
let frame = 0;
let then = 0;

function tick(now) {
  frame = 0;
  const vh = innerHeight;
  const dt = then ? Math.min(64, now - then) : 16;
  then = now;
  const on = playing.matches;
  let moving = false;
  // every reading of the layout before any change to it
  for (const act of acts) act.measure(vh);
  const under = sectionUnderTopbar();
  for (const act of acts) {
    if (!on) continue;
    if (act.near) {
      const d = act.target - act.shown;
      act.shown = Math.abs(d) < 0.0004 ? act.target : act.shown + d * (1 - Math.exp(-dt / 90));
      if (act.shown !== act.target) moving = true;
    } else act.shown = act.target;
    if (!act.seen && act.top < 0.8 * vh) {
      act.seen = true;
      act.section.classList.add('is-seen');
    }
    act.play(act.shown);
  }
  if (on) {
    const current = acts.find((a) => a.story && a.top <= vh / 2 && a.bottom > vh / 2);
    tellStory(current ? current.storyAt(current.shown) : null);
  }
  const tone = under ? (acts.find((a) => a.section === under)?.zhu ? 'zhu' : under.dataset.tone) : 'paper';
  if (page.dataset.tone !== tone) page.dataset.tone = tone;
  if (moving) frame = requestAnimationFrame(tick);
  else then = 0;
}

function update() {
  if (!frame) frame = requestAnimationFrame(tick);
}

function start() {
  if (story) story.hidden = !playing.matches;
  page.classList.toggle('is-playing', playing.matches);
  if (playing.matches) {
    for (const act of acts) {
      act.measure(innerHeight);
      act.shown = act.target;
    }
  } else {
    for (const act of acts) act.reset();
    tellStory(null);
  }
  update();
}

if (acts.length || sections.length) {
  start();
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  playing.addEventListener('change', start);
}

// The supply curve draws itself when it comes into view, where motion is welcome.
const supply = document.querySelector('.supply-svg .line');
if (supply && playing.matches && 'IntersectionObserver' in window && supply.getBoundingClientRect().top > innerHeight) {
  const length = supply.getTotalLength();
  supply.style.strokeDasharray = `${length} ${length}`;
  supply.style.strokeDashoffset = String(length);
  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      supply.style.transition = 'stroke-dashoffset 1.8s cubic-bezier(0.55, 0.06, 0.25, 1)';
      supply.style.strokeDashoffset = '0';
    },
    { threshold: 0.4 },
  );
  observer.observe(supply);
}

// Live readings from the signet ---------------------------------------------------------------------------------------
// From the seed node's JSON-RPC (it allows any origin). Shown only once an answer arrives; when the node cannot be
// reached the strip stays hidden and the page says nothing about it.

const live = document.querySelector('[data-live]');
if (live && 'fetch' in window) {
  const rpc = live.dataset.rpc;
  const lang = live.dataset.lang || 'en';
  const number = new Intl.NumberFormat(lang);
  const statusLine = document.querySelector('[data-live-status]');
  const field = (key) => live.querySelector(`[data-k="${key}"]`);
  const SIGNET = 1002;
  let blockTime = null;
  let failures = 0;

  async function call(method, params = []) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(rpc, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      if (body.error) throw new Error(body.error.message);
      return body.result;
    } finally {
      clearTimeout(timer);
    }
  }

  function showAge() {
    const ago = field('ago');
    if (blockTime === null) return;
    const s = Math.max(0, Math.round(Date.now() / 1000 - blockTime));
    // An idle chain mines its empty blocks minutes apart (two-speed difficulty): only a fresh block shows its age.
    ago.textContent = s < 60 ? ago.dataset.template.replace('{s}', s) : ago.dataset.tip;
  }

  async function refresh() {
    if (document.hidden) return;
    try {
      const info = await call('ksana_getChainInfo');
      if (info.chain_id !== SIGNET) throw new Error('not the signet');
      const latest = await call('ksana_getBlock', [info.tip.hash]);
      const tip = number.format(Number(info.tip.height));
      field('tip').textContent = tip;
      field('final').textContent = number.format(Number(info.finalized.height));
      field('anchor').textContent = number.format(Number(latest.header.btc_anchor.height));
      blockTime = Number(latest.header.timestamp);
      showAge();
      if (statusLine) statusLine.textContent = statusLine.dataset.template.replace('{height}', tip);
      live.hidden = false;
      failures = 0;
    } catch {
      failures++;
      if (failures >= 3) live.hidden = true;
    }
  }

  refresh();
  setInterval(refresh, 10000);
  setInterval(showAge, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
}
