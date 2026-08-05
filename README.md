# 🎬 Letterboxd Match

> **Descubrí qué películas tienen en común tus amigos en Letterboxd** — sin registrarte, sin API key, sin servidor.

**[🌐 Ver demo en vivo →](https://agusre.github.io/letterboxd-matchinglist/)**

---

## 🆕 Novedades — v2.0

### 🖼️ Pósters reales con enriquecimiento on-demand
Las películas ahora muestran su portada oficial de alta resolución en el modo Top 5. La extracción se realiza al vuelo consultando el `og:image` de la página individual de cada film en Letterboxd — sin API key, vía el mismo pipeline de proxies CORS.

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
| 🖼️ **Pósters reales** | Extracción on-demand via `og:image` de la página del film |
| 🎲 **Top 5 Eliminator** | Modo de decisión grupal con eliminación interactiva y confetti |
| 📊 **Películas únicas** | Muestra lo exclusivo de cada usuario en pestañas |
| 💯 **100% estático** | Sin backend, sin build step, desplegable en GitHub Pages |

---

## 🎲 Top 5 Eliminator — Cómo usarlo

1. **Comparar listas**: Ingresá las URLs de watchlist/lista de al menos 2 usuarios y hacé clic en "Comparar Listas".
2. **Abrir el modo**: En la barra de estadísticas de resultados, hacé clic en el botón **🎲 Top 5 Eliminator**.
3. **Esperar el enrichment**: La app carga los pósters, sinopsis y calificaciones de las 5 películas seleccionadas al azar (~3-5 segundos).
4. **Jugar**:
   - Pasá el mouse sobre cada póster para ver la **sinopsis** y las **★ estrellas**.
   - Hacé clic en la **× flotante** (esquina superior derecha de la tarjeta) para eliminar una película.
   - Repetí hasta quedar con 1 ganadora.
5. **Reiniciar**: Usá el botón "↺ Otras 5" para generar un nuevo lote aleatorio.

> **Tip:** Si hay menos de 5 películas en común, el modo usa todas las disponibles.

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
Solicitud enviada a un CORS proxy (AllOrigins / corsproxy.io / thingproxy)
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
Render de tarjetas con título, año y link directo a Letterboxd

        ── Top 5 Eliminator (on-demand enrichment) ──
        ↓
Para cada una de las 5 películas seleccionadas:
  fetch /film/{slug}/ via proxy CORS
        ↓
  Extracción de metadatos adicionales:
    • <meta property="og:image">      → URL del póster real (alta res)
    • <meta property="og:description"> → Sinopsis de la película
    • <meta itemprop="ratingValue">   → Calificación promedio (0–5)
        ↓
Render de tarjetas enriquecidas con póster + sinopsis + ★ estrellas
```

### Por qué se necesita un CORS proxy

Los navegadores aplican la **Same-Origin Policy**: una página web no puede hacer `fetch()` a `letterboxd.com` directamente porque Letterboxd no incluye las cabeceras CORS. El proxy actúa de intermediario: recibe la URL, la descarga desde su servidor y devuelve el HTML al navegador.

### Cadena de proxies (con fallback automático)

La app prueba los proxies **en orden**, pasando al siguiente si uno falla:

1. `api.allorigins.win/get?url=` — devuelve JSON con el HTML en `.contents`
2. `api.allorigins.win/raw?url=` — devuelve HTML crudo
3. `proxy.cors.sh/` — alternativa confiable
4. `api.cors.lol/?url=` — buena alternativa
5. `corsproxy.io/?` — fallback nivel 3
6. `thingproxy.freeboard.io/fetch/` — fallback nivel 4
7. `corsproxy.org/?` — fallback final

### Normalización de IDs

La comparación usa el **slug** de la película (ej. `parasite-2019`, `princess-mononoke`) como identificador canónico. Los slugs son únicos y estables en Letterboxd, garantizando que la intersección sea **100% exacta**.

### Paginación completa

Letterboxd muestra **28 películas por página** en watchlists. La app detecta automáticamente el tamaño de página en la primera respuesta y sigue pidiendo páginas siguientes hasta obtener menos ítems que el umbral. Se soportan hasta **30 páginas** (~840+ películas por usuario).

---

## 🖥️ Desarrollo local

No necesitás ningún servidor especial, pero sí un servidor HTTP local para evitar restricciones CORS del navegador con archivos `file://`:

```bash
# Con Python 3 (más fácil, sin instalación extra)
python -m http.server 8080

# Con Node.js
npx serve .

# Con VS Code: instalá "Live Server" y hacé clic en "Go Live"
```

Abrí `http://localhost:8080` en tu navegador.

---

## ⚙️ Estructura del proyecto

```
letterboxd-matchinglist/
├── index.html    ← Estructura HTML semántica + SEO metadata + overlay Top 5
├── style.css     ← Tema dark, variables CSS, grid responsivo, animaciones + estilos Top 5
├── app.js        ← Fetch, parse, comparación, render, modal + Top 5 Eliminator + enrichMovieMeta
└── README.md     ← Esta documentación
```

---

## ⚠️ Limitaciones conocidas

- **Listas privadas** no son accesibles — Letterboxd no expone contenido privado.
- **Disponibilidad del proxy** — Si los servicios de terceros están caídos, la carga puede tardar más. La app tiene fallback automático entre 7 proxies.
- **Pósters (grid principal)** — Letterboxd carga las imágenes vía JavaScript diferido. El HTML estático devuelve placeholders en la lista/watchlist. Los pósters reales se obtienen solo en el modo Top 5 Eliminator (enrichment on-demand por film).
- **Top 5 — latencia de enrichment** — Cada una de las 5 películas requiere 1 fetch adicional. En paralelo, el proceso tarda ~3-5 segundos según la velocidad del proxy. Si el proxy falla, la tarjeta muestra "Sinopsis no disponible" y usa el placeholder de póster, sin romper la UI.
- **Rate limiting** — Si consultás muchas URLs seguidas, algún proxy puede retornar error 429. Esperá unos segundos y reintentá.

---

## 🧱 Stack técnico

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico |
| Estilos | CSS3 puro — Variables, Grid, Flexbox, Canvas, animaciones |
| Lógica | Vanilla JavaScript (ES2020+) |
| Fuente de datos | Scraping HTML público de Letterboxd |
| Metadatos enriquecidos | Extracción `og:image` + `og:description` + `itemprop:ratingValue` |
| CORS bypass | AllOrigins · cors.sh · cors.lol · corsproxy.io · thingproxy (cadena de fallback) |
| Confetti | Canvas 2D API (vanilla, sin librerías) |
| Deploy | GitHub Pages (estático, sin build) |

---

## 📄 Licencia

MIT — libre uso, modificación y distribución.

---

*Hecho con ❤️ para cinéfilos · Los datos son públicos de [Letterboxd](https://letterboxd.com)*


