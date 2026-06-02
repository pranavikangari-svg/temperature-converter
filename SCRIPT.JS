/**
 * Thermé — Temperature Converter | script.js
 * All conversions, history, stats, dark mode, clipboard, download
 */

'use strict';

/* ══════════════════════════════════════════
   CONSTANTS & STATE
══════════════════════════════════════════ */
const UNITS = {
  C: { label: 'Celsius',    symbol: '°C' },
  F: { label: 'Fahrenheit', symbol: '°F' },
  K: { label: 'Kelvin',     symbol: 'K'  },
};

const MAX_HISTORY = 10;

let history   = [];
let unitCount = { C: 0, F: 0, K: 0 };

/* ══════════════════════════════════════════
   DOM REFS
══════════════════════════════════════════ */
const $  = id => document.getElementById(id);

const tempInput      = $('tempInput');
const unitSelect     = $('unitSelect');
const convertBtn     = $('convertBtn');
const clearBtn       = $('clearBtn');
const copyBtn        = $('copyBtn');
const downloadBtn    = $('downloadBtn');
const themeToggle    = $('themeToggle');
const themeIcon      = $('themeIcon');
const resultsSection = $('resultsSection');
const resultsGrid    = $('resultsGrid');
const errorBanner    = $('errorBanner');
const errorMsg       = $('errorMsg');
const inputError     = $('inputError');
const historyList    = $('historyList');
const historyEmpty   = $('historyEmpty');
const toastPill      = $('toastPill');
const toastMsgEl     = $('toastMsg');

// Stats
const statTotalVal = $('statTotalVal');
const statUnitVal  = $('statUnitVal');
const statTimeVal  = $('statTimeVal');

/* ══════════════════════════════════════════
   CONVERSION LOGIC
══════════════════════════════════════════ */

/**
 * Convert a temperature value from one unit to all three units.
 * @param {number} value
 * @param {string} fromUnit - 'C', 'F', or 'K'
 * @returns {{ C: number, F: number, K: number }}
 */
function convertAll(value, fromUnit) {
  let celsius;

  // Step 1: convert to Celsius
  switch (fromUnit) {
    case 'C': celsius = value; break;
    case 'F': celsius = (value - 32) * 5 / 9; break;
    case 'K': celsius = value - 273.15; break;
    default:  throw new Error('Unknown unit: ' + fromUnit);
  }

  // Step 2: spread to all units
  return {
    C: celsius,
    F: celsius * 9 / 5 + 32,
    K: celsius + 273.15,
  };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/* ══════════════════════════════════════════
   VALIDATION
══════════════════════════════════════════ */

function validateInput(raw) {
  if (raw === '' || raw === null || raw === undefined) {
    return { valid: false, message: 'Please enter a temperature value.' };
  }

  const num = parseFloat(raw);

  if (isNaN(num)) {
    return { valid: false, message: 'Please enter a valid number (e.g. 72, -10, 23.5).' };
  }

  // Physical check: Kelvin cannot be below absolute zero
  const unit = unitSelect.value;
  if (unit === 'K' && num < 0) {
    return { valid: false, message: 'Kelvin cannot be negative (absolute zero is 0 K).' };
  }
  if (unit === 'C' && num < -273.15) {
    return { valid: false, message: 'Temperature below absolute zero (−273.15 °C) is impossible.' };
  }
  if (unit === 'F' && num < -459.67) {
    return { valid: false, message: 'Temperature below absolute zero (−459.67 °F) is impossible.' };
  }

  return { valid: true, value: num };
}

/* ══════════════════════════════════════════
   RENDER RESULTS
══════════════════════════════════════════ */

function renderResults(converted, sourceUnit) {
  resultsGrid.innerHTML = '';

  Object.entries(UNITS).forEach(([key, meta], idx) => {
    const pill = document.createElement('div');
    pill.className = `result-pill${key === sourceUnit ? ' source-unit' : ''}`;
    pill.style.animationDelay = `${idx * 0.08}s`;

    const val = round2(converted[key]);

    pill.innerHTML = `
      <div class="result-unit-label">${meta.label}</div>
      <div class="result-value">${val}<span class="result-symbol">${meta.symbol}</span></div>
      ${key === sourceUnit ? '<div class="result-unit-label" style="margin-top:0.3rem;color:var(--accent);">Input</div>' : ''}
    `;
    resultsGrid.appendChild(pill);
  });

  resultsSection.classList.add('visible');
}

/* ══════════════════════════════════════════
   PERFORM CONVERSION
══════════════════════════════════════════ */

function performConversion(isRealtime = false) {
  const raw  = tempInput.value.trim();
  const unit = unitSelect.value;

  // Clear any previous errors
  hideError();
  inputError.textContent = '';
  tempInput.classList.remove('is-invalid');

  // Validate
  const validation = validateInput(raw);
  if (!validation.valid) {
    if (!isRealtime || raw !== '') {
      showError(validation.message);
      tempInput.classList.add('is-invalid');
    }
    if (isRealtime) {
      resultsSection.classList.remove('visible');
    }
    return;
  }

  const value     = validation.value;
  const converted = convertAll(value, unit);

  renderResults(converted, unit);

  // Save to history only on explicit button click
  if (!isRealtime) {
    saveToHistory(value, unit, converted);
    // Animate convert button
    animateBtn(convertBtn);
  }
}

/* ══════════════════════════════════════════
   HISTORY
══════════════════════════════════════════ */

function saveToHistory(inputVal, inputUnit, converted) {
  const now  = new Date();
  const time = formatTime(now);

  const entry = {
    input:     inputVal,
    unit:      inputUnit,
    converted: converted,
    timestamp: now.toISOString(),
    timeLabel: time,
  };

  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.pop();

  // Update unit counts
  unitCount[inputUnit] = (unitCount[inputUnit] || 0) + 1;

  updateStats(time);
  renderHistory();
  persistHistory();
}

function renderHistory() {
  historyList.innerHTML = '';

  if (history.length === 0) {
    historyEmpty.style.display = 'block';
    return;
  }

  historyEmpty.style.display = 'none';

  history.forEach((entry, idx) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.style.animationDelay = `${idx * 0.04}s`;

    const inputStr   = `${entry.input}${UNITS[entry.unit].symbol}`;
    const resultParts = Object.entries(UNITS)
      .filter(([k]) => k !== entry.unit)
      .map(([k, m]) => `${round2(entry.converted[k])}${m.symbol}`)
      .join('  •  ');

    li.innerHTML = `
      <span class="history-input">${inputStr}</span>
      <span class="history-arrow"><i class="fa-solid fa-arrow-right"></i></span>
      <span class="history-results">${resultParts}</span>
      <span class="history-time">${entry.timeLabel}</span>
    `;
    historyList.appendChild(li);
  });
}

