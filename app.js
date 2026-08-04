/* ================================================================
   LETTERBOXD MATCH — app.js
   Pure vanilla JS · No dependencies · GitHub Pages ready
   ================================================================ */

'use strict';

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
const PROXIES = [
  // ── Tier 1: Most reliable ─────────────────────────────────────────────────
  { url: 'https://api.allorigins.win/get?url=',           mode: 'json-contents' },
  { url: 'https://api.allorigins.win/raw?url=',           mode: 'text' },
  // ── Tier 2: Good alternatives ─────────────────────────────────────────────
  { url: 'https://proxy.cors.sh/',                        mode: 'text' },
  { url: 'https://api.cors.lol/?url=',                    mode: 'text' },
  // ── Tier 3: Fallbacks ─────────────────────────────────────────────────────
  { url: 'https://corsproxy.io/?',                        mode: 'text' },
  { url: 'https://thingproxy.freeboard.io/fetch/',        mode: 'text' },
  { url: 'https://corsproxy.org/?',                       mode: 'text' },
];

/**
 * Films per page Letterboxd uses:
 * - Watchlist pages: 28 films per page (the default grid)
 * - Custom list pages: up to 100 films per page
 * We use 28 as the conservative threshold; if a page has >= 28 items we try next page.
 */
const FILMS_PER_PAGE_WATCHLIST = 28;
const FILMS_PER_PAGE_LIST      = 72;
const MAX_USERS = 5;
const MIN_USERS = 2;

// ─── STATE ──────────────────────────────────────────────────────────────────

const state = {
  sourceMode: 'watchlist', // 'watchlist' | 'list'
  userCount: 2,
  lastResults: null,
  sortCommonAsc: true,
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

const usersContainer   = $('#users-container');
const btnAddUser       = $('#btn-add-user');
const btnCompare       = $('#btn-compare');
const errorBanner      = $('#error-banner');
const loadingSection   = $('#loading-section');
const loadingMessage   = $('#loading-message');
const resultsSection   = $('#results-section');
const statsBar         = $('#stats-bar');
const commonGrid       = $('#common-grid');
const commonCount      = $('#common-count');
const commonEmpty      = $('#common-empty');
const uniqueTabs       = $('#unique-tabs');
const uniquePanels     = $('#unique-panels');
const movieModal       = $('#movie-modal');
const modalContent     = $('#modal-content');
const modalCloseBtn    = $('#modal-close-btn');
const btnSortCommon    = $('#btn-sort-common');

// ── Top 5 Eliminator DOM refs (resolved lazily so they exist after HTML parse) ──
const top5Overlay      = () => $('#top5-overlay');
const top5Grid         = () => $('#top5-grid');
const top5Loading      = () => $('#top5-loading');
const top5LoadingMsg   = () => $('#top5-loading-msg');
const top5Counter      = () => $('#top5-counter');
const top5Remaining    = () => $('#top5-remaining');
const top5WinnerBanner = () => $('#top5-winner-banner');
const top5ConfettiCvs  = () => $('#top5-confetti');
const winnerMovieName  = () => $('#winner-movie-name');
const winnerLbLink     = () => $('#winner-lb-link');

// ─── INIT ────────────────────────────────────────────────────────────────────

function init() {
  buildUserRows(MIN_USERS);
  setupEventListeners();
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
  // Both modes now accept full URLs
  const placeholder = isListMode
    ? `https://letterboxd.com/usuario/list/nombre-lista/`
    : `https://letterboxd.com/usuario/watchlist/`;

  row.innerHTML = `
    <span class="user-index" aria-label="Usuario ${index}">${index}</span>
    <input
      type="url"
      class="user-input is-list-url"
      id="user-input-${index}"
      placeholder="${placeholder}"
      autocomplete="off"
      spellcheck="false"
      aria-label="URL de ${isListMode ? 'lista' : 'watchlist'} para usuario ${index}"
    />
    <button class="btn-remove" data-row="${index}" aria-label="Eliminar usuario ${index}" ${index <= MIN_USERS ? 'disabled' : ''}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M18 6 6 18M6 6l12 12"/>
      </svg>
    </button>
  `;

  usersContainer.appendChild(row);
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
    const idx = row.querySelector('.user-index');
    const inp = row.querySelector('.user-input');
    const btn = row.querySelector('.btn-remove');
    if (idx) { idx.textContent = n; idx.setAttribute('aria-label', `Usuario ${n}`); }
    if (inp) {
      inp.id = `user-input-${n}`;
      inp.setAttribute('aria-label', `URL de ${state.sourceMode === 'list' ? 'lista' : 'watchlist'} para usuario ${n}`);
    }
    if (btn) {
      btn.dataset.row = n;
      btn.disabled = n <= MIN_USERS;
    }
  });
  state.userCount = rows.length;
}

