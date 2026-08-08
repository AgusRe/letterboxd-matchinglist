# 🎬 Letterboxd Match

> **Descubrí qué películas tienen en común vos y tus amigos en Letterboxd** — sin registrarte, sin API key, sin backend propio que mantener.

**[🌐 Ver demo en vivo →](https://agusre.github.io/letterboxd-matchinglist/)**

---

## 📌 ¿Qué es Letterboxd Match?

**Letterboxd Match** es una aplicación web estática que compara las **Watchlists** y **Listas públicas** de hasta 5 usuarios de [Letterboxd](https://letterboxd.com) y encuentra al instante las películas que todos quieren ver.

Ideal para cuando un grupo de amigos tiene que decidir qué ver juntos: en segundos ves qué coincide en las watchlists de todos, qué es exclusivo de cada uno, y si no se ponen de acuerdo, un modo de eliminación con confetti resuelve el empate.

### ✨ Características principales

| Feature | Detalle |
|---|---|
| 🔍 **Comparación instantánea** | Hasta 5 usuarios simultáneamente |
| 📋 **Dos modos** | Watchlist personal o lista pública específica |
| 🎞️ **Paginación completa** | Extrae **todas** las páginas de cada lista, no solo las primeras 28 |
| 🌐 **Sin API key** | Scraping HTML público vía proxy CORS propio |
| 🖼️ **Pósters, sinopsis y rating reales** | Enriquecimiento on-demand vía `og:image` / `og:description` / `ratingValue`, disponible en el grid común, en únicas por usuario, en el modal de detalle y en el Top 5 |
| 🎲 **Top 5 Eliminator** | Modo de decisión grupal con eliminación interactiva y confetti |
| 📊 **Películas únicas** | Muestra lo exclusivo de cada usuario en pestañas |
| 💾 **Caché inteligente** | Listas (30 min) y metadata de films (24 h) cacheadas en `localStorage` |
| 💯 **100% estático** | Sin backend obligatorio, sin build step, desplegable en GitHub Pages |

---

## 🛠️ Cómo funciona la extracción

Letterboxd no ofrece una API pública sin aprobación previa, así que la app obtiene los datos scrapeando el HTML público de cada perfil:

```
Usuario ingresa URL de Letterboxd
        ↓
App construye URLs de paginación (/page/1/, /page/2/, …)
        ↓
Solicitud enviada al proxy CORS (ver "Cadena de proxies" abajo)
        ↓  [el proxy hace la petición a Letterboxd por nosotros, server-side]
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
Algoritmo de intersección por slug → películas en común + únicas por usuario
        ↓
Render de tarjetas con título y año

        ── Enriquecimiento on-demand (grid común, únicas, modal, Top 5) ──
        ↓
Para cada película que aún no tiene póster/sinopsis/rating en caché:
  fetch /film/{slug}/ vía el mismo proxy CORS
        ↓
  Extracción de metadatos adicionales:
    • <meta property="og:image">       → póster real, alta resolución
    • <meta property="og:description"> → sinopsis
    • <meta itemprop="ratingValue">    → calificación promedio (0–5)
        ↓
Se guarda en localStorage (24 h) y se actualiza la tarjeta / modal in-place
```

### Por qué hace falta un proxy CORS

Los navegadores aplican la **Same-Origin Policy**: una página no puede hacer `fetch()` directo a `letterboxd.com` porque Letterboxd no envía cabeceras CORS. El proxy actúa de intermediario — recibe la URL pedida, la descarga desde su propio servidor (sin restricción de navegador) y devuelve el HTML con las cabeceras CORS que el browser necesita para aceptarlo.

### Cadena de proxies

La app usa un **proxy propio, con fallback a un servicio público**, en vez de depender 100% de terceros gratuitos (que resultaron ser inestables — ver la sección de aprendizajes más abajo):

1. **`proxy-server.js`** — servidor Node propio, **solo en desarrollo local**. Corre en `http://localhost:3000`, sirve la app y expone `/proxy?url=`, haciendo el fetch server-side sin depender de nada externo.
2. **Cloudflare Worker propio** (`letterboxd-proxy.*.workers.dev`) — el proxy principal en producción (GitHub Pages). Gratis, 100.000 requests/día, sin rate-limit compartido con otros proyectos.
3. **`api.allorigins.win`** — fallback público, solo se consulta si el proxy propio falla.

A diferencia de un enfoque que dispara todos los proxies en simultáneo y se queda con el que responda primero, acá se **prueba el proxy propio primero y solo**; si falla, recién ahí se recurre al fallback público. Esto evita ensuciar la consola con errores de proxies de terceros cuando el propio funciona bien (que es casi siempre), y evita gastar cuota de servicios gratuitos compartidos sin necesidad.

Cada intento queda logueado en consola (`[Proxy] ✅ host — Nms (N chars)` en éxito, `[Proxy] ❌ host — motivo` en fallo), así que cualquier problema de un proxy puntual se puede diagnosticar mirando DevTools sin necesidad de tocar código.

### Normalización de IDs

La comparación usa el **slug** de la película (ej. `parasite-2019`, `princess-mononoke`) como identificador canónico. Los slugs son únicos y estables en Letterboxd, así que la intersección entre listas es exacta.

### Paginación completa

Letterboxd muestra 28 películas por página en watchlists. La app detecta automáticamente el tamaño de página en la primera respuesta y sigue pidiendo páginas siguientes hasta obtener menos ítems que el umbral, soportando hasta 30 páginas (~840+ películas por usuario).

---

## 🎲 Top 5 Eliminator — Cómo usarlo

1. **Comparar listas**: ingresá las URLs de watchlist/lista de al menos 2 usuarios y hacé clic en "Comparar Listas".
2. **Abrir el modo**: en la barra de estadísticas de resultados, hacé clic en **🎲 Top 5 Eliminator**.
3. **Esperar el enrichment**: la app carga pósters, sinopsis y calificaciones de 5 películas al azar (instantáneo si ya estaban en caché, unos segundos si no).
4. **Jugar**: pasá el mouse sobre cada póster para ver la sinopsis y las ★ estrellas, y hacé clic en la **×** para eliminar una película. Repetí hasta quedar con una sola.
5. **Reiniciar**: "↺ Otras 5" genera un nuevo lote aleatorio.

> Si hay menos de 5 películas en común, el modo usa todas las disponibles.

---

## 🖥️ Desarrollo local

Corré:

```bash
node proxy-server.js
```

Esto levanta un único servidor en `http://localhost:3000` que sirve la app **y** expone `/proxy?url=` para las peticiones a Letterboxd, sin ningún problema de CORS porque el fetch lo hace Node server-side.

Abrí `http://localhost:3000` en el navegador.

> ⚠️ **No uses `npx serve .` ni `python -m http.server`** para desarrollar esta app. Son servidores estáticos genéricos: no conocen la ruta `/proxy`, así que vas a ver 404 en consola apenas la app intente traer datos de Letterboxd. Sirven solo para mirar el HTML/CSS suelto, no para probar el flujo completo.

Si por algún motivo no podés correr Node, la app cae automáticamente al Worker de Cloudflare / proxy público — pero son más lentos y no reemplazan al proxy local para desarrollo día a día.

### Cache-busting al editar `app.js`

GitHub Pages y los navegadores cachean `app.js` de forma agresiva. Si después de un `git push` los cambios no se reflejan, subí el número de versión en `index.html`:

```html
<script src="app.js?v=4"></script>
```

Esto fuerza a que se descargue la versión nueva en vez de servir una copia vieja en caché.

---

## ⚙️ Estructura del proyecto

```
letterboxd-matchinglist/
├── index.html       ← Estructura HTML semántica + SEO metadata + overlay Top 5
├── style.css         ← Tema dark, variables CSS, grid responsivo, animaciones + modal + Top 5
├── app.js            ← Fetch, proxy chain, parse, comparación, render, modal + Top 5 Eliminator + enrichMovieMeta
├── proxy-server.js   ← Proxy CORS local para desarrollo (`node proxy-server.js`)
└── README.md         ← Esta documentación
```

---

## 🧭 Cómo se llegó a esta arquitectura (aprendizajes)

El diseño actual del pipeline de proxies no fue la primera versión — se llegó ahí iterando sobre fallos reales en producción:

1. **v1 — proxies públicos en cadena secuencial.** Funcionaba, pero era lento (hasta 8 proxies probados uno por uno) y varios de la lista original (`corsproxy.org`, `cors.sh`, `thingproxy.freeboard.io`) dejaron de responder con headers CORS válidos, o el dominio directamente dejó de resolver.
2. **v2 — todos los proxies en paralelo (`Promise.any`).** Resolvía más rápido, pero bajo carga (varios usuarios comparando listas + enrichment de decenas de films) terminaba saturando a los servicios gratuitos compartidos, generando rate-limits (`429`, `520`, `521`, `522`) que tumbaban comparaciones enteras.
3. **v3 — proxy propio en Cloudflare Workers.** Al ser propio, sin compartir cuota con otros proyectos, resolvió la inestabilidad de fondo.
4. **v4 (actual) — proxy propio primero, público como fallback real.** En vez de seguir "raceando" contra un proxy público que ya no hacía falta, se pasó a intentar el proxy propio solo, y recién si falla, recurrir al fallback. Resultado: consola limpia, menos requests desperdiciados, mismo nivel de resiliencia ante una caída puntual del proxy principal.

---

## ⚠️ Limitaciones conocidas

- **Listas privadas** no son accesibles — Letterboxd no expone contenido privado.
- **Disponibilidad del proxy** — en producción se depende del Worker propio (muy estable, pero no 100% garantizado) más un fallback público de terceros. En desarrollo local, `node proxy-server.js` elimina esta dependencia por completo.
- **Enriquecimiento (póster/sinopsis/rating)** — cada película sin esos datos en la lista original requiere un fetch adicional a su página individual, con concurrencia limitada (3 en simultáneo) para no saturar el proxy, y cacheado 24 h en `localStorage`. Si el proxy falla para una película puntual, esa tarjeta queda con "Sin póster" sin romper el resto de la UI.
- **Rate limiting** — si el proxy propio cae y se recurre al público de fallback, ese sí puede devolver `429`/`5xx` bajo uso intenso. Esperar unos segundos y reintentar suele resolverlo.

---

## 🧱 Stack técnico

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico |
| Estilos | CSS3 puro — Variables, Grid, Flexbox, Canvas, animaciones |
| Lógica | Vanilla JavaScript (ES2020+) |
| Fuente de datos | Scraping HTML público de Letterboxd |
| Metadatos enriquecidos | Extracción `og:image` + `og:description` + `itemprop:ratingValue`, cacheados en `localStorage` |
| CORS bypass | Proxy propio en Cloudflare Workers (producción) + `proxy-server.js`/Node (desarrollo local) + AllOrigins (fallback público) |
| Confetti | Canvas 2D API (vanilla, sin librerías) |
| Deploy | GitHub Pages (estático, sin build) |

---

## 📄 Licencia

MIT — libre uso, modificación y distribución.

---

*Hecho con ❤️ para cinéfilos · Los datos son públicos de [Letterboxd](https://letterboxd.com)*
