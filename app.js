/* ================================================================
   LETTERBOXD MATCH — app.js
   Pure vanilla JS · No dependencies · GitHub Pages ready
   ================================================================ */

'use strict';

// ─── I18N HELPER ─────────────────────────────────────────────────────────────
const t = (key, params = {}) => (window.I18N ? window.I18N.t(key, params) : key);

function syncLangToggle() {
  const toggle = document.getElementById('lang-toggle');
  if (!toggle) return;
  const search = window.location.search;
  const baseHref = toggle.getAttribute('href').split('?')[0];
  toggle.setAttribute('href', baseHref + search);
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

/**
 * CORS proxy chain — tried sequentially until one succeeds.
 * Letterboxd blocks direct browser fetches (no CORS headers); each proxy relays
 * the request server-side and forwards the response with proper CORS headers.
 *
 * We maintain a large list because browsers with aggressive ad/tracker blockers
 * (e.g. Opera GX, Brave) may block some proxy domains. Having many fallbacks
 * ensures at least one will work in any browser.
 *
 * Proxy modes:
 *   json-contents → proxy returns JSON { contents: "<html>…" }
 *   text          → proxy returns raw HTML/text directly
 */
const isLocalDev = ['localhost', '127.0.0.1'].includes(window.location.hostname);

const PROXIES = [
  ...(isLocalDev ? [{ url: 'http://localhost:3000/proxy?url=', mode: 'text', name: 'Localhost (Node)' }] : []),
  { url: 'https://letterboxd-proxy.agustin2-re.workers.dev/?url=', mode: 'text', name: 'Cloudflare Worker' },
  { url: 'https://api.allorigins.win/raw?url=', mode: 'text', name: 'AllOrigins' },
];
// ─── CACHE (localStorage · TTL 30 min · opt-out via forceRefresh) ────────────

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Persistent watchlist cache using localStorage.
 * Entry: { data: Movie[], ts: number }
 * Auto-expires after CACHE_TTL_MS. Gracefully degrades if storage is full.
 */
const letterboxdCache = {
  _key(url) {
    return `lbmatch_v1_${url.trim().toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 120)}`;
  },
  get(url) {
    try {
      const raw = localStorage.getItem(this._key(url));
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS) {
        localStorage.removeItem(this._key(url));
        return null;
      }
      return data;
    } catch { return null; }
  },
  set(url, data) {
    try {
      localStorage.setItem(this._key(url), JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
      console.warn('[Cache] localStorage write failed:', e.message);
    }
  },
  invalidate(url) {
    try { localStorage.removeItem(this._key(url)); } catch { }
  },
  clearAll() {
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('lbmatch_v1_') && k !== HISTORY_KEY)
        .forEach(k => localStorage.removeItem(k));
    } catch { }
  },
};

// ─── PROXY SPEED LOG (in-memory · session only) ───────────────────────────────

/**
 * Records per-proxy response times for this session.
 * Inspect via: console.table(window._proxySpeedLog)
 */
const _proxySpeedLog = {};
window._proxySpeedLog = _proxySpeedLog;

/**
 * Films per page Letterboxd uses:
 * - Watchlist pages: 28 films per page (the default grid)
 * - Custom list pages: up to 100 films per page
 * We use 28 as the conservative threshold; if a page has >= 28 items we try next page.
 */
const FILMS_PER_PAGE_WATCHLIST = 28;
const FILMS_PER_PAGE_LIST = 72;
const MAX_USERS = 5;
const MIN_USERS = 2;

// ─── COMPARISON HISTORY (localStorage · key: lbmatch_v1_history) ──────────────

const HISTORY_KEY = 'lbmatch_v1_history';
const MAX_HISTORY_ITEMS = 10;

const comparisonHistory = {
  getAll() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  saveEntry(mode, rawInputs, labels, commonCount) {
    try {
      const items = this.getAll();
      const newEntry = {
        id: String(Date.now()),
        timestamp: Date.now(),
        mode,
        inputs: rawInputs.filter(Boolean),
        labels,
        commonCount: typeof commonCount === 'number' ? commonCount : 0,
      };

      // Evitar duplicados idénticos consecutivos
      const filtered = items.filter(it => {
        const sameMode = it.mode === newEntry.mode;
        const sameInputs = it.inputs.length === newEntry.inputs.length &&
          it.inputs.every((val, idx) => val.trim().toLowerCase() === newEntry.inputs[idx].trim().toLowerCase());
        return !(sameMode && sameInputs);
      });

      filtered.unshift(newEntry);
      const capped = filtered.slice(0, MAX_HISTORY_ITEMS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(capped));
      renderHistoryUI();
    } catch (e) {
      console.warn('[History] localStorage write failed:', e.message);
    }
  },
  removeEntry(id) {
    try {
      const items = this.getAll().filter(it => it.id !== id);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
      renderHistoryUI();
    } catch { }
  },
  clearAll() {
    try {
      localStorage.removeItem(HISTORY_KEY);
      renderHistoryUI();
    } catch { }
  },
  getLatest() {
    const all = this.getAll();
    return all.length > 0 ? all[0] : null;
  }
};

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function debounce(fn, wait = 350) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