function updateAddButton() {
  const count = $$('.user-row', usersContainer).length;
  btnAddUser.disabled = count >= MAX_USERS;
  btnAddUser.style.opacity = count >= MAX_USERS ? '0.4' : '1';
}

function switchSourceMode(mode) {
  state.sourceMode = mode;
  const values = collectInputValues();
  usersContainer.innerHTML = '';
  const count = values.length > 0 ? values.length : MIN_USERS;
  for (let i = 0; i < count; i++) addUserRow(i + 1);

  // Try to restore previous URL values when switching modes
  values.forEach((v, i) => {
    const inp = $(`#user-input-${i + 1}`);
    // Keep if it's a letterboxd.com URL
    if (inp && v && v.includes('letterboxd.com')) inp.value = v;
  });

  updateAddButton();
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
      $(`#user-input-${count + 1}`)?.focus();
    }
  });

  // Remove user (event delegation)
  usersContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-remove');
    if (btn) removeUserRow(Number(btn.dataset.row));
  });

  // Compare
  btnCompare.addEventListener('click', handleCompare);

  // Enter key on inputs triggers compare
  usersContainer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleCompare();
  });

  // Sort common
  btnSortCommon.addEventListener('click', () => {
    state.sortCommonAsc = !state.sortCommonAsc;
    if (state.lastResults) renderCommonMovies(state.lastResults.common);
  });

  // Modal close
  modalCloseBtn.addEventListener('click', closeModal);
  movieModal.addEventListener('click', (e) => {
    if (e.target === movieModal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeTop5();
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
  const inputs = collectInputValues();

  if (inputs.length < MIN_USERS) {
    showError(`⚠️ Necesitás ingresar al menos ${MIN_USERS} URLs de Letterboxd.`);
    return;
  }

  // Validate: both modes now require valid Letterboxd URLs
  const invalid = inputs.filter(u => !isValidLetterboxdUrl(u));
  if (invalid.length) {
    showError(
      `⚠️ URL(s) inválida(s): ${invalid.join(', ')}. ` +
      (state.sourceMode === 'watchlist'
        ? 'Usá el formato: https://letterboxd.com/usuario/watchlist/'
        : 'Usá el formato: https://letterboxd.com/usuario/list/nombre-lista/')
    );
    return;
  }

  showLoading();
  btnCompare.disabled = true;

  try {
    const pageUrls = inputs.map(input => normalizePageUrl(input));
    const userLabels = inputs.map(input => extractLabel(input));

    updateLoadingMessage(`Obteniendo datos de ${inputs.length} lista(s)…`);

    const results = await Promise.allSettled(pageUrls.map((url, i) =>
      fetchAndParseList(url, userLabels[i])
    ));


    const successful = [];
    const failed = [];
    const failReasons = [];

    results.forEach((result, i) => {
      if (result.status === 'fulfilled' && result.value) {
        successful.push({ label: userLabels[i], movies: result.value });
      } else {
        failed.push(userLabels[i]);
        failReasons.push(result.reason?.message || 'Error desconocido');
        console.error(`Failed user ${userLabels[i]}:`, result.reason);
      }
    });

    if (successful.length < MIN_USERS) {
      const detail = failReasons.length ? `\n\nDetalle: ${failReasons.join(' | ')}` : '';
      throw new Error(
        `No se pudieron obtener datos de suficientes listas. Fallaron: ${failed.join(', ')}.\n` +
        `Verificá que las URLs sean correctas, que las listas sean públicas y que el usuario exista en Letterboxd.` +
        detail
      );
    }

    if (failed.length > 0) {
      showError(`⚠️ No se pudieron cargar los datos de: ${failed.join(', ')}. Los resultados son parciales.`);
    }

    updateLoadingMessage('Calculando coincidencias…');
    await sleep(300);

    const comparison = computeComparison(successful);
    state.lastResults = { comparison, userLabels: successful.map(s => s.label), common: comparison.common };

    renderResults(comparison, successful.map(s => s.label));
  } catch (err) {
    console.error('[handleCompare]', err);
    showError(`❌ ${err.message}`);
    hideLoading();
  } finally {
    btnCompare.disabled = false;
    hideLoading();
  }
}

// ─── URL NORMALIZER ───────────────────────────────────────────────────────────

/**
 * Normalize a Letterboxd page URL (watchlist or list).
 * Strips any trailing /rss/ or /page/N/ suffixes and ensures a clean base URL.
 * Examples:
 *   https://letterboxd.com/user/list/mi-lista/      → kept as-is
 */
function normalizePageUrl(input) {
  let url = input.trim();
  if (!url.endsWith('/')) url += '/';
  // Remove any /rss/ or /page/N/ if user accidentally pasted that
  url = url.replace(/\/rss\/$/, '/').replace(/\/page\/\d+\/$/, '/');
  return url;
}

function extractLabel(input) {
  try {
    const u = new URL(input);
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || input;
  } catch { return input; }
}

// ─── HTML SCRAPING FETCH ──────────────────────────────────────────────────────

/**
 * Fetch a Letterboxd list/watchlist page via CORS proxy and extract movie data
 * by parsing the HTML DOM (data-film-slug attributes on .film-poster elements).
 *
 * Handles pagination automatically: fetches /page/1/, /page/2/, … until empty.
 */
/**
 * Fetch all pages of a Letterboxd watchlist or list via CORS proxies.
 *
 * Strategy:
 *   1. For each page, try all proxies in order until one succeeds.
 *   2. Parse the HTML with parseHtmlFilmPosters().
 *   3. If a page returns fewer films than expected, it's the last page.
 *   4. Watchlist pages have 28 films each; list pages can have up to 100.
 *      We detect the per-page count from the first page and use it as threshold.
 */
async function fetchAndParseList(baseUrl, label) {
  const errors = [];
  const allMovies = [];
  let page = 1;
  let hasMore = true;
  let perPage = null; // auto-detected after first successful page

  while (hasMore && page <= 30) { // max 30 pages = up to ~2100 films (generous cap)
    const pageUrl = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    let html = null;

    updateLoadingMessage(`Obteniendo datos de "${label}" — página ${page}…`);

    // Try each proxy in sequence
    for (const proxy of PROXIES) {
      try {
        const proxyUrl = `${proxy.url}${encodeURIComponent(pageUrl)}`;
        console.log(`[${label}] p${page} via ${proxy.url}`);
        const resp = await fetchWithTimeout(proxyUrl, 25000);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        if (proxy.mode === 'json-contents') {
          const data = await resp.json();
          if (!data.contents) throw new Error('Empty contents from proxy');
          html = data.contents;
        } else {
          html = await resp.text();
        }

        // Sanity-check: make sure we got actual Letterboxd HTML and not a proxy error
        if (!html || html.trim().length < 500) throw new Error('Response too short — likely a proxy error page');
        if (!html.includes('letterboxd') && !html.includes('griditem') && !html.includes('film')) {
          throw new Error('Response does not look like Letterboxd HTML');
        }
        console.log(`[${label}] p${page} ✅ ${html.length} chars via ${proxy.url}`);
        break; // success — stop trying proxies
      } catch (err) {
        console.warn(`[${label}] p${page} proxy ${proxy.url} failed: ${err.message}`);
        errors.push(`p${page}@${proxy.url.split('/')[2]}: ${err.message}`);
        html = null;
      }
    }

    if (!html) {
      if (page === 1) {
        // All proxies failed on the first page — this is a fatal error
        throw new Error(
          `No se pudo acceder a "${label}".\n` +
          `Verificá que la URL sea correcta y que la lista/watchlist sea pública.\n` +
          `Probamos ${PROXIES.length} proxies CORS y todos fallaron:\n` +
          `${errors.slice(-PROXIES.length).map(e => `  • ${e}`).join('\n')}\n\n` +
          `💡 Si usás Opera GX, Brave u otro navegador con bloqueador de anuncios integrado, ` +
          `probá desactivar el bloqueador para esta página (ícono de escudo en la barra de direcciones).`
        );
      }
      // Subsequent page failed — assume we've reached the end
      console.warn(`[${label}] p${page} all proxies failed, stopping pagination.`);
      break;
    }

    const movies = parseHtmlFilmPosters(html, label);

    if (movies.length === 0) {
      // Empty page means we've gone past the last page
      hasMore = false;
    } else {
      allMovies.push(...movies);

      // Auto-detect items per page from the first page result.
      // Letterboxd watchlists show 28 per page; custom lists can show up to 100.
      if (perPage === null) {
        // Snap to the nearest expected page size
        if (movies.length <= 28) {
          perPage = FILMS_PER_PAGE_WATCHLIST;
        } else if (movies.length <= 72) {
          perPage = 72;
        } else {
          perPage = movies.length; // very large list page — use as-is
        }
        console.log(`[${label}] Auto-detected perPage = ${perPage} (got ${movies.length} on p1)`);
      }

      if (movies.length < perPage) {
        // Fewer items than a full page → this was the last page
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
  return allMovies;
}

/**
 * Fetch with timeout using Promise.race().
 *
 * We avoid AbortController because some browsers (Opera GX, older Safari)
 * report "signal is aborted without reason" even for valid requests when
 * their built-in tracker blocker interferes with the AbortController signal.
 * Promise.race() is universally supported and avoids this issue.
 */
function fetchWithTimeout(url, timeout = 25000) {
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

    // ── Poster image ──────────────────────────────────────────────────────────
    const img = el.querySelector('img');
    let poster = img?.getAttribute('src') || img?.getAttribute('data-src') || null;
    if (poster && (
      poster.includes('empty.png') ||
      poster.includes('avatar') ||
      poster.startsWith('data:') ||
      poster.includes('35x50') // Letterboxd tiny placeholder
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
      <strong>${common.length}</strong> en común
    </div>
    <div class="stat-chip">
      <span class="dot dot-blue"></span>
      <strong>${totalMovies}</strong> películas totales
    </div>
    ${allUsers.map(u => `
      <div class="stat-chip">
        <span class="dot dot-orange"></span>
        <strong>${uniqueByUser[u]?.length ?? 0}</strong> únicas de <strong>${u}</strong>
      </div>
    `).join('')}
    <button
      id="btn-open-top5"
      class="btn-top5-trigger"
      ${!hasCommon ? 'disabled' : ''}
      title="${hasCommon ? 'Modo eliminación: elegí la película de la noche' : 'Necesitás películas en común para usar el Top 5'}"
    >
      🎲 Top 5 Eliminator
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
}

function renderUniqueTabs(uniqueByUser, allUsers) {
  uniqueTabs.innerHTML = '';
  uniquePanels.innerHTML = '';

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
    tab.setAttribute('aria-controls', `panel-${i}`);
    tab.id = `tab-${i}`;
    tab.addEventListener('click', () => switchTab(i));
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
}

// ─── MOVIE CARD ───────────────────────────────────────────────────────────────

function createMovieCard(movie, index, isCommon) {
  const card = document.createElement('div');
  card.className = 'movie-card';
  card.style.animationDelay = `${Math.min(index * 0.04, 0.5)}s`;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `${movie.title}${movie.year ? ` (${movie.year})` : ''}`);

  const posterHtml = movie.poster
    ? `<img class="movie-poster" src="${escapeAttr(movie.poster)}" alt="Póster de ${escapeHtml(movie.title)}" loading="lazy" onerror="this.parentNode.innerHTML=posterFallback()" />`
    : `<div class="movie-poster-placeholder">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="2" y="2" width="20" height="20" rx="3"/>
          <path d="M8 10l8 0M8 14l4 0"/>
        </svg>
        <span>Sin póster</span>
       </div>`;

  card.innerHTML = `
    <div class="movie-poster-wrap">
      ${posterHtml}
      <div class="movie-hover-overlay">
        <span class="overlay-btn">Ver detalles →</span>
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
  const posterHtml = movie.poster
    ? `<img src="${escapeAttr(movie.poster)}" alt="Póster" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />`
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:.75rem;">Sin póster</div>`;

  modalContent.innerHTML = `
    <div class="modal-movie-inner">
      <div class="modal-poster">${posterHtml}</div>
      <div class="modal-details">
        <h2 class="modal-title" id="modal-title">${escapeHtml(movie.title)}</h2>
        ${movie.year ? `<div class="modal-year">${movie.year}</div>` : ''}
        ${movie.description ? `<p class="modal-desc">${escapeHtml(movie.description.slice(0, 220))}${movie.description.length > 220 ? '…' : ''}</p>` : ''}
        <a class="modal-link" href="${escapeAttr(movie.link)}" target="_blank" rel="noopener noreferrer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Ver en Letterboxd
        </a>
        ${isCommon && movie.foundIn ? `
          <div class="modal-users-found">
            <strong>Está en la lista de:</strong> ${movie.foundIn.map(u => escapeHtml(u)).join(', ')}
          </div>
        ` : ''}
      </div>
    </div>
  `;

  movieModal.classList.remove('hidden');
  movieModal.removeAttribute('aria-hidden');
  modalCloseBtn.focus();
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  movieModal.classList.add('hidden');
  movieModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// ─── TOP 5 ELIMINATOR ────────────────────────────────────────────────────────

/**
 * Opens the Top 5 overlay and starts a new round with the common movies pool.
 */
function openTop5() {
  if (!state.lastResults) return;
  const pool = state.lastResults.common || [];
  if (pool.length === 0) return;

  top5State.pool = pool;
  top5Overlay().classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  initTop5(pool);
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
  const result = { poster: movie.poster || null, description: movie.description || '', rating: null };
  try {
    let html = null;
    for (const proxy of PROXIES) {
      try {
        const proxyUrl = `${proxy.url}${encodeURIComponent(movie.link)}`;
        const resp = await fetchWithTimeout(proxyUrl, 20000);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        if (proxy.mode === 'json-contents') {
          const data = await resp.json();
          if (!data.contents) throw new Error('Empty contents');
          html = data.contents;
        } else {
          html = await resp.text();
        }
        if (!html || html.trim().length < 500) throw new Error('Response too short');
        break;
      } catch { html = null; }
    }

    if (!html) return result;

    // ── og:image → real poster ──────────────────────────────────────────────
    const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      const imgUrl = ogImageMatch[1];
      if (!imgUrl.includes('empty') && !imgUrl.startsWith('data:')) {
        result.poster = imgUrl;
      }
    }

    // ── og:description → synopsis ──────────────────────────────────────────
    if (!result.description) {
      const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
                        || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
      if (ogDescMatch && ogDescMatch[1]) {
        result.description = decodeHtmlEntities(ogDescMatch[1].trim());
      }
    }

    // ── Average rating ─────────────────────────────────────────────────────
    // Letterboxd renders: <a class="display-rating" ...>3.8</a>
    // or <meta itemprop="ratingValue" content="3.8">
    const ratingMatch = html.match(/itemprop=["']ratingValue["'][^>]+content=["']([\d.]+)["']/i)
                      || html.match(/class=["'][^"']*display-rating[^"']*["'][^>]*>([\d.]+)/i);
    if (ratingMatch && ratingMatch[1]) {
      const raw = parseFloat(ratingMatch[1]);
      if (!isNaN(raw) && raw >= 0) result.rating = raw;
    }

  } catch (err) {
    console.warn('[enrichMovieMeta]', movie.id, err.message);
  }
  return result;
}

/**
 * Convert a 0–5 numeric rating to a string of filled/half/empty stars.
 */
function ratingToStars(rating) {
  if (rating === null || rating === undefined) return null;
  const val = Math.round(rating * 2) / 2; // round to nearest 0.5
  const full  = Math.floor(val);
  const half  = val % 1 >= 0.5 ? 1 : 0;
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
    card.setAttribute('role', 'listitem');

    // Poster
    const posterHtml = movie.poster
      ? `<img class="top5-poster-img" src="${escapeAttr(movie.poster)}" alt="Póster de ${escapeHtml(movie.title)}" loading="eager" onerror="this.style.display='none';this.parentNode.insertAdjacentHTML('afterbegin','<div class=top5-poster-placeholder><svg width=36 height=36 viewBox=\'0 0 24 24\' fill=none stroke=currentColor stroke-width=1.5><rect x=2 y=2 width=20 height=20 rx=3/><path d=\'M8 10l8 0M8 14l4 0\'/></svg><span>Sin póster</span></div>')" />`
      : `<div class="top5-poster-placeholder">
           <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
             <rect x="2" y="2" width="20" height="20" rx="3"/><path d="M8 10l8 0M8 14l4 0"/>
           </svg>
           <span>Sin póster</span>
         </div>`;

    // Stars & synopsis
    const stars = ratingToStars(movie.rating);
    const starsHtml = stars
      ? `<div class="top5-stars">${escapeHtml(stars)}</div>
         <div class="top5-rating-label">${movie.rating?.toFixed(1)} / 5</div>`
      : `<div class="top5-rating-label" style="font-size:.7rem;">Sin calificación</div>`;

    const synopsis = movie.description
      ? `<div class="top5-synopsis">${escapeHtml(movie.description.slice(0, 260))}</div>`
      : `<div class="top5-synopsis" style="color:var(--text-muted);font-style:italic;">Sinopsis no disponible</div>`;

    card.innerHTML = `
      <div class="top5-poster-wrap">
        ${posterHtml}
        <div class="top5-info-overlay">
          ${starsHtml}
          ${synopsis}
        </div>
      </div>
      <div class="top5-card-info">
        <div class="top5-card-title">${escapeHtml(movie.title)}</div>
        ${movie.year ? `<div class="top5-card-year">${movie.year}</div>` : ''}
      </div>
      <button class="top5-eliminate-btn" data-id="${escapeAttr(movie.id)}" aria-label="Eliminar ${escapeHtml(movie.title)}">×</button>
    `;

    grid.appendChild(card);
  });
}

/**
 * Animate a card out, remove it, and check for winner.
 */
function eliminateTop5Card(movieId) {
  const card = top5Grid().querySelector(`[data-id="${CSS.escape(movieId)}"]`);
  if (!card || card.classList.contains('eliminating')) return;

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
    winnerMovieName().textContent = `"${winnerData.title}${winnerData.year ? ` (${winnerData.year})` : ''}"` ;
    winnerLbLink().href = winnerData.link || '#';
  }
  banner.classList.remove('hidden');

  // Counter message
  top5Counter().innerHTML = '🏆 ¡Tenemos ganadora!';

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
    counter.innerHTML = `<span>${top5State.remaining}</span> película(s) restante(s)`;
  }
}

// ─── CONFETTI ────────────────────────────────────────────────────────────────

function launchConfetti() {
  const canvas = top5ConfettiCvs();
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ['#f4a535', '#00c774', '#f97316', '#5b8def', '#e879f9', '#f43f5e'];
  const particles = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height - canvas.height,
    r: Math.random() * 6 + 3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    speed: Math.random() * 3 + 1.5,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.2,
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
    .replace(/&amp;/g,  '&')
    .replace(/&lt;/g,   '<')
    .replace(/&gt;/g,   '>')
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

// ─── VALIDATION ───────────────────────────────────────────────────────────────

/**
 * Validates any public Letterboxd URL (watchlist, list, films, etc.)
 * Both modes now require a full letterboxd.com URL.
 */
function isValidLetterboxdUrl(url) {
  try {
    const u = new URL(url.trim());
    return u.hostname === 'letterboxd.com' && u.pathname.length > 1;
  } catch { return false; }
}

// Kept for backwards compatibility but no longer used as primary validator
function isValidUsername(name) {
  return /^@?[a-zA-Z0-9._-]{1,60}$/.test(name.trim());
}

function isValidLetterboxdListUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === 'letterboxd.com' && u.pathname.includes('/list/');
  } catch { return false; }
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
