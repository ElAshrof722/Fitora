const trigger = document.getElementById('stopwatch-trigger');
const overlay = document.getElementById('stopwatch-overlay');
const timeEl = document.getElementById('sw-time');
const lapsEl = document.getElementById('sw-laps');
const btnsEl = document.getElementById('sw-btns');
const closeBtn = document.getElementById('sw-close');

let elapsed = 0, running = false, stopped = false, laps = [];
let intervalId = null, startTs = 0;

function fmt(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const t = Math.floor((ms % 1000) / 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${t}`;
}

function render() {
  timeEl.textContent = fmt(elapsed);
  timeEl.className = 'sw-time' + (running ? ' running' : '') + (stopped ? ' stopped' : '');

  lapsEl.innerHTML = laps.length === 0 ? '' : [...laps].reverse().map((l, i) => {
    const realIdx = laps.length - i;
    const prev = realIdx > 1 ? laps[realIdx - 2] : 0;
    return `<div class="sw-lap-row"><span>Lap ${realIdx}</span><span>${fmt(l - prev)}</span><span>${fmt(l)}</span></div>`;
  }).join('');

  const buttons = [];
  if (!running && !stopped) buttons.push({ id: 'start', label: 'Start', bg: 'var(--green)', color: '#000' });
  if (running) buttons.push({ id: 'pause', label: 'Pause', bg: 'var(--accent)', color: '#000' });
  if (!stopped && elapsed > 0) buttons.push({ id: 'stop', label: 'Stop', bg: 'var(--danger)', color: '#fff' });
  if (running) buttons.push({ id: 'lap', label: 'Lap', bg: 'var(--bg4)', color: 'var(--text)', border: true });
  buttons.push({ id: 'reset', label: 'Reset', bg: 'var(--bg4)', color: 'var(--danger)', border: true });

  btnsEl.innerHTML = buttons.map(b =>
    `<button data-act="${b.id}" style="background:${b.bg};color:${b.color};${b.border ? 'border:1px solid var(--border2);' : 'border:none;'}">${b.label}</button>`
  ).join('');

  trigger.classList.toggle('running', running);
}

function start() {
  if (running || stopped) return;
  startTs = Date.now() - elapsed;
  intervalId = setInterval(() => { elapsed = Date.now() - startTs; render(); }, 100);
  running = true; render();
}
function pause() { clearInterval(intervalId); running = false; render(); }
function stop() { clearInterval(intervalId); running = false; stopped = true; render(); }
function lap() { if (!running) return; laps.push(elapsed); render(); }
function reset() { clearInterval(intervalId); elapsed = 0; running = false; stopped = false; laps = []; render(); }

btnsEl.addEventListener('click', (e) => {
  const act = e.target.dataset.act;
  if (!act) return;
  ({ start, pause, stop, lap, reset })[act]?.();
});

trigger.addEventListener('click', () => { overlay.hidden = false; });
closeBtn.addEventListener('click', () => { overlay.hidden = true; });
overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.hidden = true; });

render();