function formatRelativeTime(ts) {
  const now = Date.now();
  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 60) return t('hist.time_just_now');
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return t('hist.time_minutes', { n: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return t('hist.time_hours', { n: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return t('hist.time_days', { n: diffDays });
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

// ─── STATE ──────────────────────────────────────────────────────────────────

const state = {
  sourceMode: 'watchlist', // 'watchlist' | 'list'
  userCount: 2,
  lastResults: null,
  sortCommonAsc: true,
  forceRefresh: false,     // true → bypass cache (set via "Forzar actualización" checkbox)
  userResults: {},         // memoria de fetches exitosos: { [url]: { label, url, movies } }
  currentSearchId: 0,      // token de generación para búsquedas (evita AbortController)
  activeFetches: {},       // token activo por fila: { [rowIndex]: fetchId }
  lastSuccessfulProxy: null,
  selectedProviders: new Set(), // Set de provider_id seleccionados para filtrar
  commonProvidersMap: {},       // { [movieId]: { tmdbId, providers: [{ provider_id, provider_name, logo_path }] } }
};

/** State for the Top 5 Eliminator mode */
const top5State = {
  pool: [],          // full pool of movies to pick from
  current: [],       // current batch of ≤5 movies (enriched)
  remaining: 0,      // how many cards are left on screen
  confettiAnim: null // requestAnimationFrame id for confetti
};

// ─── DOM REFS ───────────────────────────────────────────────────────────────

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

const usersContainer = $('#users-container');
const btnAddUser = $('#btn-add-user');
const btnCompare = $('#btn-compare');
const btnClearInputs = $('#btn-clear-inputs');
const btnToggleHistory = $('#btn-toggle-history');
const historyPanel = $('#history-panel');
const historyList = $('#history-list');
const historyBadge = $('#history-badge');
const btnCloseHistory = $('#btn-close-history');
const btnClearHistory = $('#btn-clear-history');
const errorBanner = $('#error-banner');
const loadingSection = $('#loading-section');
const loadingMessage = $('#loading-message');
const proxyLiveBanner = $('#proxy-live-banner');
const proxyLiveText = $('#proxy-live-text');
const proxyHealthIndicator = $('#proxy-health-indicator');
const proxyHealthDot = $('#proxy-health-dot');
const proxyHealthLabel = $('#proxy-health-label');
const resultsSection = $('#results-section');
const statsBar = $('#stats-bar');
const streamingFilterBar = $('#streaming-filter-bar');
const streamingFilterLabel = $('#streaming-filter-label');
const streamingProgress = $('#streaming-progress');
const streamingProgressText = $('#streaming-progress-text');
const streamingChipsContainer = $('#streaming-chips');
const commonGrid = $('#common-grid');
const commonCount = $('#common-count');
const commonEmpty = $('#common-empty');
const commonEmptyTitle = $('#common-empty-title');
const commonEmptyDesc = $('#common-empty-desc');
const uniqueTabs = $('#unique-tabs');
const uniquePanels = $('#unique-panels');
const movieModal = $('#movie-modal');
const modalContent = $('#modal-content');
const modalCloseBtn = $('#modal-close-btn');
const btnSortCommon = $('#btn-sort-common');
const btnExportCsv = $('#btn-export-csv');
const btnShareResults = $('#btn-share-results');
const shareBtnText = $('#share-btn-text');

// ── Top 5 Eliminator DOM refs (resolved lazily so they exist after HTML parse) ──
const top5Overlay = () => $('#top5-overlay');
const top5Setup = () => $('#top5-setup');
const top5SetupTitle = () => $('#top5-setup-title');
const top5SetupDesc = () => $('#top5-setup-desc');
const top5OptAllLabel = () => $('#top5-opt-all-label');
const top5OptAllSub = () => $('#top5-opt-all-sub');
const top5OptStreamWrap = () => $('#top5-opt-stream-wrap');
const top5OptStreamLabel = () => $('#top5-opt-stream-label');
const top5OptStreamSub = () => $('#top5-opt-stream-sub');
const top5SetupChips = () => $('#top5-setup-chips');
const top5ChipsContainer = () => $('#top5-chips-container');
const btnTop5Start = () => $('#btn-top5-start');
const top5Grid = () => $('#top5-grid');
const top5Loading = () => $('#top5-loading');
const top5LoadingMsg = () => $('#top5-loading-msg');
const top5Counter = () => $('#top5-counter');
const top5Remaining = () => $('#top5-remaining');
const top5WinnerBanner = () => $('#top5-winner-banner');
const top5ConfettiCvs = () => $('#top5-confetti');
const winnerMovieName = () => $('#winner-movie-name');
const winnerLbLink = () => $('#winner-lb-link');

// ─── VALIDATION HELPERS ───────────────────────────────────────────────────────

function isValidUsername(name) {
  return /^@?[a-zA-Z0-9._-]{1,60}$/.test(name.trim());
}

function isValidLetterboxdListUrl(url) {
  try {
    const full = url.startsWith('http') ? url : `https://${url}`;
    const u = new URL(full);
    const host = u.hostname.replace(/^www\./, '');
    return host === 'letterboxd.com' && u.pathname.includes('/list/');
  } catch { return false; }
}

function isValidLetterboxdUrl(url) {
  try {
    const full = url.startsWith('http') ? url : `https://${url}`;
    const host = u.hostname.replace(/^www\./, '');
    return host === 'letterboxd.com' && u.pathname.length > 1;
  } catch { return false; }
}

/**
 * Validates a single input value in real-time.
 * Returns: { valid: boolean, empty: boolean, message: string }
 */
function validateInputValue(rawVal, mode) {
  const val = (rawVal || '').trim();
  if (!val) {
    return { valid: false, empty: true, message: '' };
  }

  if (mode === 'list') {
    // Mode "Lista Específica": requires list URL
    if (val.startsWith('@') || (!val.includes('/') && isValidUsername(val))) {
      return {
        valid: false,
        empty: false,
        message: t('val.invalid_url')
      };
    }
    if (val.includes('letterboxd.com') && !val.includes('/list/')) {
      return {
        valid: false,
        empty: false,
        message: t('val.invalid_url')
      };
    }
    if (isValidLetterboxdListUrl(val)) {
      return { valid: true, empty: false, message: '' };
    }
    return {
      valid: false,
      empty: false,
      message: t('val.invalid_url')
    };
  }

  // Mode "Watchlist":
  // 1) Username (@username or username alone)
  if (!val.includes('/') || (val.startsWith('@') && !val.includes('/'))) {
    const clean = val.replace(/^@/, '').trim();
    if (isValidUsername(clean)) {
      return { valid: true, empty: false, message: '' };
    }
    return {
      valid: false,
      empty: false,
      message: t('val.invalid_user')
    };
  }

  // 2) URL format
  try {
    const full = val.startsWith('http') ? val : `https://${val}`;
    const u = new URL(full);
    const host = u.hostname.replace(/^www\./, '');
    if (host !== 'letterboxd.com') {
      return { valid: false, empty: false, message: t('val.invalid_url') };
    }
    if (u.pathname.includes('/list/')) {
      return {
        valid: false,
        empty: false,
        message: t('val.invalid_url')
      };
    }
    const parts = u.pathname.split('/').filter(Boolean);
    if (parts.length === 0) {
      return { valid: false, empty: false, message: t('val.invalid_user') };
    }
    return { valid: true, empty: false, message: '' };
  } catch {
    return { valid: false, empty: false, message: t('val.invalid_url') };
  }
}

function applyValidationUI(row, result) {
  const inp = row.querySelector('.user-input');
  const icon = row.querySelector('.input-validation-icon');
  const feedback = row.querySelector('.input-feedback-msg');

  if (!inp || !icon || !feedback) return;

  inp.classList.remove('is-valid', 'is-invalid');
  icon.classList.remove('is-valid', 'is-invalid');
  icon.innerHTML = '';
  feedback.textContent = '';
  feedback.classList.add('hidden');

  if (result.empty) {
    inp.dataset.valid = 'false';
    return;
  }

  if (result.valid) {
    inp.dataset.valid = 'true';
    inp.classList.add('is-valid');
    icon.classList.add('is-valid');
    icon.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    `;
  } else {
    inp.dataset.valid = 'false';
    inp.classList.add('is-invalid');
    icon.classList.add('is-invalid');
    icon.innerHTML = `
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    `;
    feedback.textContent = result.message;
    feedback.classList.remove('hidden');
  }
}

function updateCompareButtonState() {
  const rows = $$('.user-row', usersContainer);
  let validCount = 0;
  rows.forEach(row => {
    const inp = row.querySelector('.user-input');
    if (inp && inp.dataset.valid === 'true') {
      validCount++;
    }
  });

  const canCompare = validCount >= MIN_USERS;
  btnCompare.disabled = !canCompare;
  btnCompare.setAttribute('aria-disabled', String(!canCompare));
  if (!canCompare) {
    btnCompare.title = `Ingresá al menos ${MIN_USERS} usuarios o listas válidas para comparar`;
  } else {
    btnCompare.title = 'Comparar Listas';
  }
}

function attachRowValidation(row) {
  const inp = row.querySelector('.user-input');
  if (!inp) return;

  const debouncedValidate = debounce(() => {
    const result = validateInputValue(inp.value, state.sourceMode);
    applyValidationUI(row, result);
    updateCompareButtonState();
  }, 350);

  inp.addEventListener('input', debouncedValidate);
  inp.addEventListener('blur', () => {
    const result = validateInputValue(inp.value, state.sourceMode);
    applyValidationUI(row, result);
    updateCompareButtonState();
  });
}

// ─── HISTORY UI ───────────────────────────────────────────────────────────────

function initHistoryUI() {
  renderHistoryUI();
}

function renderHistoryUI() {
  if (!historyList || !historyBadge) return;
  const items = comparisonHistory.getAll();

  if (items.length === 0) {
    historyBadge.classList.add('hidden');
    historyList.innerHTML = `
      <div class="history-empty">
        <span class="history-empty-icon" aria-hidden="true">📂</span>
        <p>${t('hist.empty')}</p>
      </div>
    `;
    if (btnClearHistory) btnClearHistory.style.display = 'none';
    return;
  }

  historyBadge.textContent = items.length;
  historyBadge.classList.remove('hidden');
  if (btnClearHistory) btnClearHistory.style.display = 'inline-block';

  historyList.innerHTML = items.map(item => {
    const isWatchlist = item.mode === 'watchlist';
    const modeLabel = isWatchlist ? 'Watchlist' : 'List';
    const modeBadgeClass = isWatchlist ? 'badge-mode-watchlist' : 'badge-mode-list';
    const timeStr = formatRelativeTime(item.timestamp);
    const usersStr = item.labels.map(l => `<span class="history-user-chip">${escapeHtml(l)}</span>`).join('');
    const commonStr = `<span class="history-match-chip ${item.commonCount === 0 ? 'is-zero' : ''}">${t('hist.badge_common', { count: item.commonCount })}</span>`;

    return `
      <div class="history-item" data-id="${escapeAttr(item.id)}" role="listitem" tabindex="0" aria-label="${escapeAttr(t('hist.load_aria', { users: item.labels.join(', ') }))}">
        <div class="history-item-content">
          <div class="history-item-meta">
            <span class="history-mode-badge ${modeBadgeClass}">${modeLabel}</span>
            <span class="history-time">${timeStr}</span>
            ${commonStr}
          </div>
          <div class="history-item-users">
            ${usersStr}
          </div>
        </div>
        <button class="btn-remove-history" data-id="${escapeAttr(item.id)}" type="button" aria-label="${escapeAttr(t('hist.remove_aria'))}">
          ✕
        </button>
      </div>
    `;
  }).join('');
}

function toggleHistoryPanel() {
  if (!historyPanel) return;
  const isHidden = historyPanel.classList.contains('hidden');
  if (isHidden) {
    historyPanel.classList.remove('hidden');
    btnToggleHistory?.setAttribute('aria-expanded', 'true');
    renderHistoryUI();
  } else {
    closeHistoryPanel();
  }
}

function closeHistoryPanel() {
  if (!historyPanel) return;
  historyPanel.classList.add('hidden');
  btnToggleHistory?.setAttribute('aria-expanded', 'false');
}

function loadHistoryItem(id) {
  const items = comparisonHistory.getAll();
  const item = items.find(it => it.id === id);
  if (!item) return;

  state.sourceMode = item.mode || 'watchlist';
  const radio = $(`input[name="source"][value="${state.sourceMode}"]`);
  if (radio) radio.checked = true;

  const count = Math.min(MAX_USERS, Math.max(MIN_USERS, item.inputs.length));
  usersContainer.innerHTML = '';
  state.userCount = count;
  for (let i = 0; i < count; i++) {
    addUserRow(i + 1);
    const row = usersContainer.querySelector(`[data-index="${i + 1}"]`);
    const inp = row?.querySelector('.user-input');
    if (inp && item.inputs[i]) {
      inp.value = item.inputs[i];
      const res = validateInputValue(inp.value, state.sourceMode);
      applyValidationUI(row, res);
    }
  }
  updateAddButton();
  updateCompareButtonState();
  closeHistoryPanel();
}

function preloadLastSearch() {
  const latest = comparisonHistory.getLatest();
  if (!latest || !latest.inputs || latest.inputs.length === 0) {
    updateCompareButtonState();
    return;
  }

  state.sourceMode = latest.mode || 'watchlist';
  const radio = $(`input[name="source"][value="${state.sourceMode}"]`);
  if (radio) radio.checked = true;

  const count = Math.min(MAX_USERS, Math.max(MIN_USERS, latest.inputs.length));
  usersContainer.innerHTML = '';
  state.userCount = count;
  for (let i = 0; i < count; i++) {
    addUserRow(i + 1);
    const row = usersContainer.querySelector(`[data-index="${i + 1}"]`);
    const inp = row?.querySelector('.user-input');
    if (inp && latest.inputs[i]) {
      inp.value = latest.inputs[i];
      const res = validateInputValue(inp.value, state.sourceMode);
      applyValidationUI(row, res);
    }
  }
  updateAddButton();
  updateCompareButtonState();
}

function handleClearInputs() {
  buildUserRows(MIN_USERS);
  hideError();
  state.userResults = {};
  clearAllRowStatuses();
  updateCompareButtonState();
  try {
    window.history.replaceState({}, '', window.location.pathname);
  } catch {}
  const firstInp = $(`#user-input-1`);
  if (firstInp) firstInp.focus();
}

// ─── SHARING & CSV EXPORT (Feature 3 & Feature 5) ────────────────────────────

function updateUrlParams(mode, rawInputs) {
  try {
    const url = new URL(window.location.href);
    url.searchParams.set('mode', mode);
    url.searchParams.set('u', rawInputs.filter(Boolean).join(','));
    window.history.replaceState({ mode, inputs: rawInputs }, '', url.toString());
    syncLangToggle();
  } catch (e) {
    console.warn('[URL] Could not update params:', e);
  }
}

function parseUrlParamsOnLoad() {
  try {
    const url = new URL(window.location.href);
    const mode = url.searchParams.get('mode');
    const uParam = url.searchParams.get('u') || url.searchParams.get('users');
    syncLangToggle();
    if (!uParam) return false;

    const userList = uParam.split(',').map(s => s.trim()).filter(Boolean);
    if (userList.length < MIN_USERS) return false;

    if (mode === 'list' || mode === 'watchlist') {
      state.sourceMode = mode;
      const radio = $(`input[name="source"][value="${mode}"]`);
      if (radio) radio.checked = true;
    }

    const count = Math.min(MAX_USERS, Math.max(MIN_USERS, userList.length));
    usersContainer.innerHTML = '';
    state.userCount = count;
    for (let i = 0; i < count; i++) {
      addUserRow(i + 1);
      const row = usersContainer.querySelector(`[data-index="${i + 1}"]`);
      const inp = row?.querySelector('.user-input');
      if (inp && userList[i]) {
        inp.value = userList[i];
        const res = validateInputValue(inp.value, state.sourceMode);
        applyValidationUI(row, res);
      }
    }
    updateAddButton();
    updateCompareButtonState();

    // Auto-ejecutar la comparación si se cargó por URL con inputs válidos
    setTimeout(() => {
      handleCompare();
    }, 350);

    return true;
  } catch (e) {
    console.warn('[URL] Error parsing params:', e);
    return false;
  }
}

async function handleCopyShareLink() {
  const shareBtn = $('#btn-share-results');
  const shareText = $('#share-btn-text');
  if (!shareBtn) return;

  const url = window.location.href;

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(url);
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
    }

    shareBtn.classList.add('is-copied');
    if (shareText) shareText.textContent = t('results.btn_copied');
    setTimeout(() => {
      shareBtn.classList.remove('is-copied');
      if (shareText) shareText.textContent = t('results.btn_copy_link');
    }, 2200);
  } catch (err) {
    console.error('[Share] Copy failed:', err);
    alert(`Link:\n${url}`);
  }
}

function exportCommonMoviesToCsv() {
  if (!state.lastResults || !state.lastResults.common || state.lastResults.common.length === 0) {
    showError(t('results.no_common_title'));
    return;
  }

  const movies = state.lastResults.common;
  const userLabels = state.lastResults.userLabels || [];
  const usersStr = userLabels.join(', ');

  const headers = [
    t('csv.col_title'),
    t('csv.col_year'),
    t('csv.col_found_in'),
    t('csv.col_letterboxd_url')
  ];

  const escapeCsvCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = movies.map(movie => {
    const title = movie.title || '';
    const year = movie.year || '';
    const foundIn = movie.foundIn && movie.foundIn.length > 0 ? movie.foundIn.join(', ') : usersStr;
    const link = movie.link || (movie.id ? `https://letterboxd.com/film/${movie.id}/` : '');
    return [
      escapeCsvCell(title),
      escapeCsvCell(year),
      escapeCsvCell(foundIn),
      escapeCsvCell(link)
    ].join(',');
  });

  // UTF-8 BOM (\uFEFF) para que Excel abra correctamente tildes, ñ y caracteres especiales
  const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(','), ...rows].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;

  const sanitizedUsers = userLabels.map(u => u.replace(/[^a-zA-Z0-9_-]/g, '')).join('_').slice(0, 40) || 'letterboxd';
  const dateStr = new Date().toISOString().slice(0, 10);
  a.download = `letterboxd_match_${sanitizedUsers}_${dateStr}.csv`;

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(downloadUrl);
}

// ─── ROW STATUS HELPERS (RETRY SELECTIVO) ────────────────────────────────────

function setRowStatus(rowIndex, status, message = '', showRetry = false) {
  const row = usersContainer.querySelector(`[data-index="${rowIndex}"]`);
  if (!row) return;
  const statusBar = row.querySelector('.row-status-bar');
  const statusText = row.querySelector('.row-status-text');
  const btnRetry = row.querySelector('.btn-retry-user');

  if (!statusBar || !statusText || !btnRetry) return;

  if (status === 'idle') {
    statusBar.classList.add('hidden');
    statusText.textContent = '';
    btnRetry.classList.add('hidden');
    return;
  }

  statusBar.className = `row-status-bar status-${status}`;
  statusBar.classList.remove('hidden');
  statusText.textContent = message;

  if (showRetry) {
    btnRetry.classList.remove('hidden');
    btnRetry.disabled = false;
  } else {
    btnRetry.classList.add('hidden');
  }
}

function clearAllRowStatuses() {
  const rows = $$('.user-row', usersContainer);
  rows.forEach(row => {
    const statusBar = row.querySelector('.row-status-bar');
    const statusText = row.querySelector('.row-status-text');
    const btnRetry = row.querySelector('.btn-retry-user');
    if (statusBar) statusBar.classList.add('hidden');
    if (statusText) statusText.textContent = '';
    if (btnRetry) btnRetry.classList.add('hidden');
  });
}

// ─── PROXY HEALTH REPORTING ──────────────────────────────────────────────────

function reportProxyStatus({ user = '', name = '', host = '', status = 'attempt', error = '', elapsed = 0 }) {
  const label = name || host;
  const liveBanner = $('#proxy-live-banner');
  const liveText = $('#proxy-live-text');

  if (liveBanner && liveText) {
    if (status === 'attempt') {
      liveBanner.classList.remove('hidden');
      liveText.textContent = user ? t('proxy.connecting_user', { user, label }) : t('proxy.connecting_general', { label });
    } else if (status === 'fallback') {
      liveBanner.classList.remove('hidden');
      liveText.textContent = user ? `⚠️ ${user}: ${label}…` : `⚠️ ${label}…`;
    } else if (status === 'success') {
      liveBanner.classList.remove('hidden');
      liveText.textContent = user ? t('proxy.connected_user', { user, label, elapsed }) : t('proxy.connected_general', { label, elapsed });
    }
  }

  if (status === 'success') {
    updateFooterProxyHealth(label, elapsed);
  }
}

function updateFooterProxyHealth(proxyName, elapsed) {
  const dot = $('#proxy-health-dot');
  const label = $('#proxy-health-label');
  const pill = $('#proxy-health-indicator');
  if (!dot || !label) return;

  dot.className = 'proxy-health-dot dot-green';
  label.textContent = `${t('proxy.active_label', { name: proxyName })}${elapsed ? ` (${elapsed}ms)` : ''}`;
  if (pill) {
    pill.title = `${proxyName} · ${elapsed}ms`;
  }
}

function initProxyHealthUI() {
  const label = $('#proxy-health-label');
  const dot = $('#proxy-health-dot');
  if (!label || !dot) return;

  const defaultProxy = PROXIES[0]?.name || 'Cloudflare Worker';
  dot.className = 'proxy-health-dot dot-green';
  label.textContent = t('proxy.label_ready');
}

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  buildUserRows(MIN_USERS);
  setupEventListeners();
  initHistoryUI();
  initProxyHealthUI();
  const loadedFromUrl = parseUrlParamsOnLoad();
  if (!loadedFromUrl) {
    preloadLastSearch();
  }
}

// ─── USER ROWS ───────────────────────────────────────────────────────────────

function buildUserRows(count) {
  usersContainer.innerHTML = '';
  state.userCount = count;
  for (let i = 0; i < count; i++) addUserRow(i + 1);
  updateAddButton();
}

function addUserRow(index) {
  const row = document.createElement('div');
  row.className = 'user-row';
  row.dataset.index = index;

  const isListMode = state.sourceMode === 'list';
  const placeholder = isListMode
    ? t('val.user_placeholder_list')
    : t('val.user_placeholder_watchlist');

  row.innerHTML = `
    <label for="user-input-${index}" class="visually-hidden">${t('val.user_aria_input', { index })}</label>
    <span class="user-index" aria-hidden="true">${index}</span>
    <div class="user-input-wrap">
      <div class="input-field-inner">
        <input
          type="text"
          class="user-input is-list-url"
          id="user-input-${index}"
          placeholder="${placeholder}"
          autocomplete="off"
          spellcheck="false"
          data-valid="false"
          aria-label="${t('val.user_aria_input', { index })}"
          aria-describedby="feedback-user-${index}"
        />
        <span class="input-validation-icon" aria-hidden="true"></span>
      </div>
      <div class="input-feedback-msg hidden" id="feedback-user-${index}" role="alert"></div>
      <div class="row-status-bar hidden" id="status-bar-${index}">
        <span class="row-status-text" id="status-text-${index}"></span>
        <button type="button" class="btn-retry-user hidden" id="btn-retry-${index}" data-row="${index}" aria-label="${t('val.btn_retry')} ${index}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
            <path d="M21 3v5h-5"/>
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
            <path d="M3 21v-5h5"/>
          </svg>
          ${t('val.btn_retry')}
        </button>
      </div>
    </div>
    <button class="btn-remove" data-row="${index}" aria-label="${t('val.btn_remove', { index })}" ${index <= MIN_USERS ? 'disabled' : ''}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  usersContainer.appendChild(row);
  attachRowValidation(row);
}

function removeUserRow(rowIndex) {
  const rows = $$('.user-row', usersContainer);
  if (rows.length <= MIN_USERS) return;

  const target = usersContainer.querySelector(`[data-index="${rowIndex}"]`);
  if (target) {
    target.style.animation = 'none';
    target.style.opacity = '0';
    target.style.transform = 'translateX(-10px)';
    target.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      target.remove();
      renumberRows();
    }, 200);
  }
  updateAddButton();
}

function renumberRows() {
  const rows = $$('.user-row', usersContainer);
  rows.forEach((row, i) => {
    const n = i + 1;
    row.dataset.index = n;
    const label = row.querySelector('label');
    const idx = row.querySelector('.user-index');
    const inp = row.querySelector('.user-input');
    const feedback = row.querySelector('.input-feedback-msg');
    const statusBar = row.querySelector('.row-status-bar');
    const statusText = row.querySelector('.row-status-text');
    const btnRetry = row.querySelector('.btn-retry-user');
    const btn = row.querySelector('.btn-remove');
    if (label) { label.setAttribute('for', `user-input-${n}`); label.textContent = `Usuario ${n}`; }
    if (idx) { idx.textContent = n; }
    if (feedback) { feedback.id = `feedback-user-${n}`; }
    if (statusBar) { statusBar.id = `status-bar-${n}`; }
    if (statusText) { statusText.id = `status-text-${n}`; }
    if (btnRetry) {
      btnRetry.id = `btn-retry-${n}`;
      btnRetry.dataset.row = n;
      btnRetry.setAttribute('aria-label', `Reintentar usuario ${n}`);
    }
    if (inp) {
      inp.id = `user-input-${n}`;
      inp.setAttribute('aria-label', `${state.sourceMode === 'list' ? 'URL de lista pública' : 'Usuario o URL de watchlist'} para persona ${n}`);
      inp.setAttribute('aria-describedby', `feedback-user-${n}`);
    }
    if (btn) {
      btn.dataset.row = n;
      btn.disabled = n <= MIN_USERS;
      btn.setAttribute('aria-label', `Eliminar usuario ${n}`);
    }
  });
  state.userCount = rows.length;
  updateCompareButtonState();
}

function updateAddButton() {
  const count = $$('.user-row', usersContainer).length;
  btnAddUser.disabled = count >= MAX_USERS;
  btnAddUser.style.opacity = count >= MAX_USERS ? '0.4' : '1';
}

function switchSourceMode(mode) {
  state.sourceMode = mode;
  const inputs = $$('.user-input', usersContainer).map(inp => inp.value);
  const rowCount = Math.max(MIN_USERS, inputs.length);
  usersContainer.innerHTML = '';
  state.userCount = rowCount;
  for (let i = 0; i < rowCount; i++) addUserRow(i + 1);

  // Restore values and re-validate under new mode
  inputs.forEach((v, i) => {
    const row = usersContainer.querySelector(`[data-index="${i + 1}"]`);
    const inp = row?.querySelector('.user-input');
    if (inp && v) {
      inp.value = v;
      const res = validateInputValue(v, state.sourceMode);
      applyValidationUI(row, res);
    }
  });

  updateAddButton();
  updateCompareButtonState();
}

function collectInputValues() {
  return $$('.user-input', usersContainer)
    .map(inp => inp.value.trim())
    .filter(Boolean);
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────

function setupEventListeners() {
  // Source radio buttons
  $$('input[name="source"]').forEach(radio => {
    radio.addEventListener('change', () => {
      state.sourceMode = radio.value;
      switchSourceMode(radio.value);
    });
  });

  // Add user
  btnAddUser.addEventListener('click', () => {
    const count = $$('.user-row', usersContainer).length;
    if (count < MAX_USERS) {
      addUserRow(count + 1);
      state.userCount = count + 1;
      updateAddButton();
      updateCompareButtonState();
      $(`#user-input-${count + 1}`)?.focus();
    }
  });

  // Remove user & retry user (event delegation)
  usersContainer.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.btn-remove');
    if (removeBtn) removeUserRow(Number(removeBtn.dataset.row));

    const retryBtn = e.target.closest('.btn-retry-user');
    if (retryBtn) handleRetryUser(Number(retryBtn.dataset.row));
  });

  // Clear inputs button (Feature 1)
  btnClearInputs?.addEventListener('click', handleClearInputs);

  // History panel toggle & controls (Feature 4)
  btnToggleHistory?.addEventListener('click', toggleHistoryPanel);
  btnCloseHistory?.addEventListener('click', closeHistoryPanel);
  btnClearHistory?.addEventListener('click', () => {
    comparisonHistory.clearAll();
  });

  // History list click delegation (load item or delete item)
  historyList?.addEventListener('click', (e) => {
    const deleteBtn = e.target.closest('.btn-remove-history');
    if (deleteBtn) {
      e.stopPropagation();
      comparisonHistory.removeEntry(deleteBtn.dataset.id);
      return;
    }
    const itemEl = e.target.closest('.history-item');
    if (itemEl) {
      loadHistoryItem(itemEl.dataset.id);
    }
  });

  // History item keyboard navigation (Enter key to load)
  historyList?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const itemEl = e.target.closest('.history-item');
      if (itemEl && !e.target.closest('.btn-remove-history')) {
        loadHistoryItem(itemEl.dataset.id);
      }
    }
  });

  // Close history panel on click outside or Escape
  document.addEventListener('click', (e) => {
    if (historyPanel && !historyPanel.classList.contains('hidden')) {
      if (!historyPanel.contains(e.target) && !btnToggleHistory?.contains(e.target)) {
        closeHistoryPanel();
      }
    }
  });

  // Compare
  btnCompare.addEventListener('click', handleCompare);

  // Enter key on inputs triggers compare
  usersContainer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCompare();
  });

  // Force-refresh checkbox — bypass cache when checked
  const forceRefreshChk = document.getElementById('chk-force-refresh');
  if (forceRefreshChk) {
    forceRefreshChk.addEventListener('change', () => {
      state.forceRefresh = forceRefreshChk.checked;
    });
  }

  // Sort common
  btnSortCommon?.addEventListener('click', () => {
    state.sortCommonAsc = !state.sortCommonAsc;
    if (state.lastResults) renderCommonMovies(state.lastResults.common);
  });

  // Export CSV (Feature 5)
  btnExportCsv?.addEventListener('click', exportCommonMoviesToCsv);

  // Share results URL (Feature 3)
  btnShareResults?.addEventListener('click', handleCopyShareLink);

  // Modal close
  modalCloseBtn.addEventListener('click', closeModal);
  movieModal.addEventListener('click', (e) => {
    if (e.target === movieModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeTop5();
      closeHistoryPanel();
    }
  });

  // Top 5 Eliminator — event delegation on the overlay
  document.addEventListener('click', (e) => {
    // Open Top5 via stats-bar button (dynamically added)
    if (e.target.closest('#btn-open-top5')) {
      openTop5();
      return;
    }
    // Close button
    if (e.target.closest('#btn-top5-close')) { closeTop5(); return; }
    // Restart buttons (header + winner banner)
    if (e.target.closest('#btn-top5-restart') || e.target.closest('#btn-winner-restart')) {
      initTop5(top5State.pool);
      return;
    }
    // Eliminate card
    const elimBtn = e.target.closest('.top5-eliminate-btn');
    if (elimBtn) {
      eliminateTop5Card(elimBtn.dataset.id);
      return;
    }
  });
}