/* ══════════════════════════════════════════
   STATS DASHBOARD
══════════════════════════════════════════ */

function updateStats(lastTime) {
  const total = history.length;
  statTotalVal.textContent = total;

  // Most used unit
  const sorted = Object.entries(unitCount).sort((a, b) => b[1] - a[1]);
  if (sorted[0][1] > 0) {
    const topUnit = sorted[0][0];
    statUnitVal.textContent = UNITS[topUnit].label;
  } else {
    statUnitVal.textContent = '—';
  }

  statTimeVal.textContent = lastTime || '—';
}

/* ══════════════════════════════════════════
   ERROR HELPERS
══════════════════════════════════════════ */

function showError(msg) {
  errorBanner.style.display = 'flex';
  errorMsg.textContent = msg;
  // Re-trigger shake
  errorBanner.style.animation = 'none';
  void errorBanner.offsetHeight; // reflow
  errorBanner.style.animation = 'shake 0.4s both';
}

function hideError() {
  errorBanner.style.display = 'none';
  errorMsg.textContent = '';
}

/* ══════════════════════════════════════════
   CLEAR
══════════════════════════════════════════ */

function clearAll() {
  tempInput.value = '';
  tempInput.classList.remove('is-invalid');
  hideError();
  inputError.textContent = '';
  resultsSection.classList.remove('visible');
  resultsGrid.innerHTML = '';
  tempInput.focus();
}

/* ══════════════════════════════════════════
   COPY RESULTS
══════════════════════════════════════════ */

function copyResults() {
  const raw  = tempInput.value.trim();
  const unit = unitSelect.value;

  if (!raw) {
    showToast('Nothing to copy yet!', false);
    return;
  }

  const validation = validateInput(raw);
  if (!validation.valid) {
    showToast('Fix input errors first.', false);
    return;
  }

  const converted = convertAll(parseFloat(raw), unit);
  const lines = [`Temperature Conversion — ${raw}${UNITS[unit].symbol}`, ''];
  Object.entries(UNITS).forEach(([k, m]) => {
    lines.push(`  ${m.label}: ${round2(converted[k])}${m.symbol}`);
  });
  lines.push('', `Converted at: ${new Date().toLocaleString()}`);

  const text = lines.join('\n');

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text)
      .then(() => showToast('Results copied! ✨'))
      .catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
    showToast('Results copied! ✨');
  } catch {
    showToast('Copy failed. Please copy manually.', false);
  } finally {
    ta.remove();
  }
}

