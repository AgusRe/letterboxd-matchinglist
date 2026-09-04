# 🎬 Letterboxd Matcher

[![License: MIT](https://img.shields.io/badge/License-MIT-00c774.svg)](LICENSE)

> **Descubrí qué películas tienen en común vos y tus amigos en Letterboxd** — sin registrarte, sin API key, sin backend propio que mantener.

**[🌐 Ver demo en vivo →](https://agusre.github.io/letterboxd-matchinglist/)**

![Letterboxd Matcher Open Graph Banner](og-image.png)

---

## 📌 ¿Qué es Letterboxd Matcher?

**Letterboxd Matcher** es una aplicación web 100% estática que compara las **Watchlists** y **Listas públicas** de hasta 5 usuarios de [Letterboxd](https://letterboxd.com) y encuentra al instante las películas que todos quieren ver.

Ideal para cuando un grupo de amigos tiene que decidir qué ver juntos: en segundos ves qué coincide en las watchlists de todos, qué es exclusivo de cada uno, podés compartir el resultado con un enlace directo, exportarlo a CSV para tu colección, o resolver el empate con el modo interactivo **Top 5 Eliminator**.

---

### ✨ Características principales

| Feature | Detalle |
|---|---|
| 🔍 **Comparación instantánea** | Hasta 5 usuarios o listas públicas simultáneamente |
| 📋 **Dos modos de origen** | Watchlist personal (`@usuario`, `usuario` o URL) o lista pública específica |
| ⚡ **Validación en tiempo real** | Validación instantánea (debounce) con borde verde/rojo y mensajes contextuales claros |
| 🔄 **Retry selectivo por usuario** | Si una lista falla o es privada, los usuarios exitosos se preservan y podés reintentar puntualmente en esa fila |
| 🕒 **Historial persistente** | Guarda hasta 10 comparaciones en `localStorage` (`lbmatch_v1_history`) con recarga en 1 clic |
| 🧹 **Precarga y Limpieza** | Recuerda la última búsqueda al abrir la web y permite resetear inputs con el botón "Limpiar" |
| 🔗 **Compartir vía URL** | Parámetros automáticos (`?mode=watchlist&u=usuario1,usuario2`) y botón "Copiar link" con feedback visual |
| 📥 **Exportar a CSV** | Descarga las películas en común en formato CSV con codificación UTF-8 BOM para compatibilidad total con Microsoft Excel |
| 📡 **Indicador de salud de proxies** | Monitoreo en vivo durante la búsqueda y pill persistente en el footer con latencia y estado |
| ♿ **Accesibilidad completa (a11y)** | Navegación completa por teclado (Tab, flechas, Supr/Espacio) en el Top 5 Eliminator y en las pestañas |
| 🎞️ **Paginación automática** | Extrae **todas** las páginas de cada lista (hasta 30 páginas), no solo las primeras 28 |
| 🖼️ **Pósters, sinopsis y ratings reales** | Enriquecimiento on-demand vía `og:image`, `og:description` y `ratingValue` |
| 🎲 **Top 5 Eliminator** | Modo de decisión interactivo con eliminación de tarjetas, foco accesible y confetti |
| 📺 **Filtro por Streaming (TMDB)** | Filtra películas comunes por suscripción (Netflix, Prime, Max, Disney+, etc.) en tu país vía API oficial de TMDB |
| 📊 **Películas únicas** | Pestañas con teclado para explorar lo exclusivo de cada usuario |
| 🌐 **SEO Técnico y Schema.org** | Metadatos estáticos, JSON-LD (`WebApplication`, `WebSite`, `FAQPage`), Open Graph y `sitemap.xml` |
| 💾 **Caché client-side** | Listas (30 min), metadata (24 h) y disponibilidad de streaming (48 h) en `localStorage` |
| 💯 **100% estático** | HTML, CSS y Vanilla JS puro, sin build step, listo para GitHub Pages |

---

## 🛠️ Cómo funciona la extracción

Letterboxd no ofrece una API pública sin aprobación previa, por lo que la app obtiene los datos scrapeando el HTML público de cada perfil mediante una cadena inteligente de proxies CORS:

```
Usuario ingresa URL o username de Letterboxd (o abre un link compartido ?mode=...&u=...)
        ↓
App valida en tiempo real y expande username → URL canónica de watchlist
        ↓
App construye URLs de paginación (/page/1/, /page/2/, …)
        ↓
Solicitud enviada al proxy CORS (Worker propio / servidor local → AllOrigins fallback)
        ↓  [el proxy hace la petición a Letterboxd por nosotros, server-side]
HTML de la página devuelto como texto y analizado con DOMParser
        ↓
Extracción de elementos LazyPoster:
  <div data-component-class="LazyPoster"
       data-item-slug="princess-mononoke"
       data-item-name="Princess Mononoke (1997)"
       data-target-link="/film/princess-mononoke/" …>
        ↓
Lista de objetos { id (slug), title, year, poster, link }
        ↓
Algoritmo de intersección por slug → películas en común + únicas por usuario
        ↓
Render de tarjetas, actualización de URL compartible, exportación CSV y guardado en Historial
```

---

## 🔗 Compartir comparaciones vía URL

Podés compartir cualquier búsqueda o guardarla en tus marcadores simplemente pasando los parámetros en la URL:

```
https://agusre.github.io/letterboxd-matchinglist/?mode=watchlist&u=agusre,edgarwright
```

- **Parámetros admitidos:**
  - `mode`: `watchlist` o `list`.
  - `u` o `users`: nombres de usuario o URLs separadas por coma.
- **Botón "Copiar link":** En la cabecera de resultados comunes, hacé clic en **Copiar link** para copiar la URL lista para compartir con tus amigos. El botón confirmará con una animación y el texto `¡Copiado! ✓`.

---

## 📥 Exportar resultados a CSV

Para guardar o analizar las películas coincidentes:
1. Realizá una comparación exitosa.
2. En la sección de películas en común, hacé clic en **Exportar CSV**.
3. Se descargará automáticamente un archivo con el formato:
   ```
   letterboxd_match_usuario1_usuario2_2026-08-28.csv
   ```
4. **Compatibilidad:** El archivo incluye **UTF-8 BOM (`\uFEFF`)**, lo que garantiza que caracteres con acentos, eñes y caracteres especiales se abran correctamente en **Microsoft Excel**, Google Sheets y Numbers.

---

## 🎲 Top 5 Eliminator

Para esos momentos en los que el grupo no sabe qué elegir:

1. **Comparar listas**: ingresá al menos 2 usuarios o listas y hacé clic en "Comparar Listas".
2. **Abrir el modo**: en la barra de estadísticas de resultados, hacé clic en **🎲 Top 5 Eliminator**.
3. **Enriquecimiento de datos**: se seleccionan hasta 5 películas al azar y se obtienen sus pósters en alta resolución, sinopsis completa y calificación de estrellas.
4. **Descartar películas**:
   - Con mouse: hacé clic en la **×** de cada tarjeta.
   - Con teclado: navegá con las flechas (**←** / **→**) y presioná **Supr**, **Retroceso** o **Espacio** para descartar.
5. **Ganador**: al quedar 1 sola película, se activa el banner de ganador con confetti y un enlace directo a Letterboxd.

---

## 📺 Filtro por Plataforma de Streaming (TMDB)

La aplicación permite filtrar las películas que tienen en común según las plataformas de streaming disponibles en tu región (Netflix, Max, Prime Video, Disney+, Apple TV+, etc.):

1. **Matching Automático:** Busca cada título y año en The Movie Database (TMDB) a través de un proxy inverso seguro.
2. **Disponibilidad en Streaming:** Consulta el endpoint `/movie/{id}/watch/providers` extrayendo las opciones de suscripción plana (*flatrate*).
3. **Chips Dinámicos:** Muestra chips interactivos con los logos oficiales únicamente de las plataformas presentes en los resultados comunes de esa comparación.
4. **Caché Inteligente:** Guarda las consultas en `localStorage` con un TTL de **48 horas** (`lbmatch_v1_providers_{slug}_{region}`) para respuestas ultrarrápidas y menor consumo de red.
5. **Seguridad Total:** Las llamadas no exponen ninguna clave en el cliente ni en GitHub Pages; el Cloudflare Worker inyecta la API Key de TMDB server-side.
6. **Degradación Grácil:** Si el servicio de streaming no está disponible o falla, la comparación de Letterboxd sigue funcionando normalmente e informa el estado en pantalla.

### ⚙️ Arquitectura del Proxy y Configuración

Por defecto, la aplicación se comunica con una instancia pública del Cloudflare Worker configurada para este proyecto:
`https://letterboxd-proxy.agustin2-re.workers.dev`

#### Personalización Regional (`config.js`)
Si querés cambiar la región predeterminada o la concurrencia, podés crear un archivo `config.js` en la raíz (basado en `config.example.js`):
```javascript
window.APP_CONFIG = {
  WORKER_BASE_URL: "https://letterboxd-proxy.agustin2-re.workers.dev",
  TMDB_REGION: "AR",              // País para catálogo de streaming (código ISO: AR, US, ES, MX, etc.)
  STREAMING_CACHE_TTL_HOURS: 48,  // Horas de persistencia en caché
  TMDB_MAX_CONCURRENCY: 6         // Concurrencia de peticiones simultáneas
};
```

#### Despliegue de tu propio Worker (opcional para forks)
Si forkeás el repositorio y deseás utilizar tu propia infraestructura de Cloudflare:
1. Encontrarás el código de referencia en [`worker/worker.js`](worker/worker.js).
2. Desplegalo en tu cuenta de Cloudflare Workers con Wrangler:
   ```bash
   npx wrangler deploy
   ```
3. Configurá de forma segura tu clave de TMDB en el Worker:
   ```bash
   npx wrangler secret put TMDB_API_KEY --name tu-worker-name
   ```
4. Actualizá `WORKER_BASE_URL` en tu `config.js` apuntando a tu URL (`https://tu-worker.workers.dev`).

---

## 🔍 SEO Técnico y Arquitectura Semántica

La aplicación cuenta con una arquitectura de SEO técnico optimizada para el rastreo e indexación de Google y motores de búsqueda:

1. **Metadatos estáticos completos (`index.html`):**
   - Title tag estratégico (<60 caracteres).
   - Meta descripción optimizada para CTR (<155 caracteres).
   - Palabras clave bilingües (inglés y español).
   - Etiquetas canónicas y directivas `robots` / `googlebot` con `max-snippet:-1` y `max-image-preview:large`.
   - Etiquetas multilingües `hreflang` (`en`, `es`, `x-default`).
2. **Datos estructurados Schema.org (`JSON-LD`):**
   - `WebApplication`: categoría multimedia/entretenimiento, sistema operativo compatible, precio libre y lista de features.
   - `WebSite`: definición canónica del sitio.
   - `FAQPage`: acordeones de preguntas frecuentes con soporte de **Rich Snippets** en Google.
3. **Archivos de rastreo en raíz:**
   - `robots.txt`: acceso total para crawlers y referencia canónica al sitemap.
   - `sitemap.xml`: mapa del sitio formal con fechas `lastmod` y anotaciones `xhtml:link hreflang`.
   - `manifest.json`: manifiesto PWA con tema `#0d0f14` e iconos adaptativos.
   - `og-image.png`: banner de previsualización para redes sociales (1200x630).
4. **Semántica On-Page indexable:**
   - Un único `<h1>` descriptivo con las palabras clave objetivo.
   - Sección interactiva "Paso a paso / How It Works" y FAQ con `<details>` y `<summary>`.
   - Texto semántico explicativo en el pie de página para indexación textual inmediata.

---

## ♿ Accesibilidad y Navegación por Teclado

La interfaz está construida siguiendo las pautas de accesibilidad **WCAG AA**:
- **Navegación general:** Atributos semánticos `aria-label`, `aria-describedby` y `aria-live` para lectores de pantalla.
- **Top 5 Eliminator:** Las tarjetas reciben foco visible (`focus-visible`), se navegan con las teclas de dirección (**←**, **→**, **↑**, **↓**) y se descartan con **Supr**, **Retroceso** o **Espacio**.
- **Pestañas de películas únicas:** Cambiá de usuario usando las flechas del teclado (**←** y **→**) con actualización instantánea de contenido.
- **Cierre rápido:** La tecla `Escape` cierra instantáneamente modales, el panel de historial y el Top 5 Eliminator.
- **Contraste de color:** Textos, botones de validación y badges diseñados con ratios de contraste superiores a 7:1 en tema dark.

---

## 🌐 Arquitectura Bilingüe e Internacionalización (i18n)

La plataforma cuenta con soporte bilingüe nativo (Español e Inglés) 100% estático diseñado para maximizar el SEO global y la experiencia de usuario:

- **Versión en Español (Canónica de raíz):** `https://agusre.github.io/letterboxd-matchinglist/`
  - Idioma: `<html lang="es">`
  - Open Graph: `og:locale="es_ES"`, `og:locale:alternate="en_US"`, `og:locale:alternate="es_AR"`
  - JSON-LD Schema: `WebApplication`, `WebSite` y `FAQPage` completamente traducidos al español.
- **Versión en Inglés (Subdirectorio `/en/`):** `https://agusre.github.io/letterboxd-matchinglist/en/`
  - Idioma: `<html lang="en">`
  - Open Graph: `og:locale="en_US"`, `og:locale:alternate="es_ES"`
  - JSON-LD Schema: `WebApplication`, `WebSite` y `FAQPage` redactados en inglés nativo.
- **Anotaciones Hreflang y x-default:**
  - Ambas versiones declaran enlaces recíprocos `<link rel="alternate" hreflang="es" ... />` y `<link rel="alternate" hreflang="en" ... />`.
  - Se designa `hreflang="x-default"` apuntando a la versión en inglés (`/en/`) para usuarios y buscadores de regiones no hispanohablantes.
- **Selector de idioma inteligente:**
  - El botón toggle (`EN` / `ES` en el navbar) preserva automáticamente los query parameters de búsqueda actuales (ej: si estás en `/?mode=watchlist&u=agusre,edgarwright`, al pulsar `EN` viajarás a `/en/?mode=watchlist&u=agusre,edgarwright`).
- **Lógica única y modular (`i18n.js` + `app.js`):**
  - **Cero duplicación de lógica:** `app.js` contiene una única fuente de verdad para el scraping, la validación y el desempate Top 5, consumiendo los textos mediante el helper `I18N.t(key, params)`.

### ➕ ¿Cómo agregar un nuevo idioma (ej: Portugués `/pt/`)?
1. En `i18n.js`, agregá el bloque de traducciones correspondiente (`TRANSLATIONS.pt = { ... }`).
2. Creá el directorio `pt/` con su propio `pt/index.html`, ajustando los enlaces relativos (`../style.css`, `../app.js`, `../i18n.js`) y las anotaciones hreflang.
3. Agregá la URL en `sitemap.xml` con sus enlaces `xhtml:link` recíprocos.

---

## 🚀 Cómo ejecutar la página localmente

Para ejecutar el proyecto en tu máquina local:

1. Abrí una terminal en la carpeta del proyecto y ejecutá:

```bash
node proxy-server.js
```

2. Abrí tu navegador en:
- **Español:** [http://localhost:3000](http://localhost:3000)
- **English:** [http://localhost:3000/en/](http://localhost:3000/en/)

> 💡 **¿Por qué con `node proxy-server.js`?**  
> `proxy-server.js` es un servidor Node ligero y sin dependencias que realiza dos tareas a la vez:
> 1. Sirve los archivos estáticos (`index.html`, `en/index.html`, `style.css`, `app.js`, `i18n.js`, imágenes/favicons).
> 2. Provee el endpoint `/proxy?url=...` para consultar Letterboxd localmente sin restricciones de CORS.
> 
> No requiere `npm install` ni librerías externas. Solo necesitás tener [Node.js](https://nodejs.org/) instalado.

---

## ⚙️ Estructura del proyecto

```
letterboxd-matchinglist/
├── index.html       ← Versión en Español (raíz canónica) + Schema JSON-LD (ES) + FAQ
├── en/
│   └── index.html   ← Versión en Inglés (/en/) + Schema JSON-LD (EN) + FAQ
├── i18n.js          ← Diccionario de traducciones (ES / EN) y helper I18N.t()
├── app.js           ← Lógica compartida única: scraping, proxies, validación, Top 5, CSV, historial
├── style.css        ← Tema dark, variables CSS, accesibilidad, animaciones, FAQ y responsive
├── manifest.json    ← Manifiesto PWA para instalación móvil y de escritorio
├── robots.txt       ← Directivas de rastreo para motores de búsqueda y referencia al sitemap
├── sitemap.xml      ← Mapa del sitio XML con 2 URLs (/ y /en/) y anotaciones hreflang
├── og-image.png     ← Banner Open Graph (1200x630) para previsualizaciones en redes sociales
├── config.example.js ← Plantilla de configuración opcional (WORKER_BASE_URL, región, caché)
├── worker/
│   └── worker.js    ← Código de referencia para el Cloudflare Worker (Letterboxd CORS + TMDB reverse proxy)
├── favicons/        ← Iconos y favicons multi-resolución (SVG, PNG, ICO, Webmanifest)
├── proxy-server.js  ← Proxy CORS y servidor de desarrollo estático local (`node proxy-server.js`)
└── README.md        ← Documentación completa del proyecto y guía de indexación
```

---

## 🧭 Pipeline de proxies CORS y resiliencia

1. **Proxy principal en desarrollo:** `http://localhost:3000/proxy?url=` (rápido y sin límites al correr `node proxy-server.js`).
2. **Proxy principal en producción:** Cloudflare Worker dedicado (`https://letterboxd-proxy.agustin2-re.workers.dev/?url=`).
3. **Fallback público:** `AllOrigins` en caso de indisponibilidad temporal del worker principal.
4. **Monitoreo:** El estado del proxy y la latencia en milisegundos se reportan en tiempo real tanto en el banner de carga como en el footer de la aplicación.

---

## ⚠️ Limitaciones conocidas

- **Listas privadas:** No son accesibles ya que Letterboxd requiere sesión para visualizarlas.
- **Enriquecimiento de metadatos:** Para no saturar los proxies, los pósters y sinopsis se obtienen con concurrencia controlada (máximo 3 peticiones en paralelo) y se cachean localmente por 24 horas.

---

## 🧱 Stack técnico

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico + ARIA + Schema.org JSON-LD (ES & EN) |
| Estilos | CSS3 puro — Custom Properties, Flexbox, Grid, Glassmorphism, animaciones |
| Lógica | Vanilla JavaScript (ES2020+) + i18n modular sin bundler |
| Fuente de datos | Scraping HTML público de Letterboxd |
| Persistencia | `localStorage` (listas 30 min, metadata 24 h, historial permanente) |
| CORS bypass | Cloudflare Worker propio + Node local + AllOrigins fallback |
| Exportación | Blob API + UTF-8 BOM CSV |
| Animaciones | Canvas 2D API para confetti |
| Deploy | GitHub Pages (100% estático) |

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.

---

*Hecho con ❤️ para cinéfilos por [AgusRe](https://github.com/AgusRe) · Los datos son públicos de [Letterboxd](https://letterboxd.com)*

