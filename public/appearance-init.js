// Runs before body paint; keep values aligned with data/appearance.ts.
try {
  var saved = JSON.parse(localStorage.getItem('nagroom-appearance-v1') || 'null') || { mode: localStorage.getItem('study-room-theme') };
  var root = document.documentElement;
  var mode = saved.mode === 'light' ? 'light' : 'dark';
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  root.dataset.palette = 'cbs';
  root.dataset.textSize = ['compact', 'standard', 'large'].includes(saved.textSize) ? saved.textSize : 'standard';
  root.dataset.fontWeight = ['regular', 'medium', 'bold'].includes(saved.fontWeight) ? saved.fontWeight : 'regular';
} catch { /* Use the default appearance when storage is unavailable. */ }