// ─── MAIN FLOW ────────────────────────────────────────────────────────────────

async function handleCompare() {
  hideError();
  const rows = $$('.user-row', usersContainer);
  const inputData = [];

  rows.forEach((row, i) => {
    const idx = i + 1;
    const inp = row.querySelector('.user-input');
    const val = inp?.value.trim() || '';
    if (val) {
      inputData.push({
        rowIndex: idx,
        rawInput: val,
        pageUrl: normalizePageUrl(val),
        label: extractLabel(val),
      });
    }
  });

  if (inputData.length < MIN_USERS) {
    showError(`⚠️ Necesitás ingresar al menos ${MIN_USERS} usuarios o listas de Letterboxd.`);
    return;
  }

  // Validar entradas con la lógica de modos
  const invalidInputs = [];
  inputData.forEach(item => {
    const res = validateInputValue(item.rawInput, state.sourceMode);
    if (!res.valid) invalidInputs.push({ val: item.rawInput, msg: res.message });
  });

  if (invalidInputs.length > 0) {
    showError(
      `⚠️ Entrada(s) inválida(s): ` +
      invalidInputs.map(item => `"${item.val}" (${item.msg})`).join(' · ')
    );
    return;
  }

  showLoading();
  btnCompare.disabled = true;
  state.currentSearchId = Date.now();
  const searchId = state.currentSearchId;

  // Iniciar estado de carga por fila
  inputData.forEach(item => {
    setRowStatus(item.rowIndex, 'loading', t('val.loading_user', { label: item.label }), false);
  });

  try {
    updateLoadingMessage(t('loading.fetching_lists', { count: inputData.length }));

    // If forceRefresh is set, evict cached entries before fetching
    if (state.forceRefresh) {
      inputData.forEach(item => {
        letterboxdCache.invalidate(item.pageUrl);
        delete state.userResults[item.pageUrl];
      });
      console.log('[Cache] Force refresh — invalidated', inputData.length, 'entries');
    }

    // Escalonamos el arranque de cada usuario (400ms entre uno y otro) para no
    // saturar de golpe al proxy cuando hay varios usuarios.
    const results = await Promise.allSettled(inputData.map((item, i) =>
      sleep(i * 400).then(() => {
        if (searchId !== state.currentSearchId) return null;
        return fetchAndParseList(item.pageUrl, item.label, searchId);
      })
    ));

    // Si la búsqueda fue cancelada o superada por una nueva, salir
    if (searchId !== state.currentSearchId) return;

    const successful = [];
    const failed = [];
    const failReasons = [];

    results.forEach((result, i) => {
      const item = inputData[i];
      if (result.status === 'fulfilled' && result.value && result.value.length > 0) {
        successful.push({ label: item.label, url: item.pageUrl, movies: result.value, rowIndex: item.rowIndex });
        state.userResults[item.pageUrl] = { label: item.label, url: item.pageUrl, movies: result.value };
        setRowStatus(item.rowIndex, 'success', t('val.success', { count: result.value.length }), false);
      } else {
        const reason = result.reason?.message || (result.value && result.value.length === 0 ? t('val.error_empty') : t('val.error_fetch'));
        failed.push({ label: item.label, url: item.pageUrl, rowIndex: item.rowIndex, error: reason });
        failReasons.push(`${item.label}: ${reason}`);
        setRowStatus(item.rowIndex, 'error', `❌ ${reason}`, true);
        console.error(`Failed user ${item.label}:`, result.reason || 'No films found');
      }
    });

    if (successful.length >= MIN_USERS) {
      updateLoadingMessage(t('loading.computing'));
      await sleep(250);

      const comparison = computeComparison(successful);
      state.lastResults = { comparison, userLabels: successful.map(s => s.label), common: comparison.common };

      // Guardar en historial (Feature 1 & Feature 4)
      comparisonHistory.saveEntry(
        state.sourceMode,
        inputData.map(d => d.rawInput),
        successful.map(s => s.label),
        comparison.common.length
      );

      renderResults(comparison, successful.map(s => s.label));
      updateUrlParams(state.sourceMode, inputData.map(d => d.rawInput));

      if (failed.length > 0) {
        showError(
          `⚠️ Resultados parciales para: ${successful.map(s => s.label).join(', ')}. ` +
          `No se pudo cargar: ${failed.map(f => f.label).join(', ')}. Podés reintentar en su fila correspondiente.`
        );
      }
    } else {
      if (successful.length === 1) {
        showError(
          `⚠️ Se cargaron los datos de "${successful[0].label}", pero se necesitan al menos ${MIN_USERS} listas para comparar. ` +
          `Reintentá la lista fallida arriba con el botón "Reintentar".`
        );
      } else {
        showError(
          `❌ No se pudieron obtener datos de suficientes listas.\n` +
          `Verificá que las URLs sean correctas, que las listas sean públicas y reintentá individualmente en cada fila.`
        );
      }
    }
  } catch (err) {
    console.error('[handleCompare]', err);
    showError(`❌ ${err.message}`);
  } finally {
    btnCompare.disabled = false;
    updateCompareButtonState();
    hideLoading();
  }
}

