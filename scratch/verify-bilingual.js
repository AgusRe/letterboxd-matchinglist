const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
console.log('Running bilingual verification in:', rootDir);

let errors = 0;

function check(desc, condition) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
  } else {
    console.error(`  [FAIL] ${desc}`);
    errors++;
  }
}

// 1. Check index.html (ES)
console.log('\n1. Checking root index.html (ES):');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
check('lang is "es"', indexHtml.includes('<html lang="es">'));
check('canonical is root URL', indexHtml.includes('<link rel="canonical" href="https://agusre.github.io/letterboxd-matchinglist/" />'));
check('hreflang es points to root', indexHtml.includes('<link rel="alternate" hreflang="es" href="https://agusre.github.io/letterboxd-matchinglist/" />'));
check('hreflang en points to /en/', indexHtml.includes('<link rel="alternate" hreflang="en" href="https://agusre.github.io/letterboxd-matchinglist/en/" />'));
check('hreflang x-default points to /en/', indexHtml.includes('<link rel="alternate" hreflang="x-default" href="https://agusre.github.io/letterboxd-matchinglist/en/" />'));
check('og:locale is es_ES', indexHtml.includes('<meta property="og:locale" content="es_ES" />'));
check('og:locale:alternate is en_US', indexHtml.includes('<meta property="og:locale:alternate" content="en_US" />'));
check('lang toggle link present with id="lang-toggle"', indexHtml.includes('id="lang-toggle"'));
check('i18n.js is loaded before app.js', indexHtml.includes('<script src="i18n.js"></script>') && indexHtml.includes('<script src="app.js"></script>'));
check('Google verification token preserved', indexHtml.includes('content="EDRrY5QHJaayxYXenNFMtKEMniORFIh-KKYDcwH_wjo"'));

// 2. Check JSON-LD in index.html
console.log('\n2. Checking JSON-LD in index.html (ES):');
const jsonLdEsMatch = indexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check('JSON-LD script block found in index.html', !!jsonLdEsMatch);
if (jsonLdEsMatch) {
  try {
    const jsonLdEs = JSON.parse(jsonLdEsMatch[1]);
    check('JSON-LD is valid JSON', true);
    check('JSON-LD contains 3 graph items', jsonLdEs['@graph'] && jsonLdEs['@graph'].length === 3);
    check('JSON-LD has Spanish WebApplication', jsonLdEs['@graph'][0].name === 'Letterboxd Matcher');
    check('JSON-LD has FAQ in Spanish', jsonLdEs['@graph'][2].mainEntity[0].name.includes('¿Cómo comparar'));
  } catch (e) {
    check('JSON-LD parse error: ' + e.message, false);
  }
}

// 3. Check en/index.html (EN)
console.log('\n3. Checking en/index.html (EN):');
const enIndexHtml = fs.readFileSync(path.join(rootDir, 'en', 'index.html'), 'utf8');
check('lang is "en"', enIndexHtml.includes('<html lang="en">'));
check('canonical is /en/ URL', enIndexHtml.includes('<link rel="canonical" href="https://agusre.github.io/letterboxd-matchinglist/en/" />'));
check('hreflang es points to root', enIndexHtml.includes('<link rel="alternate" hreflang="es" href="https://agusre.github.io/letterboxd-matchinglist/" />'));
check('hreflang en points to /en/', enIndexHtml.includes('<link rel="alternate" hreflang="en" href="https://agusre.github.io/letterboxd-matchinglist/en/" />'));
check('hreflang x-default points to /en/', enIndexHtml.includes('<link rel="alternate" hreflang="x-default" href="https://agusre.github.io/letterboxd-matchinglist/en/" />'));
check('og:locale is en_US', enIndexHtml.includes('<meta property="og:locale" content="en_US" />'));
check('og:locale:alternate is es_ES', enIndexHtml.includes('<meta property="og:locale:alternate" content="es_ES" />'));
check('lang toggle link present with href="../"', enIndexHtml.includes('href="../"') && enIndexHtml.includes('id="lang-toggle"'));
check('relative CSS path is ../style.css?v=2', enIndexHtml.includes('href="../style.css?v=2"'));
check('relative i18n script path is ../i18n.js', enIndexHtml.includes('<script src="../i18n.js"></script>'));
check('relative app script path is ../app.js', enIndexHtml.includes('<script src="../app.js"></script>'));
check('Google verification token preserved', enIndexHtml.includes('content="EDRrY5QHJaayxYXenNFMtKEMniORFIh-KKYDcwH_wjo"'));

// 4. Check JSON-LD in en/index.html
console.log('\n4. Checking JSON-LD in en/index.html (EN):');
const jsonLdEnMatch = enIndexHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
check('JSON-LD script block found in en/index.html', !!jsonLdEnMatch);
if (jsonLdEnMatch) {
  try {
    const jsonLdEn = JSON.parse(jsonLdEnMatch[1]);
    check('JSON-LD is valid JSON', true);
    check('JSON-LD contains 3 graph items', jsonLdEn['@graph'] && jsonLdEn['@graph'].length === 3);
    check('JSON-LD has English description', jsonLdEn['@graph'][0].description.includes('Compare Letterboxd watchlists'));
    check('JSON-LD has FAQ in English', jsonLdEn['@graph'][2].mainEntity[0].name.includes('How do I compare'));
  } catch (e) {
    check('JSON-LD parse error: ' + e.message, false);
  }
}

// 5. Check i18n.js
console.log('\n5. Checking i18n.js:');
const i18nJs = fs.readFileSync(path.join(rootDir, 'i18n.js'), 'utf8');
check('i18n.js exists and has TRANSLATIONS', i18nJs.includes('const TRANSLATIONS = {') && i18nJs.includes('es:') && i18nJs.includes('en:'));
check('i18n.js has I18N.t helper', i18nJs.includes('t(key, params'));

// 6. Check sitemap.xml
console.log('\n6. Checking sitemap.xml:');
const sitemapXml = fs.readFileSync(path.join(rootDir, 'sitemap.xml'), 'utf8');
check('sitemap has Spanish root URL', sitemapXml.includes('<loc>https://agusre.github.io/letterboxd-matchinglist/</loc>'));
check('sitemap has English /en/ URL', sitemapXml.includes('<loc>https://agusre.github.io/letterboxd-matchinglist/en/</loc>'));
check('sitemap has hreflang x-default pointing to /en/', sitemapXml.includes('hreflang="x-default" href="https://agusre.github.io/letterboxd-matchinglist/en/"'));

console.log(`\n========================================`);
console.log(`Verification finished with ${errors} error(s).`);
console.log(`========================================\n`);

process.exit(errors > 0 ? 1 : 0);