/* ══════════════════════════════════════════
   DOWNLOAD HISTORY
══════════════════════════════════════════ */

function downloadHistory() {
  if (history.length === 0) {
    showToast('No history to download yet!', false);
    return;
  }

  const lines = [
    '╔══════════════════════════════════════╗',
    '║     Thermé — Conversion History      ║',
    '╚══════════════════════════════════════╝',
    `  Generated: ${new Date().toLocaleString()}`,
    `  Total Entries: ${history.length}`,
    '',
  ];

  history.forEach((entry, idx) => {
    lines.push(`── Conversion #${idx + 1} ─── ${entry.timeLabel}`);
    lines.push(`   Input: ${entry.input}${UNITS[entry.unit].symbol}`);
    Object.entries(UNITS).forEach(([k, m]) => {
      const tag = k === entry.unit ? ' ← input' : '';
      lines.push(`   ${m.label.padEnd(12)}: ${round2(entry.converted[k])}${m.symbol}${tag}`);
    });
    lines.push('');
  });

  lines.push('══════════════════════════════════════');
  lines.push('  Most-Used Unit: ' + getMostUsedUnit());
  lines.push('══════════════════════════════════════');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `therme-history-${Date.now()}.txt`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
  showToast('History downloaded! 📄');
}

function getMostUsedUnit() {
  const sorted = Object.entries(unitCount).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] > 0 ? UNITS[sorted[0][0]].label : 'None';
}

/* ══════════════════════════════════════════
   TOAST
══════════════════════════════════════════ */

let toastTimer = null;

function showToast(msg, success = true) {
  toastMsgEl.textContent = msg;
  const icon = toastPill.querySelector('i');
  icon.className = success
    ? 'fa-solid fa-circle-check'
    : 'fa-solid fa-circle-exclamation';
  icon.style.color = success ? '#a7f3d0' : '#fca5a5';

  toastPill.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastPill.classList.remove('show'), 2800);
}

/* ══════════════════════════════════════════
   DARK / LIGHT MODE
══════════════════════════════════════════ */

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  themeIcon.className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  localStorage.setItem('therme-theme', dark ? 'dark' : 'light');
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  applyTheme(!isDark);
}

/* ══════════════════════════════════════════
   PERSISTENCE (localStorage)
══════════════════════════════════════════ */

function persistHistory() {
  try {
    localStorage.setItem('therme-history',   JSON.stringify(history));
    localStorage.setItem('therme-unitCount', JSON.stringify(unitCount));
  } catch (_) { /* quota exceeded or private mode */ }
}

function loadHistory() {
  try {
    const h = localStorage.getItem('therme-history');
    const u = localStorage.getItem('therme-unitCount');
    if (h) history   = JSON.parse(h);
    if (u) unitCount = JSON.parse(u);
  } catch (_) {
    history   = [];
    unitCount = { C: 0, F: 0, K: 0 };
  }

  renderHistory();

  if (history.length > 0) {
    const last = history[0];
    updateStats(last.timeLabel);
  }
}

/* ══════════════════════════════════════════
   UTILS
══════════════════════════════════════════ */

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function animateBtn(btn) {
  btn.style.transform = 'scale(0.94)';
  setTimeout(() => { btn.style.transform = ''; }, 180);
}

/* ══════════════════════════════════════════
   REAL-TIME CONVERSION
══════════════════════════════════════════ */

let realtimeTimer = null;

function onInputChange() {
  clearTimeout(realtimeTimer);
  realtimeTimer = setTimeout(() => performConversion(true), 250);
}

/* ══════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════ */

// Convert button
convertBtn.addEventListener('click', () => performConversion(false));

// Enter key
tempInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') performConversion(false);
});

// Real-time typing
tempInput.addEventListener('input', onInputChange);
unitSelect.addEventListener('change', () => {
  if (tempInput.value.trim() !== '') performConversion(true);
});

// Clear
clearBtn.addEventListener('click', clearAll);

// Copy
copyBtn.addEventListener('click', copyResults);

// Download
downloadBtn.addEventListener('click', downloadHistory);

// Theme toggle
themeToggle.addEventListener('click', toggleTheme);

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */

(function init() {
  // Restore theme
  const savedTheme = localStorage.getItem('therme-theme') || 'light';
  applyTheme(savedTheme === 'dark');

  // Restore history & stats
  loadHistory();

  // Focus input
  setTimeout(() => tempInput.focus(), 400);
})();