// ─── RETRY SELECTIVO POR USUARIO (Feature 2) ──────────────────────────────────

async function handleRetryUser(rowIndex) {
  const row = usersContainer.querySelector(`[data-index="${rowIndex}"]`);
  if (!row) return;

  const inp = row.querySelector('.user-input');
  const val = inp?.value.trim() || '';
  if (!val) return;

  const pageUrl = normalizePageUrl(val);
  const label = extractLabel(val);

  // 1) Requisito clave: el botón "Reintentar" invalida la caché de ESE usuario específicamente
  letterboxdCache.invalidate(pageUrl);
  console.log(`[Cache] 🔄 Invalidadas entradas para retry de "${label}" (${pageUrl})`);

  setRowStatus(rowIndex, 'loading', t('val.retrying_user', { label }), false);

  const fetchId = Date.now();
  state.activeFetches[rowIndex] = fetchId;

  try {
    const movies = await fetchAndParseList(pageUrl, label, null, fetchId);

    // Si hubo otra acción o cancelación en esta fila, salir
    if (state.activeFetches[rowIndex] !== fetchId) return;

    if (!movies || movies.length === 0) {
      throw new Error(t('val.error_empty'));
    }

    // Éxito en la fila
    setRowStatus(rowIndex, 'success', t('val.success', { count: movies.length }), false);
    state.userResults[pageUrl] = { label, url: pageUrl, movies };

    // Buscar todos los usuarios actualmente en inputs que tengan datos exitosos en memoria
    const currentRows = $$('.user-row', usersContainer);
    const allSuccessful = [];
    const allLabels = [];
    const allRawInputs = [];

    currentRows.forEach(r => {
      const rInp = r.querySelector('.user-input');
      const rVal = rInp?.value.trim() || '';
      if (rVal) {
        allRawInputs.push(rVal);
        const rUrl = normalizePageUrl(rVal);
        if (state.userResults[rUrl]?.movies?.length > 0) {
          allSuccessful.push(state.userResults[rUrl]);
          allLabels.push(state.userResults[rUrl].label);
        }
      }
    });

    if (allSuccessful.length >= MIN_USERS) {
      hideError();
      const comparison = computeComparison(allSuccessful);
      state.lastResults = { comparison, userLabels: allLabels, common: comparison.common };

      comparisonHistory.saveEntry(
        state.sourceMode,
        allRawInputs,
        allLabels,
        comparison.common.length
      );

      renderResults(comparison, allLabels);
      updateUrlParams(state.sourceMode, allRawInputs);
    }
  } catch (err) {
    if (state.activeFetches[rowIndex] !== fetchId) return;
    console.error(`[Retry] Falló reintento para ${label}:`, err);
    setRowStatus(rowIndex, 'error', `❌ ${err.message}`, true);
  }
}

// ─── URL NORMALIZER ───────────────────────────────────────────────────────────

/**
 * Normalize a Letterboxd page URL or username.
 * Supports:
 *   - usernames ("user" or "@user" in watchlist mode) -> "https://letterboxd.com/user/watchlist/"
 *   - profile URLs ("https://letterboxd.com/user/" in watchlist mode) -> "https://letterboxd.com/user/watchlist/"
 *   - list URLs ("https://letterboxd.com/user/list/name/") -> kept as-is
 * Strips trailing /rss/ or /page/N/ and ensures trailing slash.
 */
function normalizePageUrl(input) {
  let val = input.trim();
  if (val.startsWith('letterboxd.com') || val.startsWith('www.letterboxd.com')) {
    val = 'https://' + val;
  }

  // Si es solo username o @username
  if (!val.includes('/') || (val.startsWith('@') && !val.includes('/'))) {
    const clean = val.replace(/^@/, '').trim();
    if (isValidUsername(clean)) {
      return `https://letterboxd.com/${clean}/watchlist/`;
    }
  }

  try {
    const full = val.startsWith('http') ? val : `https://${val}`;
    const u = new URL(full);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'letterboxd.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (state.sourceMode === 'watchlist') {
        if (parts.length >= 1 && parts[1] !== 'watchlist') {
          return `https://letterboxd.com/${parts[0]}/watchlist/`;
        }
      }
      let pathname = u.pathname;
      if (!pathname.endsWith('/')) pathname += '/';
      pathname = pathname.replace(/\/rss\/$/, '/').replace(/\/page\/\d+\/$/, '/');
      return `https://letterboxd.com${pathname}`;
    }
  } catch { }

  let url = val;
  if (!url.endsWith('/')) url += '/';
  url = url.replace(/\/rss\/$/, '/').replace(/\/page\/\d+\/$/, '/');
  return url;
}

function extractLabel(input) {
  const val = input.trim();
  if (!val.includes('/') || (val.startsWith('@') && !val.includes('/'))) {
    return val.replace(/^@/, '');
  }
  try {
    const full = val.startsWith('http') ? val : `https://${val}`;
    const u = new URL(full);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || input;
  } catch {
    return input;
  }
}

// ─── HTML SCRAPING FETCH ──────────────────────────────────────────────────────

/**
 * Fetch a Letterboxd list/watchlist page via CORS proxy and extract movie data
 * by parsing the HTML DOM (data-film-slug attributes on .film-poster elements).
 *
 * Handles pagination automatically: fetches /page/1/, /page/2/, … until empty.
 */
/**
 * Fetch all pages of a Letterboxd watchlist or list.
 *
 * Strategy (v2 — with cache + proxy racing):
 *   1. Check localStorage cache first (TTL: 30 min). If hit, return instantly.
 *   2. For each page, race ALL proxies in parallel via fetchViaFastestProxy().
 *      The first proxy to respond wins (~2-5 s vs up to 56 s sequentially).
 *   3. Parse HTML with parseHtmlFilmPosters().
 *   4. Paginate until an empty page or fewer-than-full-page response.
 *   5. On success, persist to cache.
 */
async function fetchAndParseList(baseUrl, label, searchId = null, fetchId = null) {
  // ── Cache lookup ────────────────────────────────────────────────────────────
  const cached = letterboxdCache.get(baseUrl);
  if (cached) {
    console.log(`[Cache] ⚡ Hit for "${label}" (${cached.length} films)`);
    updateLoadingMessage(`⚡ ${label} (${cached.length})`);
    reportProxyStatus({ user: label, status: 'success', name: t('proxy.local_cache'), elapsed: 0 });
    await sleep(150);
    return cached;
  }

  const allMovies = [];
  let page = 1;
  let hasMore = true;
  let perPage = null;

  while (hasMore && page <= 30) {
    // Check flags without AbortController
    if (searchId && searchId !== state.currentSearchId) return null;
    if (fetchId && Object.values(state.activeFetches).length > 0 && !Object.values(state.activeFetches).includes(fetchId)) return null;

    const pageUrl = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    updateLoadingMessage(`Obteniendo datos de "${label}" — página ${page}…`);

    let html;
    try {
      html = await fetchViaFastestProxy(pageUrl, 12000, label);
    } catch (firstErr) {
      console.warn(`[${label}] p${page} falló, reintentando en 1s…`);
      reportProxyStatus({ user: label, status: 'fallback', name: 'Reintento p' + page });
      await sleep(1000);
      try {
        html = await fetchViaFastestProxy(pageUrl, 12000, label);
      } catch (err) {
        if (page === 1) {
          throw new Error(
            `No se pudo acceder a "${label}".\n` +
            `Verificá que la URL sea correcta y que la lista/watchlist sea pública.\n` +
            err.message
          );
        }
        console.warn(`[${label}] p${page} all proxies failed — stopping pagination.`);
        break;
      }
    }

    // Sanity-check: confirm it's Letterboxd HTML
    if (!html.includes('letterboxd') && !html.includes('griditem') && !html.includes('film')) {
      if (page === 1) throw new Error(`La respuesta no parece HTML de Letterboxd para "${label}".`);
      break;
    }

    console.log(`[${label}] p${page} ✅ ${html.length} chars`);
    const movies = parseHtmlFilmPosters(html, label);

    if (movies.length === 0) {
      hasMore = false;
    } else {
      allMovies.push(...movies);

      if (perPage === null) {
        if (movies.length <= 28) perPage = FILMS_PER_PAGE_WATCHLIST;
        else if (movies.length <= 72) perPage = 72;
        else perPage = movies.length;
        console.log(`[${label}] Auto-detected perPage = ${perPage} (got ${movies.length} on p1)`);
      }

      if (movies.length < perPage) {
        hasMore = false;
      } else {
        page++;
      }
    }
  }

  if (allMovies.length === 0) {
    console.warn(`[${label}] No se encontraron películas. La lista puede estar vacía o ser privada.`);
  }

  console.log(`[${label}] Total: ${allMovies.length} películas en ${page} página(s)`);

  // ── Persist to cache (only if we got actual data) ────────────────────────────
  if (allMovies.length > 0) {
    letterboxdCache.set(baseUrl, allMovies);
    console.log(`[Cache] 💾 Saved "${label}" (${allMovies.length} films, TTL: 30 min)`);
  }

  return allMovies;
}

/**
 * Fetch with timeout using Promise.race().
 *
 * Timeout reduced to 8 s (was 25 s) because we now race ALL proxies in
 * parallel — a proxy that doesn't answer in 8 s is effectively dead and
 * we don't need to wait for it when faster alternatives are competing.
 *
 * We avoid AbortController because some browsers (Opera GX, older Safari)
 * report "signal is aborted without reason" when their tracker blocker
 * interferes with AbortController signals.
 */
