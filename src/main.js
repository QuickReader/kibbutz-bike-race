// Loop, input and screens. Wires sim to render.
import { createSim } from './sim.js';
import { createRenderer } from './render.js';
import { TRACK } from './track.js';

const $ = id => document.getElementById(id);
const sim = createSim(), view = createRenderer($('game'), sim);
let me = sim.riders[0]; // reset() builds new rider objects, so refresh after it
const STEP = 1 / 60, portrait = matchMedia('(orientation: portrait)');
let state = 'menu', acc = 0, last = performance.now(), count = 3, endWait = 0, shownPlace = 1, lastFall = 0;

// input: left/right half of the screen (touch) or arrow keys
let touchDir = 0, keys = { left: false, right: false };
const dir = () => touchDir || (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
function touches(e) {
  e.preventDefault();
  let l = false, r = false;
  for (const t of e.touches) t.clientX < innerWidth / 2 ? (l = true) : (r = true);
  touchDir = (r ? 1 : 0) - (l ? 1 : 0);
}
for (const ev of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) $('game').addEventListener(ev, touches, { passive: false });
addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') keys.left = true;
  else if (e.key === 'ArrowRight') keys.right = true;
  else if (e.key === 'Enter' && state === 'menu') begin();
});
const release = () => { keys.left = keys.right = false; touchDir = 0; };
addEventListener('blur', release);
addEventListener('visibilitychange', release);
addEventListener('keyup', e => { if (e.key === 'ArrowLeft') keys.left = false; if (e.key === 'ArrowRight') keys.right = false; });

function retrigger(el, cls, ms) {
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  if (ms) setTimeout(() => el.classList.remove(cls), ms);
}
const fmt = t => {
  if (t === null) return 'DNF';
  t = Math.round(t * 10) / 10;
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
};

function begin() {
  if (state !== 'menu' && state !== 'results') return;
  try { document.documentElement.requestFullscreen?.().then(() => screen.orientation.lock?.('landscape')).catch(() => {}); } catch {}
  sim.reset(); me = sim.riders[0]; view.restart();
  $('menu').hidden = $('results').hidden = true; $('hud').hidden = false;
  state = 'countdown'; count = 3; shownPlace = 0; lastFall = 0;
}
$('menu').addEventListener('click', begin);
$('again').addEventListener('click', begin);

function showCount(text, go) {
  const c = $('count'); c.textContent = text; c.classList.toggle('go', !!go); retrigger(c, 'pop');
}

function results() {
  while (!sim.over && sim.time < 300) sim.update(STEP, 0); // let the others finish
  state = 'results';
  const order = [...sim.riders].sort((a, b) => a.place - b.place);
  $('title').textContent = me.place === 1 ? 'You won!' : 'Race over!';
  $('title').classList.toggle('win', me.place === 1);
  $('rows').innerHTML = '';
  const colors = ['#FF3D2E', '#2D6CDF', '#8B4FD0', '#12A594'];
  order.forEach((r, i) => {
    const li = document.createElement('li');
    li.className = r === me ? 'me' : '';
    li.style.animationDelay = i * 80 + 'ms';
    const pen = r.penalty ? `<small>+${r.penalty.toFixed(1)}s oops</small> ` : '';
    li.innerHTML = `<span>${i + 1}</span><i style="background:${colors[r.id]}"></i><span>${r.name}</span><span>${pen}${fmt(r.finishTime)}</span>`;
    $('rows').append(li);
  });
  $('hud').hidden = true; $('results').hidden = false;
  $('again').focus({ preventScroll: true });
}

function hud() {
  $('timer').textContent = fmt(sim.time);
  if (me.place !== shownPlace) {
    if (shownPlace) retrigger($('pos'), 'flash', 400);
    shownPlace = me.place; $('pos').firstChild.textContent = me.place;
  }
  sim.riders.forEach((r, i) => $('d' + i).style.left = Math.min(100, r.progress / TRACK.finish * 100) + '%');
  if (me.fall > 0 && lastFall <= 0) { retrigger($('oops'), 'on', 1300); retrigger($('vig'), 'on', 300); }
  lastFall = me.fall;
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (portrait.matches) return;
  if (state === 'countdown') {
    const n = Math.ceil(count);
    count -= dt;
    if (count <= 0) { state = 'race'; showCount('GO!', true); setTimeout(() => state !== 'menu' && ($('count').textContent = ''), 800); }
    else if (Math.ceil(count) !== n || $('count').textContent === '') showCount(Math.ceil(count));
  }
  if (state === 'race' || state === 'finishing') {
    acc += dt;
    while (acc >= STEP) { sim.update(STEP, dir()); acc -= STEP; }
    hud();
    if (me.finishTime !== null && state === 'race') { state = 'finishing'; endWait = 1.5; showCount('Finish!', true); }
    if (state === 'finishing' && (endWait -= dt) <= 0) { $('count').textContent = ''; results(); }
  }
  const d = state === 'race' || state === 'finishing' ? dir() : 0;
  $('tint-l').classList.toggle('on', d < 0); $('tint-r').classList.toggle('on', d > 0);
  view.draw(dt, state === 'menu');
}
requestAnimationFrame(frame);
