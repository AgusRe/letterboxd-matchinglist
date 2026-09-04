/* ================================================================
   LETTERBOXD MATCHER — i18n.js
   Internationalization dictionary and helper (ES / EN)
   ================================================================ */

'use strict';

const TRANSLATIONS = {
  es: {
    // ── Input validation & row statuses ──
    "val.empty": "Ingresá un usuario o URL",
    "val.valid_user": "Usuario válido",
    "val.valid_list": "URL de lista válida",
    "val.invalid_url": "URL no reconocida o formato inválido",
    "val.invalid_user": "Usuario inválido (solo letras, números y guiones)",
    "val.min_users": "Mínimo 2 usuarios requeridos para comparar",
    "val.duplicate": "Este usuario o lista ya fue agregado",
    "val.fetching": "Obteniendo datos de Letterboxd…",
    "val.loading_user": "Cargando \"{label}\"…",
    "val.retrying_user": "Reintentando \"{label}\"…",
    "val.success": "✅ {count} películas cargadas",
    "val.error_fetch": "Error al obtener lista",
    "val.error_empty": "La lista está vacía o es privada",
    "val.error_cors": "Error de conexión/proxy",
    "val.stopped": "Búsqueda detenida por el usuario",
    "val.btn_retry": "Reintentar",
    "val.btn_remove": "Eliminar usuario {index}",
    "val.user_placeholder_watchlist": "Usuario o URL",
    "val.user_placeholder_list": "URL de lista de Letterboxd",
    "val.user_aria_input": "Usuario o lista {index}",

    // ── Proxy & connection status ──
    "proxy.label_ready": "Conexión: Lista",
    "proxy.label_connecting": "Conectando: {name} ({ms}ms)",
    "proxy.label_error": "Conexión: Fallback activo",
    "proxy.title": "Estado de conectividad y proxies CORS",
    "proxy.local_cache": "Caché local",
    "proxy.active_label": "Proxy activo: {name}",
    "proxy.connecting_user": "{user}: conectando vía {label}…",
    "proxy.connecting_general": "Conectando vía {label}…",
    "proxy.connected_user": "✅ {user}: datos recibidos vía {label} ({elapsed}ms)",
    "proxy.connected_general": "✅ Conectado vía {label} ({elapsed}ms)",

    // ── History panel ──
    "hist.title": "Comparaciones recientes",
    "hist.empty": "No hay comparaciones recientes.",
    "hist.clear_all": "Borrar todo el historial",
    "hist.load_aria": "Cargar comparación de {users}",
    "hist.remove_aria": "Eliminar comparación del historial",
    "hist.close_aria": "Cerrar historial",
    "hist.time_just_now": "hace un momento",
    "hist.time_minutes": "hace {n} min",
    "hist.time_hours": "hace {n} h",
    "hist.time_days": "hace {n} d",
    "hist.badge_common": "{count} en común",

    // ── Loading state ──
    "loading.default": "Obteniendo feeds de Letterboxd…",
    "loading.fetching_lists": "Obteniendo datos de {count} lista(s)…",
    "loading.parsing": "Analizando películas de {label}…",
    "loading.computing": "Calculando coincidencias…",

    // ── Results & stats bar ──
    "results.total_movies": "<strong>{count}</strong> películas totales",
    "results.unique_user": "<strong>{count}</strong> únicas de <strong>{user}</strong>",
    "results.top5_btn": "🎲 Top 5 Eliminator",
    "results.top5_title_enabled": "Modo eliminación: elegí la película de la noche",
    "results.top5_title_disabled": "Necesitás películas en común para usar el Top 5",
    "results.top5_aria": "Abrir modo interactivo Top 5 Eliminator para decidir qué película ver",
    "results.common_title": "Películas en Común",
    "results.unique_title": "Películas Únicas por Usuario",
    "results.no_common_title": "No encontramos películas en común.",
    "results.no_common_sub": "Probá con otros usuarios o diferentes listas.",
    "results.btn_export_csv": "Exportar CSV",
    "results.btn_copy_link": "Copiar link",
    "results.btn_copied": "¡Copiado! ✓",
    "results.btn_sort": "Ordenar películas",
    "results.view_details": "Ver detalles →",
    "results.no_poster": "Sin póster",
    "results.poster_alt": "Póster de {title}",
    "results.tab_aria": "Películas exclusivas de {user} ({count})",

    // ── Movie detail modal ──
    "modal.loading_rating": "Cargando calificación…",
    "modal.loading_desc": "Cargando sinopsis…",
    "modal.no_rating": "Sin calificación",
    "modal.view_letterboxd": "Ver en Letterboxd",
    "modal.found_in": "Está en la lista de:",
    "modal.close_aria": "Cerrar ventana de detalles de película",

    // ── Top 5 Eliminator ──
    "top5.heading": "Top 5 Eliminator",
    "top5.subtitle": "Eliminá hasta quedarte con <strong>1 sola película</strong> para ver esta noche",
    "top5.loading": "Cargando información de las películas…",
    "top5.remaining": "{count} película(s) restante(s)",
    "top5.winner_heading": "¡Esta es tu película para ver hoy!",
    "top5.btn_another_5": "Otras 5",
    "top5.btn_another_5_aria": "Probar con otras 5 películas candidatas",
    "top5.btn_close_aria": "Cerrar Top 5 Eliminator",
    "top5.btn_eliminate_aria": "Eliminar {title}",
    "top5.card_aria": "{title}{year}. Presioná Supr, Retroceso o Espacio para eliminar.",
    "top5.no_rating": "Sin calificación",
    "top5.no_synopsis": "Sinopsis no disponible",
    "top5.setup_title": "¿Filtrar películas por Streaming para el Top 5?",
    "top5.setup_desc": "Elegí si querés jugar el Top 5 con todas las películas en común o solo con las disponibles en plataformas específicas.",
    "top5.setup_all_opt": "🎲 Todas las películas ({count})",
    "top5.setup_all_desc": "Sin restricción de streaming",
    "top5.setup_stream_opt": "📺 Solo con plataformas seleccionadas ({count})",
    "top5.setup_stream_desc": "Elegí las plataformas que tienen disponibles hoy",
    "top5.setup_btn_start": "Comenzar Eliminator →",
    "top5.setup_no_matches": "No hay películas para la combinación de plataformas seleccionada.",

    // ── CSV Export ──
    "csv.col_title": "Título",
    "csv.col_year": "Año",
    "csv.col_letterboxd_url": "URL Letterboxd",
    "csv.col_found_in": "Presente en la lista de",

    // ── Streaming & TMDB ──
    "stream.filter_label": "Filtrar por streaming:",
    "stream.all_platforms": "Todas",
    "stream.loading_providers": "Buscando plataformas en {region}… ({current}/{total})",
    "stream.providers_ready": "Streaming en {region} listo",
    "stream.not_available": "No disponible en streaming en {region}",
    "stream.available_on": "Disponible en streaming ({region}):",
    "stream.no_matches_filter": "No hay películas que coincidan con las plataformas seleccionadas.",
    "stream.tmdb_disabled": "Filtro de streaming desactivado (configurá WORKER_BASE_URL en config.js)",
    "stream.worker_unavailable": "El servicio proxy (Worker) no está disponible o bloqueó la solicitud.",
    "stream.tmdb_error": "TMDB rechazó la petición o devolvió un error.",
    "stream.tmdb_auth_error": "API Key de TMDB inválida o no configurada en Cloudflare Worker.",
    "stream.badge_stream": "Streaming",
    "unique.load_streaming": "Cargar plataformas",
    "unique.loading_streaming": "Buscando plataformas en {region}… ({current}/{total})",
    "unique.streaming_loaded": "Plataformas listas",

    // ── Legal & Footer ──
    // TODO: Si en el futuro se incorpora algún servicio de analítica web (ej. GA, Plausible), actualizar esta nota de privacidad.
    "footer.tmdb_notice": "Este producto utiliza la API de TMDB, pero no está respaldado ni certificado por TMDB.",
    "footer.letterboxd_disclaimer": "Este sitio es un proyecto personal e independiente desarrollado con fines recreativos y no está afiliado, respaldado ni asociado de ninguna manera con Letterboxd Limited.",
    "footer.no_warranty": "El servicio se provee 'tal cual' (as is), sin garantías sobre la disponibilidad permanente o exactitud de los datos de terceros (Letterboxd, TMDB). El funcionamiento depende de servicios externos que pueden cambiar sin previo aviso.",
    "footer.privacy_note": "No recopilamos ni almacenamos tus datos en ningún servidor — tu historial de búsquedas y comparaciones vive únicamente en el almacenamiento local de tu navegador."
  },

  en: {
    // ── Input validation & row statuses ──
    "val.empty": "Enter a username or URL",
    "val.valid_user": "Valid username",
    "val.valid_list": "Valid list URL",
    "val.invalid_url": "Unrecognized or invalid URL format",
    "val.invalid_user": "Invalid username (letters, numbers and hyphens only)",
    "val.min_users": "At least 2 users required to compare",
    "val.duplicate": "This user or list was already added",
    "val.fetching": "Fetching Letterboxd data…",
    "val.loading_user": "Loading \"{label}\"…",
    "val.retrying_user": "Retrying \"{label}\"…",
    "val.success": "✅ {count} movies loaded",
    "val.error_fetch": "Error fetching list",
    "val.error_empty": "List is empty or private",
    "val.error_cors": "Connection/proxy error",
    "val.stopped": "Search stopped by user",
    "val.btn_retry": "Retry",
    "val.btn_remove": "Remove user {index}",
    "val.user_placeholder_watchlist": "Username or URL (e.g. edgarwright)",
    "val.user_placeholder_list": "Letterboxd list URL",
    "val.user_aria_input": "User or list {index}",

    // ── Proxy & connection status ──
    "proxy.label_ready": "Connection: Ready",
    "proxy.label_connecting": "Connecting: {name} ({ms}ms)",
    "proxy.label_error": "Connection: Fallback active",
    "proxy.title": "Connectivity status and CORS proxies",
    "proxy.local_cache": "Local cache",
    "proxy.active_label": "Active proxy: {name}",
    "proxy.connecting_user": "{user}: connecting via {label}…",
    "proxy.connecting_general": "Connecting via {label}…",
    "proxy.connected_user": "✅ {user}: data received via {label} ({elapsed}ms)",
    "proxy.connected_general": "✅ Connected via {label} ({elapsed}ms)",

    // ── History panel ──
    "hist.title": "Recent comparisons",
    "hist.empty": "No recent comparisons.",
    "hist.clear_all": "Clear all history",
    "hist.load_aria": "Load comparison for {users}",
    "hist.remove_aria": "Remove comparison from history",
    "hist.close_aria": "Close history",
    "hist.time_just_now": "just now",
    "hist.time_minutes": "{n}m ago",
    "hist.time_hours": "{n}h ago",
    "hist.time_days": "{n}d ago",
    "hist.badge_common": "{count} in common",

    // ── Loading state ──
    "loading.default": "Fetching Letterboxd feeds…",
    "loading.fetching_lists": "Fetching data from {count} list(s)…",
    "loading.parsing": "Parsing movies from {label}…",
    "loading.computing": "Computing matches…",

    // ── Results & stats bar ──
    "results.total_movies": "<strong>{count}</strong> total movies",
    "results.unique_user": "<strong>{count}</strong> unique from <strong>{user}</strong>",
    "results.top5_btn": "🎲 Top 5 Eliminator",
    "results.top5_title_enabled": "Eliminator mode: pick tonight's movie",
    "results.top5_title_disabled": "You need common movies to use Top 5",
    "results.top5_aria": "Open interactive Top 5 Eliminator to choose what to watch",
    "results.common_title": "Movies in Common",
    "results.unique_title": "Unique Movies per User",
    "results.no_common_title": "No movies in common found.",
    "results.no_common_sub": "Try with other users or different lists.",
    "results.btn_export_csv": "Export CSV",
    "results.btn_copy_link": "Copy link",
    "results.btn_copied": "Copied! ✓",
    "results.btn_sort": "Sort movies",
    "results.view_details": "View details →",
    "results.no_poster": "No poster",
    "results.poster_alt": "Poster for {title}",
    "results.tab_aria": "Unique movies for {user} ({count})",

    // ── Movie detail modal ──
    "modal.loading_rating": "Loading rating…",
    "modal.loading_desc": "Loading synopsis…",
    "modal.no_rating": "No rating",
    "modal.view_letterboxd": "View on Letterboxd",
    "modal.found_in": "Found in list of:",
    "modal.close_aria": "Close movie detail window",

    // ── Top 5 Eliminator ──
    "top5.heading": "Top 5 Eliminator",
    "top5.subtitle": "Eliminate choices until you are left with <strong>1 single movie</strong> to watch tonight",
    "top5.loading": "Loading movie details…",
    "top5.remaining": "{count} movie(s) remaining",
    "top5.winner_heading": "This is your movie for tonight!",
    "top5.btn_another_5": "Another 5",
    "top5.btn_another_5_aria": "Try with another 5 candidate movies",
    "top5.btn_close_aria": "Close Top 5 Eliminator",
    "top5.btn_eliminate_aria": "Eliminate {title}",
    "top5.card_aria": "{title}{year}. Press Delete, Backspace or Space to eliminate.",
    "top5.no_rating": "No rating",
    "top5.no_synopsis": "Synopsis not available",
    "top5.setup_title": "Filter Top 5 by Streaming Platforms?",
    "top5.setup_desc": "Choose whether to play Top 5 with all common movies or only those available on specific platforms.",
    "top5.setup_all_opt": "🎲 All common movies ({count})",
    "top5.setup_all_desc": "No streaming platform restriction",
    "top5.setup_stream_opt": "📺 Selected streaming platforms only ({count})",
    "top5.setup_stream_desc": "Pick from available subscription platforms",
    "top5.setup_btn_start": "Start Eliminator →",
    "top5.setup_no_matches": "No movies match the selected streaming platforms.",

    // ── CSV Export ──
    "csv.col_title": "Title",
    "csv.col_year": "Year",
    "csv.col_letterboxd_url": "Letterboxd URL",
    "csv.col_found_in": "Found in list of",

    // ── Streaming & TMDB ──
    "stream.filter_label": "Filter by streaming:",
    "stream.all_platforms": "All",
    "stream.loading_providers": "Checking streaming availability in {region}… ({current}/{total})",
    "stream.providers_ready": "Streaming in {region} ready",
    "stream.not_available": "Not available to stream in {region}",
    "stream.available_on": "Available on streaming ({region}):",
    "stream.no_matches_filter": "No common movies match the selected streaming platforms.",
    "stream.tmdb_disabled": "Streaming filter disabled (configure WORKER_BASE_URL in config.js)",
    "stream.worker_unavailable": "The proxy service (Worker) is unavailable or rejected the request.",
    "stream.tmdb_error": "TMDB rejected the request or returned an error.",
    "stream.tmdb_auth_error": "TMDB API Key is invalid or not configured on Cloudflare Worker.",
    "stream.badge_stream": "Streaming",
    "unique.load_streaming": "Load platforms",
    "unique.loading_streaming": "Checking platforms in {region}… ({current}/{total})",
    "unique.streaming_loaded": "Platforms ready",

    // ── Legal & Footer ──
    // TODO: If web analytics (e.g. GA, Plausible) is added in the future, update this privacy note.
    "footer.tmdb_notice": "This product uses the TMDB API but is not endorsed or certified by TMDB.",
    "footer.letterboxd_disclaimer": "This site is a personal and independent project developed for recreational purposes and is not affiliated, endorsed, or associated in any way with Letterboxd Limited.",
    "footer.no_warranty": "The service is provided 'as is', without warranties regarding continuous availability or accuracy of third-party data (Letterboxd, TMDB). Functionality relies on external services that may change without prior notice.",
    "footer.privacy_note": "We do not collect or store your data on any server — your search and comparison history lives solely in your browser's local storage."
  }
};

const I18N = {
  lang: (function() {
    const htmlLang = (document.documentElement.lang || '').toLowerCase();
    if (htmlLang.startsWith('en') || window.location.pathname.includes('/en/')) return 'en';
    return 'es';
  })(),

  t(key, params = {}) {
    let str = TRANSLATIONS[this.lang]?.[key] || TRANSLATIONS.es?.[key] || key;
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }
    return str;
  }
};

// Export to window
window.TRANSLATIONS = TRANSLATIONS;
window.I18N = I18N;
