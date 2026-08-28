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
| ⚡ **Validación en tiempo real** | Validación instantánea (debounce) con soporte de `@usuario`, username directo o URL completa |
| 🕒 **Historial persistente** | Guarda las últimas comparaciones en `localStorage` (`lbmatch_v1_history`) con recarga en 1 clic |
| 🔄 **Precarga y Limpieza** | Recuerda la última búsqueda al recargar la página y permite resetear inputs con el botón "Limpiar" |
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
Usuario ingresa URL o username de Letterboxd
        ↓
App valida en tiempo real y expande username → URL canónica de watchlist
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
Render de tarjetas con título y año + guardado en Historial
```

---

## 🎲 Top 5 Eliminator — Cómo usarlo

1. **Comparar listas**: ingresá las URLs o usernames de al menos 2 personas y hacé clic en "Comparar Listas".
2. **Abrir el modo**: en la barra de estadísticas de resultados, hacé clic en **🎲 Top 5 Eliminator**.
3. **Esperar el enrichment**: la app carga pósters, sinopsis y calificaciones de 5 películas al azar (instantáneo si ya estaban en caché, unos segundos si no).
4. **Jugar**: pasá el mouse sobre cada póster para ver la sinopsis y las ★ estrellas, y hacé clic en la **×** para eliminar una película. Repetí hasta quedar con una sola.
5. **Reiniciar**: "↺ Otras 5" genera un nuevo lote aleatorio.

> Si hay menos de 5 películas en común, el modo usa todas las disponibles.

---

## 🕒 Historial y Última Búsqueda

- **Historial:** Hacé clic en el botón `🕒 Historial` en la cabecera de la tarjeta para desplegar las últimas 10 comparaciones. Podés restaurar cualquier búsqueda con un clic o borrar entradas individuales/totales.
- **Limpiar:** El botón `Limpiar` resetea el formulario a 2 filas vacías en cualquier momento.

---

## 🚀 Cómo ejecutar la página localmente

Para ejecutar el proyecto en tu máquina local:

1. Abrí una terminal en la carpeta del proyecto y ejecutá:

```bash
node proxy-server.js
```

2. Abrí tu navegador en:
**[http://localhost:3000](http://localhost:3000)**

> 💡 **¿Por qué con `node proxy-server.js`?**  
> `proxy-server.js` es un servidor Node ligero y sin dependencias que realiza dos tareas a la vez:
> 1. Sirve los archivos estáticos (`index.html`, `style.css`, `app.js`, imágenes/favicons).
> 2. Provee el endpoint `/proxy?url=...` para consultar Letterboxd localmente sin restricciones de CORS.
> 
> No requiere `npm install` ni librerías externas. Solo necesitás tener [Node.js](https://nodejs.org/) instalado.

### Cache-busting al editar `app.js`

GitHub Pages y los navegadores cachean `app.js` de forma agresiva. Si después de un `git push` los cambios no se reflejan, subí el número de versión en `index.html`:

```html
<script src="app.js?v=2"></script>
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
