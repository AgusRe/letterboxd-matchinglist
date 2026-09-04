# Graph Report - letterboxd-matchinglist  (2026-09-04)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 214 nodes · 441 edges · 12 communities (11 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a46b275f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- app.js
- showTop5Setup
- t
- setupEventListeners
- handleCompare
- manifest.json
- proxy-server.js
- verify-bilingual.js
- i18n.js
- resolveMovieStreamingProviders
- parseHtmlFilmPosters

## God Nodes (most connected - your core abstractions)
1. `t()` - 27 edges
2. `setupEventListeners()` - 21 edges
3. `showTop5Setup()` - 20 edges
4. `handleCompare()` - 19 edges
5. `initTop5()` - 14 edges
6. `handleRetryUser()` - 11 edges
7. `updateCompareButtonState()` - 10 edges
8. `validateInputValue()` - 10 edges
9. `closeTop5()` - 9 edges
10. `renderTop5Cards()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `setupEventListeners()` --indirect_call--> `handleCopyShareLink()`  [INFERRED]
  app.js → app.js  _Bridges community 2 → community 3_
- `setupEventListeners()` --indirect_call--> `exportCommonMoviesToCsv()`  [INFERRED]
  app.js → app.js  _Bridges community 3 → community 4_
- `setupEventListeners()` --calls--> `closeTop5()`  [EXTRACTED]
  app.js → app.js  _Bridges community 1 → community 3_
- `initTop5()` --calls--> `enrichMovieMeta()`  [EXTRACTED]
  app.js → app.js  _Bridges community 1 → community 2_
- `fetchAndParseList()` --calls--> `parseHtmlFilmPosters()`  [EXTRACTED]
  app.js → app.js  _Bridges community 10 → community 4_

## Import Cycles
- None detected.

## Communities (12 total, 1 thin omitted)

### Community 0 - "app.js"
Cohesion: 0.03
Nodes (50): btnAddUser, btnClearHistory, btnClearInputs, btnCloseHistory, btnCompare, btnExportCsv, btnShareResults, btnSortCommon (+42 more)

### Community 1 - "showTop5Setup"
Cohesion: 0.10
Nodes (32): btnTop5Start(), closeTop5(), eliminateTop5Card(), focusNextTop5Card(), getAvailableCommonProvidersList(), initTop5(), launchConfetti(), openTop5() (+24 more)

### Community 2 - "t"
Cohesion: 0.14
Nodes (27): applyStreamingFilter(), createMovieCard(), decodeHtmlEntities(), enrichGridPosters(), next(), enrichMovieMeta(), escapeAttr(), escapeHtml() (+19 more)

### Community 3 - "setupEventListeners"
Cohesion: 0.22
Nodes (22): addUserRow(), applyValidationUI(), attachRowValidation(), buildUserRows(), clearAllRowStatuses(), closeHistoryPanel(), closeModal(), debounce() (+14 more)

### Community 4 - "handleCompare"
Cohesion: 0.13
Nodes (22): attemptProxy(), computeComparison(), exportCommonMoviesToCsv(), extractLabel(), fetchAndParseList(), fetchViaFastestProxy(), fetchWithTimeout(), handleCompare() (+14 more)

### Community 5 - "manifest.json"
Cohesion: 0.12
Nodes (15): background_color, categories, description, display, icons, lang, name, orientation (+7 more)

### Community 6 - "proxy-server.js"
Cohesion: 0.27
Nodes (10): fs, http, https, MIME_TYPES, path, proxyRequest(), server, serveStaticFile() (+2 more)

### Community 7 - "verify-bilingual.js"
Cohesion: 0.18
Nodes (9): enIndexHtml, fs, i18nJs, indexHtml, jsonLdEnMatch, jsonLdEsMatch, path, rootDir (+1 more)

### Community 8 - "i18n.js"
Cohesion: 0.40
Nodes (4): I18N, TODO: Si en el futuro se incorpora algún servicio de analítica web (ej. GA,…, TODO: If web analytics (e.g. GA, Plausible) is added in the future, update this…, TRANSLATIONS

### Community 9 - "resolveMovieStreamingProviders"
Cohesion: 0.67
Nodes (4): getTmdbFetchConfig(), getTmdbWatchProviders(), resolveMovieStreamingProviders(), searchTmdbMovie()

## Knowledge Gaps
- **80 isolated node(s):** `btnAddUser`, `btnClearHistory`, `btnClearInputs`, `btnCloseHistory`, `btnCompare` (+75 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `launchConfetti()` connect `showTop5Setup` to `app.js`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `t()` connect `t` to `app.js`, `showTop5Setup`, `setupEventListeners`, `handleCompare`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `showTop5Setup()` connect `showTop5Setup` to `app.js`, `t`?**
  _High betweenness centrality (0.004) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `setupEventListeners()` (e.g. with `closeHistoryPanel()` and `closeModal()`) actually correct?**
  _`setupEventListeners()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `btnAddUser`, `btnClearHistory`, `btnClearInputs` to the rest of the system?**
  _80 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.03333333333333333 - nodes in this community are weakly interconnected._
- **Should `showTop5Setup` be split into smaller, more focused modules?**
  _Cohesion score 0.10416666666666667 - nodes in this community are weakly interconnected._