function fetchWithTimeout(url, timeout = 8000) {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout after ${timeout}ms`)), timeout)
  );
  return Promise.race([
    fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    }),
    timeoutPromise,
  ]);
}

/**
 * Race ALL proxies in parallel and resolve with the FIRST valid HTML response.
 *
 * This replaces the old sequential for-loop approach:
 *   Sequential (old): N × timeout = up to 8 × 8 s = 64 s worst case
 *   Racing    (new): resolves in ~2–5 s — fastest proxy always wins
 *
 * Uses Promise.any() which:
 *   - Resolves as soon as ANY promise resolves
 *   - Rejects only when ALL proxies reject (AggregateError)
 */
async function fetchViaFastestProxy(targetUrl, timeout = 12000, label = '') {
  const [primary, ...fallbacks] = PROXIES;

  // 1) Intentamos SOLO el proxy principal (Worker propio o localhost en dev)
  try {
    reportProxyStatus({ user: label, status: 'attempt', name: primary.name, host: primary.url.split('/')[2] });
    return await attemptProxy(primary, targetUrl, timeout, label);
  } catch (err) {
    console.warn(`[Proxy] ⚠️ Proxy principal falló (${primary.name || primary.url.split('/')[2]}), probando fallbacks…`);
    reportProxyStatus({ user: label, status: 'fallback', name: primary.name, host: primary.url.split('/')[2], error: err.message });
  }

  // 2) Solo si el principal falla, recién ahí recurrimos a los públicos
  if (fallbacks.length === 0) {
    throw new Error(
      `Todos los proxies CORS fallaron para esta petición.\n` +
      `💡 Si usás Opera GX, Brave u otro navegador con bloqueador integrado, ` +
      `desactivá el bloqueador para esta página (ícono de escudo en la barra de direcciones).`
    );
  }

  try {
    return await Promise.any(fallbacks.map(proxy => {
      reportProxyStatus({ user: label, status: 'attempt', name: proxy.name, host: proxy.url.split('/')[2] });
      return attemptProxy(proxy, targetUrl, timeout, label);
    }));
  } catch {
    throw new Error(
      `Todos los proxies CORS fallaron para esta petición.\n` +
      `💡 Si usás Opera GX, Brave u otro navegador con bloqueador integrado, ` +
      `desactivá el bloqueador para esta página (ícono de escudo en la barra de direcciones).`
    );
  }
}

/**
 * Un solo intento de proxy: fetch + validación + log de éxito.
 * Extraído de fetchViaFastestProxy para poder reusarlo en el intento
 * principal y en los fallbacks sin duplicar código.
 */
async function attemptProxy(proxy, targetUrl, timeout, label = '') {
  const proxyUrl = `${proxy.url}${encodeURIComponent(targetUrl)}`;
  const host = proxy.url.split('/')[2];
  const proxyName = proxy.name || host;
  const t0 = Date.now();

  try {
    const resp = await fetchWithTimeout(proxyUrl, timeout);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

    let html;
    if (proxy.mode === 'json-contents') {
      const data = await resp.json();
      if (!data.contents) throw new Error('Empty contents');
      html = data.contents;
    } else {
      html = await resp.text();
    }

    if (!html || html.trim().length < 500) {
      throw new Error(`Response too short (${html?.trim().length ?? 0} chars)`);
    }

    const elapsed = Date.now() - t0;
    if (!_proxySpeedLog[host]) _proxySpeedLog[host] = [];
    _proxySpeedLog[host].push(elapsed);
    console.log(`[Proxy] ✅ ${proxyName} — ${elapsed}ms (${html.length} chars)`);

    reportProxyStatus({ user: label, status: 'success', name: proxyName, host, elapsed });

    return html;
  } catch (err) {
    console.warn(`[Proxy] ❌ ${proxyName} — ${err.message}`);
    throw err;
  }
}
/**
 * Parse a Letterboxd HTML page and extract film data.
 *
 * Letterboxd's current (2024–2026) HTML structure uses React lazy-loaded posters:
 *
 *   <div class="react-component" data-component-class="LazyPoster"
 *        data-item-slug="princess-mononoke"
 *        data-item-name="Princess Mononoke (1997)"
 *        data-item-link="/film/princess-mononoke/"
 *        data-item-full-display-name="Princess Mononoke (1997)"
 *        data-target-link="/film/princess-mononoke/" …>
 *
 * Older pages / some layouts still use:
 *   data-film-slug, data-film-name, data-film-release-year
 *
 * Ultimate fallback: extract slugs from any /film/SLUG/ href patterns in raw HTML.
 *
 * The canonical ID for comparison is always the film SLUG (e.g. "parasite-2019"),
 * which is unique and stable across Letterboxd, ensuring exact intersection matching.
 */
function parseHtmlFilmPosters(html, label) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const movies = [];
  const seen = new Set();

  // ── Strategy 1: LazyPoster react-components (current Letterboxd layout) ──────
  // These are the primary poster containers rendered server-side for scraping.
  const lazyPosters = doc.querySelectorAll(
    '[data-component-class="LazyPoster"], [data-item-slug], [data-film-slug]'
  );

  lazyPosters.forEach(el => {
    // ── Slug (canonical film identifier) ──────────────────────────────────────
    let slug = el.getAttribute('data-item-slug')
      || el.getAttribute('data-film-slug');

    if (!slug) {
      // Derive from link attributes if slug attribute is absent
      const link = el.getAttribute('data-target-link')
        || el.getAttribute('data-item-link')
        || el.getAttribute('data-film-link');
      if (link) {
        const m = link.match(/\/film\/([a-z0-9-]+)/);
        if (m) slug = m[1];
      }
    }

    if (!slug || seen.has(slug)) return;
    seen.add(slug);

    // ── Display name (may include year) ──────────────────────────────────────
    const fullDisplayName = el.getAttribute('data-item-full-display-name')
      || el.getAttribute('data-item-name')
      || '';

    // ── Title (strip trailing year in parentheses) ────────────────────────────
    let title = el.getAttribute('data-film-name')
      || el.getAttribute('data-original-title')
      || '';

    if (!title && fullDisplayName) {
      // "Princess Mononoke (1997)" → "Princess Mononoke"
      title = fullDisplayName.replace(/\s*\(\d{4}\)\s*$/, '').trim();
    }

    if (!title) {
      // Last resort: use alt text from the poster image
      title = el.querySelector('img')?.getAttribute('alt') || '';
    }

    if (!title) {
      // Humanize slug as fallback: "princess-mononoke" → "Princess Mononoke"
      title = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Remove any remaining trailing year from title (e.g. "Parasite (2019)" → "Parasite")
    title = title.replace(/\s*\(\d{4}\)\s*$/, '').trim();

    // ── Release year ──────────────────────────────────────────────────────────
    let year = el.getAttribute('data-film-release-year') || '';
    if (!year && fullDisplayName) {
      const ym = fullDisplayName.match(/\((\d{4})\)\s*$/);
      if (ym) year = ym[1];
    }

    // ── Poster image ─────────────────────────────────────────────────────────
    // Letterboxd uses React lazy-loading: img[src] starts as a 35×50 placeholder.
    // The real high-res URL is in: srcset, data-srcset, data-src, or <noscript>.
    let poster = null;

    const img = el.querySelector('img');
    if (img) {
      // 1. srcset / data-srcset — pick the last (= highest resolution) entry
      const srcset = img.getAttribute('srcset') || img.getAttribute('data-srcset') || '';
      if (srcset) {
        const parts = srcset.split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
        if (parts.length) poster = parts[parts.length - 1];
      }
      // 2. data-src on the img element
      if (!poster || poster.includes('35x50') || poster.includes('empty')) {
        poster = img.getAttribute('data-src') || null;
      }
      // 3. src — only if it's not the placeholder
      if (!poster || poster.includes('35x50') || poster.includes('empty') || poster.startsWith('data:')) {
        const src = img.getAttribute('src') || '';
        poster = (!src.includes('35x50') && !src.includes('empty') && !src.startsWith('data:') && src) ? src : null;
      }
    }

    // 4. <noscript> fallback — Letterboxd always puts the real <img> inside <noscript>
    //    for search-engine crawlers. This is the most reliable source.
    if (!poster) {
      const noscript = el.querySelector('noscript');
      if (noscript) {
        const nsContent = noscript.textContent || noscript.innerHTML || '';
        // Try srcset first (highest res)
        const srcsetM = nsContent.match(/srcset=["']([^"']+)["']/i);
        if (srcsetM) {
          const parts = srcsetM[1].split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
          if (parts.length) poster = parts[parts.length - 1];
        }
        // Fallback to src
        if (!poster || poster.includes('35x50') || poster.includes('empty')) {
          const srcM = nsContent.match(/\ssrc=["']([^"']+)["']/i);
          if (srcM && !srcM[1].includes('35x50') && !srcM[1].includes('empty')) {
            poster = srcM[1];
          }
        }
      }
    }

    // 5. data-src / data-poster on the container element itself
    if (!poster) {
      const elSrc = el.getAttribute('data-src') || el.getAttribute('data-poster') || '';
      if (elSrc && !elSrc.includes('35x50') && !elSrc.includes('empty') && !elSrc.startsWith('data:')) {
        poster = elSrc;
      }
    }

    // Final sanitization — reject obvious non-poster URLs
    if (poster && (
      poster.includes('empty.png') ||
      poster.includes('avatar') ||
      poster.startsWith('data:') ||
      poster.includes('35x50')
    )) {
      poster = null;
    }

    movies.push({
      id: slug,
      title: cleanMovieTitle(title),
      year,
      poster,
      link: `https://letterboxd.com/film/${slug}/`,
      description: '',
    });
  });

  // ── Fallback: extract slugs from all /film/SLUG/ hrefs in the raw HTML ──────
  if (movies.length === 0) {
    console.log(`[${label}] DOM parse found 0 posters, falling back to href regex`);
    const slugSet = new Set();
    const hrefMatches = html.matchAll(/href=["']\/film\/([a-z0-9-]+)\/["']/g);
    for (const m of hrefMatches) {
      slugSet.add(m[1]);
    }
    for (const slug of slugSet) {
      if (seen.has(slug)) continue;
      seen.add(slug);
      movies.push({
        id: slug,
        title: slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        year: '',
        poster: null,
        link: `https://letterboxd.com/film/${slug}/`,
        description: '',
      });
    }
    console.log(`[${label}] href fallback found ${movies.length} slugs`);
  }

  return movies;
}


/**
 * Clean up a movie title that may have been extracted from an HTML attribute.
 */
function cleanMovieTitle(raw) {
  if (!raw) return 'Sin título';
  return raw.trim();
}



function getText(parent, tag) {
  const el = parent.querySelector(tag);
  return el ? el.textContent.trim() : '';
}

function parseTitle(raw) {
  // Letterboxd format: "Movie Title, YEAR" or just "Movie Title"
  const match = raw.match(/^(.*?),\s*(\d{4})\s*$/);
  if (match) return { cleanTitle: match[1].trim(), year: match[2] };
  return { cleanTitle: raw.trim(), year: '' };
}

function extractPoster(html) {
  if (!html) return null;
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : null;
}

function extractSlug(url) {
  if (!url) return '';
  const match = url.match(/letterboxd\.com\/film\/([^/]+)/);
  return match ? match[1] : '';
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, 300);
}

// ─── COMPARISON LOGIC ─────────────────────────────────────────────────────────

function computeComparison(usersData) {
  // Build a map: movieId → { movie, foundInUsers[] }
  const movieMap = new Map();

  usersData.forEach(({ label, movies }) => {
    movies.forEach(movie => {
      if (!movieMap.has(movie.id)) {
        movieMap.set(movie.id, { movie, foundIn: [] });
      }
      movieMap.get(movie.id).foundIn.push(label);
    });
  });

  const allUsers = usersData.map(u => u.label);
  const common = [];
  const uniqueByUser = {};

  allUsers.forEach(u => { uniqueByUser[u] = []; });

  movieMap.forEach(({ movie, foundIn }) => {
    const inAll = allUsers.every(u => foundIn.includes(u));
    if (inAll) {
      common.push({ ...movie, foundIn });
    } else {
      foundIn.forEach(u => {
        // Only add to a user's unique list if NOT in common
        if (!inAll) uniqueByUser[u]?.push({ ...movie, foundIn });
      });
    }
  });

  // Sort
  common.sort((a, b) => a.title.localeCompare(b.title));
  Object.keys(uniqueByUser).forEach(u => {
    uniqueByUser[u].sort((a, b) => a.title.localeCompare(b.title));
  });

  return { common, uniqueByUser, allUsers, totalMovies: movieMap.size };
}

// ─── RENDER RESULTS ───────────────────────────────────────────────────────────

function renderResults(comparison, userLabels) {
  const { common, uniqueByUser, allUsers, totalMovies } = comparison;

  // Stats bar
  const hasCommon = common.length > 0;
  statsBar.innerHTML = `
    <div class="stat-chip">
      <span class="dot dot-green"></span>
      <strong>${common.length}</strong> ${t('hist.badge_common', { count: common.length })}
    </div>
    <div class="stat-chip">
      <span class="dot dot-blue"></span>
      ${t('results.total_movies', { count: totalMovies })}
    </div>
    ${allUsers.map(u => `
      <div class="stat-chip">
        <span class="dot dot-orange"></span>
        ${t('results.unique_user', { count: uniqueByUser[u]?.length ?? 0, user: escapeHtml(u) })}
      </div>
    `).join('')}
    <button
      id="btn-open-top5"
      class="btn-top5-trigger"
      ${!hasCommon ? 'disabled' : ''}
      aria-label="${t('results.top5_aria')}"
      title="${hasCommon ? t('results.top5_title_enabled') : t('results.top5_title_disabled')}"
    >
      ${t('results.top5_btn')}
    </button>
  `;

  // Common badge
  commonCount.textContent = common.length;

  // Common movies
  renderCommonMovies(common);

  // Unique per user tabs
  renderUniqueTabs(uniqueByUser, allUsers);

  resultsSection.classList.remove('hidden');
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCommonMovies(movies) {
  const sorted = [...movies].sort((a, b) => {
    return state.sortCommonAsc
      ? a.title.localeCompare(b.title)
      : b.title.localeCompare(a.title);
  });

  commonGrid.innerHTML = '';

  if (sorted.length === 0) {
    commonEmpty.classList.remove('hidden');
    return;
  }
  commonEmpty.classList.add('hidden');

  sorted.forEach((movie, i) => {
    const card = createMovieCard(movie, i, true);
    commonGrid.appendChild(card);
  });

  enrichGridPosters(sorted, commonGrid);

  // Trigger TMDB Watch Providers resolution for common movies
  loadStreamingProvidersForCommonMovies(sorted, state.currentSearchId);
}

function renderUniqueTabs(uniqueByUser, allUsers) {
  uniqueTabs.innerHTML = '';
  uniquePanels.innerHTML = '';
  state.uniqueTabData = {}; // ← reset: trackea qué pestañas ya se enriquecieron

  allUsers.forEach((user, i) => {
    const isActive = i === 0;
    const movies = uniqueByUser[user] || [];

    // Tab button
    const tab = document.createElement('button');
    tab.className = `tab-btn ${isActive ? 'active' : ''}`;
    tab.textContent = `${user} (${movies.length})`;
    tab.dataset.tab = i;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', isActive);
    tab.setAttribute('aria-label', t('results.tab_aria', { user, count: movies.length }));
    tab.setAttribute('aria-controls', `panel-${i}`);
    tab.id = `tab-${i}`;
    tab.addEventListener('click', () => switchTab(i));
    tab.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const next = (i + 1) % allUsers.length;
        $(`#tab-${next}`)?.focus();
        switchTab(next);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prev = (i - 1 + allUsers.length) % allUsers.length;
        $(`#tab-${prev}`)?.focus();
        switchTab(prev);
      }
    });
    uniqueTabs.appendChild(tab);

    // Panel
    const panel = document.createElement('div');
    panel.className = `tab-panel ${isActive ? 'active' : ''}`;
    panel.id = `panel-${i}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${i}`);

    if (movies.length === 0) {
      panel.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">✨</span>
          <p>¡Todas las películas de ${user} están en la lista común!</p>
        </div>
      `;
    } else {
      const grid = document.createElement('div');
      grid.className = 'unique-list';
      movies.forEach((movie, j) => {
        grid.appendChild(createMovieCard(movie, j, false));
      });
      panel.appendChild(grid);

      // Save the reference to be able to enrich this tab later
      state.uniqueTabData[i] = { movies, gridEl: grid, enriched: false };

      // The tab that starts visible is enriched immediately
      if (isActive) {
        state.uniqueTabData[i].enriched = true;
        enrichGridPosters(movies, grid);
      }
    }

    uniquePanels.appendChild(panel);
  });
}

function switchTab(index) {
  $$('.tab-btn').forEach(btn => {
    const isActive = Number(btn.dataset.tab) === index;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  $$('.tab-panel').forEach((panel, i) => {
    panel.classList.toggle('active', i === index);
  });

  // Enrich posters only the first time the user opens this tab
  const tabData = state.uniqueTabData?.[index];
  if (tabData && !tabData.enriched) {
    tabData.enriched = true;
    enrichGridPosters(tabData.movies, tabData.gridEl);
  }
}

// ─── POSTER FALLBACK HELPER ──────────────────────────────────────────────────

/**
 * Called by img[onerror] when a poster URL fails to load.
 * Hides the broken image and inserts a styled SVG placeholder instead.
 */
function posterFallback(imgEl) {
  imgEl.style.display = 'none';
  const placeholder = document.createElement('div');
  placeholder.className = imgEl.dataset.placeholderClass || 'movie-poster-placeholder';
  placeholder.innerHTML = `
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <rect x="2" y="2" width="20" height="20" rx="3"/>
      <path d="M8 10l8 0M8 14l4 0"/>
    </svg>
    <span>${t('results.no_poster')}</span>`;
  imgEl.parentNode.insertBefore(placeholder, imgEl.nextSibling);
}

// ─── MOVIE CARD ───────────────────────────────────────────────────────────────

function createMovieCard(movie, index, isCommon) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.dataset.movieId = movie.id;
  card.style.animationDelay = `${Math.min(index * 0.04, 0.5)}s`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${movie.title}${movie.year ? ` (${movie.year})` : ''}`);

  const posterHtml = movie.poster
    ? `<img class="movie-poster" src="${escapeAttr(movie.poster)}" alt="${escapeAttr(t('results.poster_alt', { title: movie.title }))}" loading="lazy" onerror="posterFallback(this)" />`
    : `<div class="movie-poster-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="20" rx="3"/>
          <path d="M8 10l8 0M8 14l4 0"/>
        </svg>
        <span>${t('results.no_poster')}</span>
       </div>`;

  card.innerHTML = `
    <div class="movie-poster-wrap">
      ${posterHtml}
      <div class="movie-hover-overlay">
        <span class="overlay-btn">${t('results.view_details')}</span>
      </div>
    </div>
    <div class="movie-info">
      <div class="movie-title">${escapeHtml(movie.title)}</div>
      ${movie.year ? `<div class="movie-year">${movie.year}</div>` : ''}
    </div>
  `;

  const openModal = () => openMovieModal(movie, isCommon);
  card.addEventListener('click', openModal);
  card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') openModal(); });

  return card;
}

