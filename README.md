# 🎬 Letterboxd Match

> **Descubrí qué películas tienen en común tus amigos en Letterboxd** — sin registrarte, sin API key, sin servidor.

**[🌐 Ver demo en vivo →](https://agusre.github.io/letterboxd-matchinglist/)**

---

## 🆕 Novedades — v2.1

### 🖼️ Pósters, sinopsis y rating en TODAS las secciones
Antes el enriquecimiento (póster real, sinopsis, calificación) solo pasaba en el modo Top 5 Eliminator. Ahora:
- El grid de **Películas en Común** carga los pósters reales automáticamente al renderizarse.
- Las pestañas de **Películas Únicas por Usuario** enriquecen sus pósters de forma *lazy* — la pestaña visible al entrar se carga sola, y el resto recién dispara el fetch cuando el usuario hace clic en ellas (evita saturar los proxies con fetches innecesarios).
- El **modal de detalle** (al hacer clic en cualquier película) ahora también trae póster, sinopsis y calificación en estrellas, con un estado de carga mientras llegan los datos.
- Todo comparte un mismo caché en `localStorage` (24 h de TTL) — si una película ya se enriqueció en el grid, el modal la muestra al instante sin volver a pedirle nada a Letterboxd.

### 🪟 Modal más grande
El modal de detalle de película ahora ocupa gran parte de la pantalla (antes era chico y obligaba a hacer zoom para leer bien). Póster, título, sinopsis y rating con tipografía más grande y legible.

### 🔧 Cadena de proxies CORS depurada
Se sacaron proxies que dejaron de funcionar (`corsproxy.org`, `cors.sh`, `thingproxy.freeboard.io` — ya no resuelven o no envían headers CORS) y quedaron solo los que efectivamente responden hoy: el proxy local (`proxy-server.js`, recomendado para desarrollo) + `api.allorigins.win` + `api.codetabs.com` como fallback público para producción (GitHub Pages).

---

## 🆕 Novedades — v2.0

### 🖼️ Pósters reales con enriquecimiento on-demand
Las películas muestran su portada oficial de alta resolución. La extracción se realiza al vuelo consultando el `og:image` de la página individual de cada film en Letterboxd — sin API key, vía el mismo pipeline de proxies CORS.

### 🎲 Nuevo modo: Top 5 Eliminator
Una herramienta interactiva de decisión grupal. Una vez que tenés resultados, hacé clic en **🎲 Top 5 Eliminator** en la barra de estadísticas para entrar al modo de eliminación:
- Se eligen **5 películas al azar** del pool de películas en común.
- Hover sobre cada tarjeta para ver la **sinopsis** y **calificación en estrellas**.
- Hacé clic en la **× roja** para eliminar una película.
- Cuando queda 1, ¡aparece el efecto de ganadora con confetti y corona! 🏆

---

## 📌 ¿Qué es Letterboxd Match?

**Letterboxd Match** es una aplicación web estática que compara las **Watchlists** y **Listas públicas** de múltiples usuarios de [Letterboxd](https://letterboxd.com) para encontrar al instante las películas que todos quieren ver.

Ideal para cuando un grupo de amigos quiere decidir qué película ver juntos: en segundos ves qué coincide en las watchlists de todos, y qué películas son exclusivas de cada uno.

### ✨ Características principales

| Feature | Detalle |
|---|---|
| 🔍 **Comparación instantánea** | Hasta 5 usuarios simultáneamente |
| 📋 **Dos modos** | Watchlist personal o Lista específica pública |
| 🎞️ **Paginación completa** | Extrae **todas** las páginas, no solo las primeras 28 |
| 🌐 **Sin API key** | Usa proxies CORS + scraping HTML público |
| 🖼️ **Pósters, sinopsis y rating reales** | Enriquecimiento on-demand vía `og:image` / `og:description` / `ratingValue` — en el grid común, en únicas por usuario, en el modal de detalle y en el Top 5 |
| 🎲 **Top 5 Eliminator** | Modo de decisión grupal con eliminación interactiva y confetti |
| 📊 **Películas únicas** | Muestra lo exclusivo de cada usuario en pestañas |
| 💾 **Caché inteligente** | Listas (30 min) y metadata de films (24 h) cacheadas en `localStorage` |
| 💯 **100% estático** | Sin backend obligatorio, sin build step, desplegable en GitHub Pages |

---

## 🎲 Top 5 Eliminator — Cómo usarlo

1. **Comparar listas**: Ingresá las URLs de watchlist/lista de al menos 2 usuarios y hacé clic en "Comparar Listas".
2. **Abrir el modo**: En la barra de estadísticas de resultados, hacé clic en el botón **🎲 Top 5 Eliminator**.
3. **Esperar el enrichment**: La app carga los pósters, sinopsis y calificaciones de las 5 películas seleccionadas al azar (~3-5 segundos, o instantáneo si ya estaban en caché).
4. **Jugar**:
   - Pasá el mouse sobre cada póster para ver la **sinopsis** y las **★ estrellas**.
   - Hacé clic en la **× flotante** (esquina superior derecha de la tarjeta) para eliminar una película.
   - Repetí hasta quedar con 1 ganadora.
5. **Reiniciar**: Usá el botón "↺ Otras 5" para generar un nuevo lote aleatorio.

> **Nota:** Si hay menos de 5 películas en común, el modo usa todas las disponibles.

---

## ✅ Validado con usuarios reales

La aplicación fue **testeada y validada** específicamente con las watchlists de usuarios reales, utilizando URLs de listas públicas. Ésta extrae correctamente **todas las películas** de cada watchlist, calcula la intersección exacta y muestra las películas en común y las exclusivas de cada usuario, siendo una herramienta útil para decidir qué ver juntos.

---

## 🛠️ Cómo funciona la extracción

La app **no usa la API oficial de Letterboxd** (que requiere aprobación y key). En cambio:

```
Usuario ingresa URL de Letterboxd
        ↓
App construye URLs de paginación (/page/1/, /page/2/, …)
        ↓
Solicitud enviada a un CORS proxy (proxy local / AllOrigins / codetabs)
        ↓  [el proxy hace la petición al servidor de Letterboxd por nosotros]
HTML de la página de lista/watchlist devuelto como texto
        ↓
DOMParser analiza el HTML y extrae los elementos LazyPoster:
  <div data-component-class="LazyPoster"
       data-item-slug="princess-mononoke"
       data-item-name="Princess Mononoke (1997)"
       data-target-link="/film/princess-mononoke/" …>
        ↓
Lista de objetos { id (slug), title, year, poster, link }
        ↓
Algoritmo de intersección → películas en común + únicas por usuario
        ↓
Render de tarjetas con título y año

        ── Enriquecimiento on-demand (grid común, únicas, modal, Top 5) ──
        ↓
Para cada película que aún no tiene póster/sinopsis/rating en caché:
  fetch /film/{slug}/ via proxy CORS
        ↓
  Extracción de metadatos adicionales:
    • <meta property="og:image">      → URL del póster real (alta res)
    • <meta property="og:description"> → Sinopsis de la película
    • <meta itemprop="ratingValue">   → Calificación promedio (0–5)
        ↓
Se guarda en localStorage (24 h) y se actualiza la tarjeta / modal in-place
```

### Por qué se necesita un CORS proxy

Los navegadores aplican la **Same-Origin Policy**: una página web no puede hacer `fetch()` a `letterboxd.com` directamente porque Letterboxd no incluye las cabeceras CORS. El proxy actúa de intermediario: recibe la URL, la descarga desde su servidor y devuelve el HTML al navegador.

### Cadena de proxies (con fallback automático)

La app **corre en paralelo** los proxies disponibles y se queda con el primero que responde (`Promise.any`):

1. `http://localhost:3000/proxy?url=` — proxy local (`proxy-server.js`), **solo se usa en desarrollo local**, cero problemas de CORS porque el fetch lo hace Node server-side.
2. `api.allorigins.win/raw?url=` — fallback público para producción (GitHub Pages).
3. `api.codetabs.com/v1/proxy?quest=` — segundo fallback público.

> Se sacaron de la lista `corsproxy.org`, `cors.sh` y `thingproxy.freeboard.io`: dejaron de enviar cabeceras CORS válidas (los dos primeros) o el dominio directamente dejó de resolver (`ERR_NAME_NOT_RESOLVED` en el caso de thingproxy). Si en el futuro alguno de los proxies actuales deja de andar, revisar `PROXIES` en `app.js` y reemplazarlo por una alternativa vigente.

### Normalización de IDs

La comparación usa el **slug** de la película (ej. `parasite-2019`, `princess-mononoke`) como identificador canónico. Los slugs son únicos y estables en Letterboxd, garantizando que la intersección sea **100% exacta**.

### Paginación completa

Letterboxd muestra **28 películas por página** en watchlists. La app detecta automáticamente el tamaño de página en la primera respuesta y sigue pidiendo páginas siguientes hasta obtener menos ítems que el umbral. Se soportan hasta **30 páginas** (~840+ películas por usuario).

---

## 🖥️ Desarrollo local

**Importante:** para desarrollo local se recomienda usar el proxy propio del proyecto, no un servidor estático genérico. Corré:

```bash
node proxy-server.js
```

Esto levanta un único servidor en `http://localhost:3000` que:
- Sirve los archivos estáticos de la app (`index.html`, `app.js`, `style.css`).
- Expone el endpoint `/proxy?url=...`, que hace el fetch a Letterboxd **server-side** (sin problemas de CORS, sin depender de servicios de terceros ni rate limits ajenos).

Abrí `http://localhost:3000` en tu navegador.

> ⚠️ **No uses `npx serve .` ni `python -m http.server`** para desarrollo de esta app: son servidores estáticos genéricos que no conocen la ruta `/proxy`, y vas a ver errores 404 en la consola apenas la app intente pedir datos a Letterboxd. Esos comandos sirven solo para ver el HTML/CSS estático, no para probar la app funcionando de punta a punta.

Alternativa si por algún motivo no podés correr Node: la app también cae automáticamente en los proxies públicos (`allorigins.win`, `codetabs.com`) si `localhost:3000/proxy` no responde — pero son más lentos y menos confiables que el proxy propio.

---

## ⚙️ Estructura del proyecto

```
letterboxd-matchinglist/
├── index.html       ← Estructura HTML semántica + SEO metadata + overlay Top 5
├── style.css         ← Tema dark, variables CSS, grid responsivo, animaciones + estilos Top 5 + modal
├── app.js            ← Fetch, parse, comparación, render, modal + Top 5 Eliminator + enrichMovieMeta
├── proxy-server.js   ← Proxy CORS local para desarrollo (recomendado: `node proxy-server.js`)
└── README.md         ← Esta documentación
```

---

## ⚠️ Limitaciones conocidas

- **Listas privadas** no son accesibles — Letterboxd no expone contenido privado.
- **Disponibilidad del proxy** — En producción (GitHub Pages) se depende de proxies públicos de terceros; si están caídos o rate-limiteados, la carga puede tardar más o fallar parcialmente. En desarrollo local esto se evita corriendo `node proxy-server.js`.
- **Enriquecimiento (póster/sinopsis/rating)** — Cada película que no tenía esos datos en la lista original requiere 1 fetch adicional a su página individual. Se resuelve con concurrencia limitada (3 en simultáneo) para no saturar los proxies, y se cachea 24 h en `localStorage` para no repetir el trabajo. Si el proxy falla para una película puntual, esa tarjeta se queda con "Sin póster" / sin romper el resto de la UI.
- **Rate limiting** — Si consultás muchas URLs seguidas contra los proxies públicos, alguno puede retornar error 429/520. Esperá unos segundos y reintentá, o usá el proxy local.

---

## 🧱 Stack técnico

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico |
| Estilos | CSS3 puro — Variables, Grid, Flexbox, Canvas, animaciones |
| Lógica | Vanilla JavaScript (ES2020+) |
| Fuente de datos | Scraping HTML público de Letterboxd |
| Metadatos enriquecidos | Extracción `og:image` + `og:description` + `itemprop:ratingValue`, cacheados en `localStorage` |
| CORS bypass | Proxy local (`proxy-server.js`, Node) + AllOrigins + codetabs (fallback público) |
| Confetti | Canvas 2D API (vanilla, sin librerías) |
| Deploy | GitHub Pages (estático, sin build) |

---

## 📄 Licencia

MIT — libre uso, modificación y distribución.

---

*Hecho con ❤️ para cinéfilos · Los datos son públicos de [Letterboxd](https://letterboxd.com)*
