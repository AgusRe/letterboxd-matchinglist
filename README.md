# 🎬 Letterboxd Match

> **Descubrí qué películas tienen en común tus amigos en Letterboxd** — sin registrarte, sin API key, sin servidor.

**[🌐 Ver demo en vivo →](https://agusboom.github.io/letterboxd-matchinglist/)**

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
| 🎭 **Pósters y detalles** | Modal con info de cada película |
| 📊 **Películas únicas** | Muestra lo exclusivo de cada usuario en pestañas |
| 💯 **100% estático** | Sin backend, sin build step, desplegable en GitHub Pages |

---

## ✅ Validado con usuarios reales

La aplicación fue **testeada y validada** específicamente con las watchlists de usuarios reales, utilizando URLs de listas públicas, ésta extrae correctamente **todas las películas** de cada watchlist, calcula la intersección exacta y muestra las películas en común y las exclusivas de cada usuario, siendo una herramienta útil para decidir qué ver juntos.

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
HTML de la página de Letterboxd devuelto como texto
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
```

### Por qué se necesita un CORS proxy

Los navegadores aplican la **Same-Origin Policy**: una página web no puede hacer `fetch()` a `letterboxd.com` directamente porque Letterboxd no incluye las cabeceras CORS. El proxy actúa de intermediario: recibe la URL, la descarga desde su servidor y devuelve el HTML al navegador.

### Cadena de proxies (con fallback automático)

La app prueba los proxies **en orden**, pasando al siguiente si uno falla:

1. `api.allorigins.win/get?url=` — devuelve JSON con el HTML en `.contents`
2. `api.allorigins.win/raw?url=` — devuelve HTML crudo
3. `corsproxy.io/?` — devuelve HTML crudo
4. `thingproxy.freeboard.io/fetch/` — fallback final

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
├── index.html    ← Estructura HTML semántica + SEO metadata
├── style.css     ← Tema dark, variables CSS, grid responsivo, animaciones
├── app.js        ← Fetch, parse, comparación, render, modal
└── README.md     ← Esta documentación
```

---

## ⚠️ Limitaciones conocidas

- **Listas privadas** no son accesibles — Letterboxd no expone contenido privado.
- **Disponibilidad del proxy** — Si los servicios de terceros están caídos, la carga puede tardar más. La app tiene fallback automático entre 4 proxies.
- **Pósters** — Letterboxd carga las imágenes de forma diferida vía JavaScript; el HTML estático devuelve placeholders en muchos casos. Los títulos y slugs siempre se obtienen correctamente.
- **Rate limiting** — Si consultás muchas URLs seguidas, algún proxy puede retornar error 429. Esperá unos segundos y reintentá.

---

## 🧱 Stack técnico

| Capa | Tecnología |
|---|---|
| Estructura | HTML5 semántico |
| Estilos | CSS3 puro — Variables, Grid, Flexbox, animaciones |
| Lógica | Vanilla JavaScript (ES2020+) |
| Fuente de datos | Scraping HTML público de Letterboxd |
| CORS bypass | AllOrigins · corsproxy.io · thingproxy (cadena de fallback) |
| Deploy | GitHub Pages (estático, sin build) |

---

## 📄 Licencia

MIT — libre uso, modificación y distribución.

---

*Hecho con ❤️ para cinéfilos · Los datos son públicos de [Letterboxd](https://letterboxd.com)*