// ─── MOVIE MODAL ──────────────────────────────────────────────────────────────

function openMovieModal(movie, isCommon) {
  const needsData = !movie.poster || !movie.description || movie.rating == null;
  renderModalContent(movie, isCommon, needsData);

  movieModal.classList.remove('hidden');
  movieModal.removeAttribute('aria-hidden');
  modalCloseBtn.focus();
  document.body.style.overflow = 'hidden';

  if (needsData) {
    enrichMovieMeta(movie).then(meta => {
      if (meta.poster) movie.poster = meta.poster;
      if (meta.description) movie.description = meta.description;
      if (meta.rating != null) movie.rating = meta.rating;

      // Solo re-pintamos si el modal sigue abierto mostrando esta misma película
      if (!movieModal.classList.contains('hidden') && modalContent.dataset.movieId === movie.id) {
        renderModalContent(movie, isCommon, false);
      }
    });
  }
}

function renderModalContent(movie, isCommon, loading) {
  modalContent.dataset.movieId = movie.id;

  const posterHtml = movie.poster
    ? `<img src="${escapeAttr(movie.poster)}" alt="${escapeAttr(t('results.poster_alt', { title: movie.title }))}" style="width:100%;height:100%;object-fit:cover;" loading="lazy" onerror="posterFallback(this)" />`
    : (loading
        ? `<div class="modal-poster-loading"><span class="spinner"></span></div>`
        : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.75rem;">${t('results.no_poster')}</div>`);

  const ratingHtml = movie.rating != null
    ? `<div class="modal-rating">${ratingToStars(movie.rating)} <span class="modal-rating-num">${movie.rating.toFixed(1)}</span></div>`
    : (loading ? `<div class="modal-rating modal-rating-loading">${t('modal.loading_rating')}</div>` : '');

  const descHtml = movie.description
    ? `<p class="modal-desc">${escapeHtml(movie.description.slice(0, 320))}${movie.description.length > 320 ? '…' : ''}</p>`
    : (loading ? `<p class="modal-desc modal-desc-loading">${t('modal.loading_desc')}</p>` : '');

  // Providers section in modal
  const movieData = state.commonProvidersMap[movie.id];
  const providers = movieData?.providers || [];
  const region = tmdbConfig.region;
  let providersHtml = '';

  if (tmdbConfig.apiKey) {
    if (providers.length > 0) {
      providersHtml = `
        <div class="modal-providers-section">
          <div class="modal-providers-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"/>
              <polyline points="17 2 12 7 7 2"/>
            </svg>
            <span>${t('stream.available_on', { region })}</span>
          </div>
          <div class="modal-providers-list">
            ${providers.map(p => `
              <div class="modal-provider-pill">
                ${p.logo_path ? `<img class="modal-provider-logo" src="${escapeAttr(p.logo_path)}" alt="${escapeAttr(p.provider_name)}" />` : ''}
                <span>${escapeHtml(p.provider_name)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (movieData && providers.length === 0) {
      providersHtml = `
        <div class="modal-providers-section">
          <span class="movie-no-stream-badge">${t('stream.not_available', { region })}</span>
        </div>
      `;
    }
  }

  modalContent.innerHTML = `
    <div class="modal-movie-inner">
      <div class="modal-poster">${posterHtml}</div>
      <div class="modal-details">
        <h2 class="modal-title" id="modal-title">${escapeHtml(movie.title)}</h2>
        ${movie.year ? `<div class="modal-year">${movie.year}</div>` : ''}
        ${ratingHtml}
        ${descHtml}
        ${providersHtml}
        <a class="modal-link" href="${escapeAttr(movie.link)}" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          ${t('modal.view_letterboxd')}
        </a>
        ${isCommon && movie.foundIn ? `
          <div class="modal-users-found">
            <strong>${t('modal.found_in')}</strong> ${movie.foundIn.map(u => escapeHtml(u)).join(', ')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

function closeModal() {
  movieModal.classList.add('hidden');
  movieModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ─── TOP 5 ELIMINATOR ────────────────────────────────────────────────────────

/**
 * Opens the Top 5 overlay and shows setup if streaming providers exist, or goes directly to init.
 */
function openTop5() {
  if (!state.lastResults) return;
  const pool = state.lastResults.common || [];
  if (pool.length === 0) return;

  top5Overlay().classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Check if we have TMDB providers available to offer filtering
  const hasProvidersData = Object.keys(state.commonProvidersMap || {}).length > 0;
  const availableProviders = getAvailableCommonProvidersList();

  if (hasProvidersData && availableProviders.length > 0) {
    showTop5Setup(pool, availableProviders);
  } else {
    // No streaming key or no providers loaded yet: proceed directly with all common movies
    top5Setup()?.classList.add('hidden');
    initTop5(pool);
  }
}

/**
 * Extracts unique provider objects available in the current common results
 */
function getAvailableCommonProvidersList() {
  const map = new Map();
  const common = state.lastResults?.common || [];
  common.forEach(m => {
    const data = state.commonProvidersMap[m.id];
    (data?.providers || []).forEach(p => {
      if (!map.has(p.provider_id)) {
        map.set(p.provider_id, { ...p, count: 1 });
      } else {
        map.get(p.provider_id).count++;
      }
    });
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.provider_name.localeCompare(b.provider_name));
}

/**
 * Display the setup dialog asking the user whether to filter by streaming platforms for Top 5
 */
function showTop5Setup(fullPool, providers) {
  const setupEl = top5Setup();
  if (!setupEl) {
    initTop5(fullPool);
    return;
  }

  // Reset display
  setupEl.classList.remove('hidden');
  top5Grid().classList.add('hidden');
  top5Loading().classList.add('hidden');
  top5WinnerBanner().classList.add('hidden');
  top5Counter().classList.add('hidden');

  // I18n labels
  if (top5SetupTitle()) top5SetupTitle().textContent = t('top5.setup_title');
  if (top5SetupDesc()) top5SetupDesc().textContent = t('top5.setup_desc');
  if (top5OptAllLabel()) top5OptAllLabel().textContent = t('top5.setup_all_opt', { count: fullPool.length });
  if (top5OptAllSub()) top5OptAllSub().textContent = t('top5.setup_all_desc');
  if (top5OptStreamLabel()) top5OptStreamLabel().textContent = t('top5.setup_stream_opt', { count: fullPool.filter(m => (state.commonProvidersMap[m.id]?.providers || []).length > 0).length });
  if (top5OptStreamSub()) top5OptStreamSub().textContent = t('top5.setup_stream_desc');
  if (btnTop5Start()) btnTop5Start().textContent = t('top5.setup_btn_start');

  const chipsWrap = top5SetupChips();
  const chipsContainer = top5ChipsContainer();
  const startBtn = btnTop5Start();

  const radioAll = setupEl.querySelector('input[value="all"]');
  const radioStream = setupEl.querySelector('input[value="stream"]');

  // Local set of selected providers for Top 5 (defaults to current active filter or all available)
  const top5SelectedProviders = new Set(
    state.selectedProviders.size > 0 ? state.selectedProviders : providers.map(p => p.provider_id)
  );

  const renderTop5Chips = () => {
    if (!chipsContainer) return;
    chipsContainer.innerHTML = '';

    providers.forEach(p => {
      const isSel = top5SelectedProviders.has(p.provider_id);
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `stream-chip ${isSel ? 'active' : ''}`;
      chip.innerHTML = `
        ${p.logo_path ? `<img class="stream-chip-logo" src="${escapeAttr(p.logo_path)}" alt="${escapeAttr(p.provider_name)}" />` : ''}
        <span>${escapeHtml(p.provider_name)}</span>
        <span class="stream-chip-count">${p.count}</span>
      `;
      chip.addEventListener('click', () => {
        if (top5SelectedProviders.has(p.provider_id)) {
          top5SelectedProviders.delete(p.provider_id);
        } else {
          top5SelectedProviders.add(p.provider_id);
        }
        renderTop5Chips();
        updateStartButtonState();
      });
      chipsContainer.appendChild(chip);
    });
  };

  const updateStartButtonState = () => {
    const isStreamChoice = radioStream?.checked;
    if (isStreamChoice) {
      const filteredCount = fullPool.filter(m => {
        const pList = state.commonProvidersMap[m.id]?.providers || [];
        return pList.some(p => top5SelectedProviders.has(p.provider_id));
      }).length;

      if (filteredCount === 0) {
        startBtn.disabled = true;
        startBtn.textContent = t('top5.setup_no_matches');
      } else {
        startBtn.disabled = false;
        startBtn.textContent = `${t('top5.setup_btn_start')} (${filteredCount})`;
      }
    } else {
      startBtn.disabled = false;
      startBtn.textContent = `${t('top5.setup_btn_start')} (${fullPool.length})`;
    }
  };

  const handleRadioChange = () => {
    if (radioStream?.checked) {
      chipsWrap?.classList.remove('hidden');
      renderTop5Chips();
    } else {
      chipsWrap?.classList.add('hidden');
    }
    updateStartButtonState();
  };

  if (radioAll) radioAll.onchange = handleRadioChange;
  if (radioStream) radioStream.onchange = handleRadioChange;

  handleRadioChange();

  startBtn.onclick = () => {
    let finalPool = fullPool;
    if (radioStream?.checked) {
      finalPool = fullPool.filter(m => {
        const pList = state.commonProvidersMap[m.id]?.providers || [];
        return pList.some(p => top5SelectedProviders.has(p.provider_id));
      });
    }

    setupEl.classList.add('hidden');
    top5State.pool = finalPool;
    initTop5(finalPool);
  };
}

/**
 * Close and reset the Top 5 overlay.
 */
function closeTop5() {
  const overlay = top5Overlay();
  if (!overlay || overlay.classList.contains('hidden')) return;
  overlay.classList.add('hidden');
  document.body.style.overflow = '';
  stopConfetti();
  top5Grid().innerHTML = '';
  top5Setup()?.classList.add('hidden');
  top5WinnerBanner().classList.add('hidden');
  top5Counter().classList.remove('hidden');
  top5Loading().classList.add('hidden');
}

/**
 * Randomly pick up to 5 movies, enrich them with og:image + synopsis + rating,
 * then render the cards.
 */
async function initTop5(pool) {
  // Reset UI
  top5Setup()?.classList.add('hidden');
  top5Grid().innerHTML = '';
  top5WinnerBanner().classList.add('hidden');
  top5Counter().classList.remove('hidden');
  stopConfetti();

  // Shuffle and pick ≤5
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const batch = shuffled.slice(0, Math.min(5, shuffled.length));
  top5State.current = batch.map(m => ({ ...m }));
  top5State.remaining = batch.length;
  updateTop5Counter();

  // Show loading
  top5Loading().classList.remove('hidden');
  top5Grid().classList.add('hidden');

  // Enrich in parallel
  await Promise.allSettled(
    top5State.current.map(async (movie, i) => {
      top5LoadingMsg().textContent = `Cargando información de las películas… (${i + 1}/${batch.length})`;
      const enriched = await enrichMovieMeta(movie);
      top5State.current[i] = { ...movie, ...enriched };
    })
  );

  // Hide loading, show grid
  top5Loading().classList.add('hidden');
  top5Grid().classList.remove('hidden');
  renderTop5Cards(top5State.current);
}

/**
 * Fetch the individual Letterboxd film page and extract:
 *   - poster: og:image URL (high-res)
 *   - description: og:description (synopsis)
 *   - rating: average rating numeric value (0–5) → converted to ★ string
 */
async function enrichMovieMeta(movie) {
  // ── Caché hit: evita re-pedir lo que ya conseguimos antes ─────────────────
  const cached = filmMetaCache.get(movie.id);
  if (cached) {
    return {
      poster: cached.poster ?? movie.poster ?? null,
      description: cached.description || movie.description || '',
      rating: cached.rating ?? null,
    };
  }

  const result = { poster: movie.poster || null, description: movie.description || '', rating: null };
  try {
    // ── Fetch film page via fastest available proxy ────────────────────────────
    let html;
    try {
      html = await fetchViaFastestProxy(movie.link);
    } catch {
      return result; // all proxies failed — return whatever we already have
    }

    if (!html) return result;

    // ── og:image → high-res poster ───────────────────────────────────────────
    // Robust regex: tolerates any attribute order (property/content either first)
    const ogImageMatch =
      html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/content=["']([^"']+)["'][^>]*property=["']og:image["']/i) ||
      html.match(/name=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogImageMatch?.[1]) {
      const imgUrl = ogImageMatch[1];
      if (!imgUrl.includes('empty') && !imgUrl.startsWith('data:') && !imgUrl.includes('35x50')) {
        result.poster = imgUrl;
      }
    }

    // ── og:description → synopsis ─────────────────────────────────────────────
    if (!result.description) {
      const ogDescMatch =
        html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/content=["']([^"']+)["'][^>]*property=["']og:description["']/i) ||
        html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i);
      if (ogDescMatch?.[1]) {
        result.description = decodeHtmlEntities(ogDescMatch[1].trim());
      }
    }

    // ── Average rating — Method 1: itemprop ratingValue ───────────────────────
    // Tolerates any order: itemprop first or content first
    const ratingMatch =
      html.match(/itemprop=["']ratingValue["'][^>]*content=["']([\d.]+)["']/i) ||
      html.match(/content=["']([\d.]+)["'][^>]*itemprop=["']ratingValue["']/i) ||
      html.match(/class=["'][^"']*display-rating[^"']*["'][^>]*>([\d.]+)/i);
    if (ratingMatch?.[1]) {
      const raw = parseFloat(ratingMatch[1]);
      if (!isNaN(raw) && raw >= 0) result.rating = raw;
    }

    // ── Average rating — Method 2: JSON-LD schema.org AggregateRating ────────
    // Letterboxd includes structured data in <script type="application/ld+json">
    if (result.rating === null) {
      const ldScripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
      for (const match of ldScripts) {
        try {
          const json = JSON.parse(match[1]);
          const ratingVal =
            json?.aggregateRating?.ratingValue ??
            (Array.isArray(json?.['@graph'])
              ? json['@graph'].find(n => n?.aggregateRating)?.aggregateRating?.ratingValue
              : undefined);
          if (ratingVal != null) {
            result.rating = parseFloat(ratingVal);
            break;
          }
        } catch { /* malformed JSON-LD — skip */ }
      }
    }

    // ── Fallback description ──────────────────────────────────────────────────
    if (!result.description) {
      result.description = 'Sinopsis no disponible en Letterboxd';
    }
  } catch (err) {
    console.warn('[enrichMovieMeta]', movie.id, err.message);
  }

  // ── Guardar en caché solo si llegamos hasta acá (hubo respuesta del proxy) ─
  filmMetaCache.set(movie.id, { poster: result.poster, description: result.description, rating: result.rating });

  return result;
}

// ─── POSTER CACHE (independent of the list cache, longer TTL) ────────
const POSTER_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h — posters don't change

// ─── FILM METADATA CACHE (póster + sinopsis + rating, compartido grid ↔ modal ↔ Top5) ──
const FILM_META_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const filmMetaCache = {
  _key(slug) { return `lbmatch_meta_v1_${slug}`; },
  get(slug) {
    try {
      const raw = localStorage.getItem(this._key(slug));
      if (!raw) return undefined;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > FILM_META_CACHE_TTL_MS) {
        localStorage.removeItem(this._key(slug));
        return undefined;
      }
      return data; // { poster, description, rating }
    } catch { return undefined; }
  },
  set(slug, data) {
    try {
      localStorage.setItem(this._key(slug), JSON.stringify({ data, ts: Date.now() }));
    } catch {}
  },
};

// ─── TMDB PROVIDERS SERVICE & CACHE ──────────────────────────────────────────
const tmdbConfig = {
  get apiKey() {
    return (window.APP_CONFIG && window.APP_CONFIG.TMDB_API_KEY) ? window.APP_CONFIG.TMDB_API_KEY.trim() : '';
  },
  get region() {
    return (window.APP_CONFIG && window.APP_CONFIG.TMDB_REGION) ? window.APP_CONFIG.TMDB_REGION.trim().toUpperCase() : 'AR';
  },
  get ttlMs() {
    const hours = (window.APP_CONFIG && window.APP_CONFIG.STREAMING_CACHE_TTL_HOURS) ? Number(window.APP_CONFIG.STREAMING_CACHE_TTL_HOURS) : 48;
    return hours * 60 * 60 * 1000;
  },
  get maxConcurrency() {
    return (window.APP_CONFIG && window.APP_CONFIG.TMDB_MAX_CONCURRENCY) ? Number(window.APP_CONFIG.TMDB_MAX_CONCURRENCY) : 6;
  }
};

/**
 * Persistent cache for TMDB movie search IDs and Watch Providers (flatrate subscription only)
 * Namespace: lbmatch_v1_providers_{slug}_{region}
 */
const tmdbProviderCache = {
  _key(slug, region) {
    return `lbmatch_v1_providers_${slug}_${region.toLowerCase()}`;
  },
  get(slug, region) {
    try {
      const raw = localStorage.getItem(this._key(slug, region));
      if (!raw) return undefined;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > tmdbConfig.ttlMs) {
        localStorage.removeItem(this._key(slug, region));
        return undefined;
      }
      return data; // { tmdbId, providers: [{ provider_id, provider_name, logo_path }] }
    } catch { return undefined; }
  },
  set(slug, region, data) {
    try {
      localStorage.setItem(this._key(slug, region), JSON.stringify({ data, ts: Date.now() }));
    } catch (e) {
      console.warn('[TMDB Cache] write failed:', e.message);
    }
  }
};

/**
 * Helper to build fetch options and query parameters for TMDB.
 * Supports both API Key v3 (32 hex characters) and Bearer Read Access Token v4 (starts with "ey...").
 */
function getTmdbFetchConfig(endpointUrl) {
  const rawKey = tmdbConfig.apiKey;
  if (!rawKey) return null;

  const isBearer = rawKey.startsWith('ey') || rawKey.length > 60;
  if (isBearer) {
    return {
      url: endpointUrl,
      options: {
        headers: {
          'Authorization': `Bearer ${rawKey}`,
          'Accept': 'application/json'
        }
      }
    };
  } else {
    const separator = endpointUrl.includes('?') ? '&' : '?';
    return {
      url: `${endpointUrl}${separator}api_key=${encodeURIComponent(rawKey)}`,
      options: {
        headers: {
          'Accept': 'application/json'
        }
      }
    };
  }
}

/**
 * Search TMDB by movie title and optional year.
 * Returns tmdbId (number) or null.
 */
async function searchTmdbMovie(title, year) {
  const baseSearch = `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(title)}&include_adult=false`;
  const urlWithYear = year ? `${baseSearch}&year=${encodeURIComponent(year)}` : baseSearch;
  const cfg = getTmdbFetchConfig(urlWithYear);
  if (!cfg) return null;

  try {
    const res = await fetch(cfg.url, cfg.options);
    if (!res.ok) {
      console.warn(`[TMDB] Search failed for "${title}" (${res.status})`);
      return null;
    }
    const json = await res.json();
    const results = json.results || [];
    if (results.length === 0) {
      // If search with year returned nothing, try without year parameter as fallback
      if (year) {
        const fallbackCfg = getTmdbFetchConfig(baseSearch);
        if (fallbackCfg) {
          const fbRes = await fetch(fallbackCfg.url, fallbackCfg.options);
          if (fbRes.ok) {
            const fbJson = await fbRes.json();
            if (fbJson.results && fbJson.results.length > 0) {
              console.log(`[TMDB] Approximate match for "${title}" without year constraint: ID ${fbJson.results[0].id}`);
              return fbJson.results[0].id;
            }
          }
        }
      }
      return null;
    }

    // Exact year match preferred
    if (year) {
      const exactMatch = results.find(r => r.release_date && r.release_date.startsWith(year));
      if (exactMatch) return exactMatch.id;
    }

    console.log(`[TMDB] Match for "${title}" (${year || 'no year'}): ID ${results[0].id}`);
    return results[0].id;
  } catch (err) {
    console.warn(`[TMDB] Search error for "${title}":`, err.message);
    return null;
  }
}

/**
 * Fetch watch providers (flatrate) from TMDB for a specific movie ID and configured region.
 */
async function getTmdbWatchProviders(tmdbId, region) {
  if (!tmdbId) return [];
  const cfg = getTmdbFetchConfig(`https://api.themoviedb.org/3/movie/${tmdbId}/watch/providers`);
  if (!cfg) return [];

  try {
    const res = await fetch(cfg.url, cfg.options);
    if (!res.ok) return [];

    const json = await res.json();
    const regionData = json.results?.[region];
    if (!regionData) return [];

    // Extract ONLY flatrate (subscription streaming), omitting rent / buy
    const flatrate = regionData.flatrate || [];
    return flatrate.map(p => ({
      provider_id: p.provider_id,
      provider_name: p.provider_name,
      logo_path: p.logo_path ? `https://image.tmdb.org/t/p/w92${p.logo_path}` : null,
      display_priority: p.display_priority ?? 999
    }));
  } catch (err) {
    console.warn(`[TMDB] Providers error for ID ${tmdbId}:`, err.message);
    return [];
  }
}

/**
 * Resolve TMDB ID and watch providers for a single movie (with cache).
 */
async function resolveMovieStreamingProviders(movie) {
  const region = tmdbConfig.region;
  const cached = tmdbProviderCache.get(movie.id, region);
  if (cached !== undefined) {
    return cached;
  }

  const tmdbId = await searchTmdbMovie(movie.title, movie.year);
  let providers = [];
  if (tmdbId) {
    providers = await getTmdbWatchProviders(tmdbId, region);
  }

  const result = { tmdbId, providers };
  tmdbProviderCache.set(movie.id, region, result);
  return result;
}

/**
 * Throttled batch resolver for all common movies.
 * Updates progress UI, updates cards with streaming badges, and renders dynamic filter chips.
 */
async function loadStreamingProvidersForCommonMovies(movies, searchId) {
  const apiKey = tmdbConfig.apiKey;
  if (!apiKey) {
    if (streamingFilterBar) {
      streamingFilterBar.classList.remove('hidden');
      if (streamingChipsContainer) {
        streamingChipsContainer.innerHTML = `<span class="movie-no-stream-badge" style="font-size:0.8rem;color:var(--text-muted);">${t('stream.tmdb_disabled')}</span>`;
      }
      if (streamingProgress) streamingProgress.classList.add('hidden');
    }
    return;
  }

  const region = tmdbConfig.region;
  state.selectedProviders.clear();
  state.commonProvidersMap = {};

  if (!movies || movies.length === 0) {
    if (streamingFilterBar) streamingFilterBar.classList.add('hidden');
    return;
  }

  if (streamingFilterBar) streamingFilterBar.classList.remove('hidden');
  if (streamingProgress) streamingProgress.classList.remove('hidden');
  if (streamingFilterLabel) streamingFilterLabel.textContent = t('stream.filter_label');

  let completed = 0;
  const total = movies.length;
  const updateProgress = () => {
    if (streamingProgressText) {
      streamingProgressText.textContent = t('stream.loading_providers', { region, current: completed, total });
    }
  };
  updateProgress();

  const concurrency = Math.min(tmdbConfig.maxConcurrency, 8);
  let idx = 0;
  let active = 0;

  const allAvailableProvidersMap = new Map(); // provider_id -> { provider_id, provider_name, logo_path, count }

  await new Promise(resolve => {
    function next() {
      if (state.currentSearchId !== searchId) return resolve();
      if (idx >= movies.length && active === 0) return resolve();

      while (active < concurrency && idx < movies.length) {
        const movie = movies[idx++];
        active++;

        resolveMovieStreamingProviders(movie)
          .then(data => {
            if (state.currentSearchId !== searchId) return;
            state.commonProvidersMap[movie.id] = data;

            // Track available providers across the result set
            (data.providers || []).forEach(p => {
              if (!allAvailableProvidersMap.has(p.provider_id)) {
                allAvailableProvidersMap.set(p.provider_id, { ...p, count: 1 });
              } else {
                allAvailableProvidersMap.get(p.provider_id).count++;
              }
            });

            // Update individual movie card badge immediately
            updateMovieCardProvidersUI(movie.id, data.providers, region);
          })
          .catch(err => {
            console.warn(`[Streaming] Error processing ${movie.title}:`, err);
          })
          .finally(() => {
            active--;
            completed++;
            updateProgress();
            next();
          });
      }
    }
    next();
  });

  if (state.currentSearchId !== searchId) return;

  if (streamingProgress) streamingProgress.classList.add('hidden');

  // Render filter chips for platforms that actually appear in this comparison
  renderStreamingFilterChips([...allAvailableProvidersMap.values()]);
}

/**
 * Updates an individual movie card with its provider logos or "Not available" text
 */
function updateMovieCardProvidersUI(movieId, providers, region) {
  const card = commonGrid?.querySelector(`[data-movie-id="${CSS.escape(movieId)}"]`);
  if (!card) return;

  const infoEl = card.querySelector('.movie-info');
  if (!infoEl) return;

  let existingRow = infoEl.querySelector('.movie-providers-row');
  if (existingRow) existingRow.remove();

  const row = document.createElement('div');
  row.className = 'movie-providers-row';

  if (providers && providers.length > 0) {
    // Show top 4 provider icons max on card
    const topProviders = providers.slice(0, 4);
    row.innerHTML = topProviders.map(p => {
      if (p.logo_path) {
        return `<img class="movie-provider-icon" src="${escapeAttr(p.logo_path)}" alt="${escapeAttr(p.provider_name)}" title="${escapeAttr(p.provider_name)}" loading="lazy" />`;
      }
      return '';
    }).join('');
  } else {
    row.innerHTML = `<span class="movie-no-stream-badge">${t('stream.not_available', { region })}</span>`;
  }

  infoEl.appendChild(row);
}

/**
 * Renders interactive filter chips
 */
function renderStreamingFilterChips(providers) {
  if (!streamingChipsContainer) return;
  streamingChipsContainer.innerHTML = '';

  if (providers.length === 0) {
    streamingChipsContainer.innerHTML = `<span class="movie-no-stream-badge" style="font-size:0.8rem;color:var(--text-muted);">${t('stream.not_available', { region: tmdbConfig.region })}</span>`;
    return;
  }

  // Sort providers by count descending, then name
  providers.sort((a, b) => b.count - a.count || a.provider_name.localeCompare(b.provider_name));

  // "All" chip
  const allChip = document.createElement('button');
  allChip.className = `stream-chip ${state.selectedProviders.size === 0 ? 'active' : ''}`;
  allChip.id = 'stream-chip-all';
  allChip.innerHTML = `
    <span>${t('stream.all_platforms')}</span>
    <span class="stream-chip-count">${state.lastResults?.common?.length || 0}</span>
  `;
  allChip.addEventListener('click', () => {
    state.selectedProviders.clear();
    applyStreamingFilter();
  });
  streamingChipsContainer.appendChild(allChip);

  // Platform chips
  providers.forEach(p => {
    const isSelected = state.selectedProviders.has(p.provider_id);
    const chip = document.createElement('button');
    chip.className = `stream-chip ${isSelected ? 'active' : ''}`;
    chip.dataset.providerId = p.provider_id;
    chip.innerHTML = `
      ${p.logo_path ? `<img class="stream-chip-logo" src="${escapeAttr(p.logo_path)}" alt="${escapeAttr(p.provider_name)}" />` : ''}
      <span>${escapeHtml(p.provider_name)}</span>
      <span class="stream-chip-count">${p.count}</span>
    `;

    chip.addEventListener('click', () => {
      if (state.selectedProviders.has(p.provider_id)) {
        state.selectedProviders.delete(p.provider_id);
      } else {
        state.selectedProviders.add(p.provider_id);
      }
      applyStreamingFilter();
    });

    streamingChipsContainer.appendChild(chip);
  });
}

/**
 * Applies client-side filtering to the common movies grid based on selected platforms
 */
function applyStreamingFilter() {
  const chips = streamingChipsContainer?.querySelectorAll('.stream-chip');
  chips?.forEach(chip => {
    if (chip.id === 'stream-chip-all') {
      chip.classList.toggle('active', state.selectedProviders.size === 0);
    } else {
      const pid = Number(chip.dataset.providerId);
      chip.classList.toggle('active', state.selectedProviders.has(pid));
    }
  });

  const cards = commonGrid?.querySelectorAll('.movie-card');
  if (!cards) return;

  let visibleCount = 0;
  cards.forEach(card => {
    const movieId = card.dataset.movieId;
    const movieData = state.commonProvidersMap[movieId];
    const movieProviders = movieData?.providers || [];

    let show = false;
    if (state.selectedProviders.size === 0) {
      show = true;
    } else {
      // Show if movie has ANY of the selected providers (OR logic)
      show = movieProviders.some(p => state.selectedProviders.has(p.provider_id));
    }

    if (show) {
      card.classList.remove('hidden');
      visibleCount++;
    } else {
      card.classList.add('hidden');
    }
  });

  // Handle empty state when filter excludes all movies
  if (visibleCount === 0 && cards.length > 0) {
    if (commonEmpty) {
      commonEmpty.classList.remove('hidden');
      if (commonEmptyTitle) commonEmptyTitle.textContent = t('stream.no_matches_filter');
      if (commonEmptyDesc) commonEmptyDesc.textContent = '';
    }
  } else if (cards.length > 0) {
    if (commonEmpty) commonEmpty.classList.add('hidden');
  }
}

/**
 * Enriches a grid already rendered with real posters, with limited concurrency
 * (3 at a time) to avoid saturating CORS proxies.
 */
async function enrichGridPosters(movies, gridEl, maxConcurrent = 3) {
  const queue = movies.filter(m => !m.poster && m.link);
  if (queue.length === 0) return;

  let active = 0, idx = 0;
  return new Promise(resolve => {
    function next() {
      if (idx >= queue.length && active === 0) return resolve();
      while (active < maxConcurrent && idx < queue.length) {
        const movie = queue[idx++];
        active++;
        enrichMovieMeta(movie).then(meta => {
          active--;
          if (meta.poster) movie.poster = meta.poster;
          if (meta.description) movie.description = meta.description;
          if (meta.rating != null) movie.rating = meta.rating;

          if (meta.poster) {
            const card = gridEl.querySelector(`[data-movie-id="${CSS.escape(movie.id)}"]`);
            const wrap = card?.querySelector('.movie-poster-wrap');
            if (wrap) {
              wrap.innerHTML = `
                <img class="movie-poster" src="${escapeAttr(meta.poster)}" alt="Póster de ${escapeHtml(movie.title)}" loading="lazy" onerror="posterFallback(this)" />
                <div class="movie-hover-overlay"><span class="overlay-btn">Ver detalles →</span></div>`;
            }
          }
          next();
        });
      }
    }
    next();
  });
}

/**
 * Convert a 0–5 numeric rating to a string of filled/half/empty stars.
 */
function ratingToStars(rating) {
  if (rating === null || rating === undefined) return null;
  const val = Math.round(rating * 2) / 2; // round to nearest 0.5
  const full = Math.floor(val);
  const half = val % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

/**
 * Render the Top 5 card batch into the grid.
 */
function renderTop5Cards(movies) {
  const grid = top5Grid();
  grid.innerHTML = '';

  movies.forEach((movie) => {
    const card = document.createElement('div');
    card.className = 'top5-card';
    card.dataset.id = movie.id;
    card.setAttribute('role', 'article');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', t('top5.card_aria', { title: movie.title, year: movie.year ? ` (${movie.year})` : '' }));

    // Poster
    const posterHtml = movie.poster
      ? `<img class="top5-poster-img" src="${escapeAttr(movie.poster)}" alt="${escapeAttr(t('results.poster_alt', { title: movie.title }))}" loading="eager" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('afterbegin','<div class=top5-poster-placeholder><svg width=36 height=36 viewBox=\\'0 0 24 24\\' fill=none stroke=currentColor stroke-width=1.5><rect x=2 y=2 width=20 height=20 rx=3/><path d=\\'M8 10l8 0M8 14l4 0\\'/></svg><span>${escapeHtml(t('results.no_poster'))}</span></div>')" />`
      : `<div class="top5-poster-placeholder">
           <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
             <rect x="2" y="2" width="20" height="20" rx="3"/><path d="M8 10l8 0M8 14l4 0"/>
           </svg>
           <span>${t('results.no_poster')}</span>
         </div>`;

    // Stars & synopsis
    const stars = ratingToStars(movie.rating);
    const starsHtml = stars
      ? `<div class="top5-stars">${escapeHtml(stars)} <span class="top5-rating-num">${movie.rating?.toFixed(1)}</span></div>`
      : `<div class="top5-rating-num">${t('top5.no_rating')}</div>`;

    const synopsisText = movie.description || t('top5.no_synopsis');

    // Providers for this movie
    const pData = state.commonProvidersMap[movie.id]?.providers || [];
    const region = tmdbConfig.region;
    let providerIconsHtml = '';
    if (pData.length > 0) {
      providerIconsHtml = `
        <div class="top5-card-providers">
          ${pData.slice(0, 4).map(p => p.logo_path ? `<img class="top5-provider-icon" src="${escapeAttr(p.logo_path)}" alt="${escapeAttr(p.provider_name)}" title="${escapeAttr(p.provider_name)}" />` : '').join('')}
        </div>
      `;
    }

    card.innerHTML = `
      <div class="top5-poster-wrap">
        ${posterHtml}
        <button class="top5-eliminate-btn" data-id="${escapeAttr(movie.id)}" aria-label="${escapeAttr(t('top5.btn_eliminate_aria', { title: movie.title }))}" tabindex="0">×</button>
      </div>
      <div class="top5-card-info">
        <div class="top5-card-title">${escapeHtml(movie.title)}</div>
        <div class="top5-meta-row">
          ${movie.year ? `<span class="top5-card-year">${movie.year}</span>` : ''}
          ${starsHtml}
        </div>
        ${providerIconsHtml}
        <p class="top5-card-synopsis">${escapeHtml(synopsisText)}</p>
      </div>
    `;

    // Soporte accesible de teclado por tarjeta
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace' || e.key === ' ') {
        e.preventDefault();
        eliminateTop5Card(movie.id);
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        focusNextTop5Card(card, 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        focusNextTop5Card(card, -1);
      }
    });

    grid.appendChild(card);
  });

  // Foco inicial en la primera tarjeta para accesibilidad
  setTimeout(() => {
    const firstCard = grid.querySelector('.top5-card');
    if (firstCard) firstCard.focus();
  }, 100);
}

function focusNextTop5Card(currentCard, direction = 1) {
  const cards = [...top5Grid().querySelectorAll('.top5-card:not(.eliminating)')];
  if (cards.length === 0) return;
  const currentIdx = cards.indexOf(currentCard);
  if (currentIdx === -1) {
    cards[0]?.focus();
    return;
  }
  const nextIdx = (currentIdx + direction + cards.length) % cards.length;
  cards[nextIdx]?.focus();
}

/**
 * Animate a card out, remove it, and check for winner.
 */
function eliminateTop5Card(movieId) {
  const card = top5Grid().querySelector(`[data-id="${CSS.escape(movieId)}"]`);
  if (!card || card.classList.contains('eliminating')) return;

  // Desplazar el foco a la siguiente tarjeta antes de eliminar
  const remainingCards = [...top5Grid().querySelectorAll('.top5-card:not(.eliminating)')].filter(c => c !== card);
  if (remainingCards.length > 0) {
    remainingCards[0].focus();
  }

  card.classList.add('eliminating');
  setTimeout(() => {
    card.remove();
    top5State.remaining -= 1;
    updateTop5Counter();

    if (top5State.remaining === 1) {
      showTop5Winner();
    }
  }, 500);
}

/**
 * Mark the last remaining card as winner and show the banner.
 */
function showTop5Winner() {
  const grid = top5Grid();
  const remainingCard = grid.querySelector('.top5-card:not(.eliminating)');
  if (!remainingCard) return;

  remainingCard.classList.add('winner');
  // Scroll winner into view
  remainingCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  // Find the movie data
  const winnerData = top5State.current.find(m => m.id === remainingCard.dataset.id);

  // Winner banner
  const banner = top5WinnerBanner();
  if (winnerData) {
    winnerMovieName().textContent = `"${winnerData.title}${winnerData.year ? ` (${winnerData.year})` : ''}"`;
    winnerLbLink().href = winnerData.link || '#';
  }
  banner.classList.remove('hidden');

  // Counter message
  top5Counter().innerHTML = `🏆 ${t('top5.winner_heading')}`;

  // Confetti!
  launchConfetti();
}

/**
 * Update the remaining count display.
 */
function updateTop5Counter() {
  const el = top5Remaining();
  const counter = top5Counter();
  if (el) el.textContent = top5State.remaining;
  if (counter && !counter.textContent.includes('🏆')) {
    counter.innerHTML = t('top5.remaining', { count: top5State.remaining });
  }
}

// ─── CONFETTI ────────────────────────────────────────────────────────────────

function launchConfetti() {
  const canvas = top5ConfettiCvs();
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#f4a535', '#00c774', '#f97316', '#5b8def', '#e879f9', '#f43f5e'];
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    speed: Math.random() * 3 + 1.5,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    opacity: 1,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }));

  let startTime = null;
  const DURATION = 5000; // ms

  function draw(ts) {
    if (!startTime) startTime = ts;
    const elapsed = ts - startTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let alive = false;
    particles.forEach(p => {
      p.y += p.speed;
      p.x += Math.sin(p.angle) * 0.8;
      p.angle += p.spin;
      p.opacity = elapsed < DURATION ? 1 : Math.max(0, 1 - (elapsed - DURATION) / 800);

      if (p.y < canvas.height + 20) alive = true;
      if (p.y > canvas.height + 10) {
        // reset to top (loop for 5s)
        if (elapsed < DURATION) {
          p.y = -10;
          p.x = Math.random() * canvas.width;
          p.speed = Math.random() * 3 + 1.5;
          alive = true;
        }
      }

      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      if (p.shape === 'rect') {
        ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 1.6);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    if (alive && elapsed < DURATION + 800) {
      top5State.confettiAnim = requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      top5State.confettiAnim = null;
    }
  }

  stopConfetti();
  top5State.confettiAnim = requestAnimationFrame(draw);
}

function stopConfetti() {
  if (top5State.confettiAnim) {
    cancelAnimationFrame(top5State.confettiAnim);
    top5State.confettiAnim = null;
  }
  const canvas = top5ConfettiCvs();
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

// ─── MISC HELPERS ─────────────────────────────────────────────────────────────

/**
 * Decode basic HTML entities that may appear in og: meta content attributes.
 */
function decodeHtmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// ─── UI HELPERS ───────────────────────────────────────────────────────────────

function showLoading() {
  loadingSection.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  errorBanner.classList.add('hidden');
}

function hideLoading() {
  loadingSection.classList.add('hidden');
  const liveBanner = $('#proxy-live-banner');
  if (liveBanner) liveBanner.classList.add('hidden');
}

function updateLoadingMessage(msg) {
  loadingMessage.textContent = msg;
}

function showError(msg) {
  errorBanner.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0;margin-top:1px">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
    <span>${msg}</span>
  `;
  errorBanner.classList.remove('hidden');
}

function hideError() {
  errorBanner.classList.add('hidden');
  errorBanner.innerHTML = '';
}


// ─── SECURITY HELPERS ─────────────────────────────────────────────────────────

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return str.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ─── MISC ─────────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── KICK OFF ────────────────────────────────────────────────────────────────

init();
