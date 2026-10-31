import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'prototypes/style-lab');
const read = filename => fs.readFile(path.join(source, filename), 'utf8');
let fonts = await read('assets/fonts.css');
for (const filename of new Set([...fonts.matchAll(/url\(([^)]+)\)/g)].map(match => match[1]))) {
  const data = await fs.readFile(path.join(source, 'assets', filename));
  fonts = fonts.replaceAll(`url(${filename})`, `url(data:font/woff2;base64,${data.toString('base64')})`);
}
const model = (await read('model.mjs')).replace(/\bexport /g, '');
const leafletCss=(await fs.readFile(path.join(root,'node_modules/leaflet/dist/leaflet.css'),'utf8')).replace(/url\([^)]*\)/g,'none');
const css = leafletCss+'\n'+await read('styles.css');
const picker = '';
const translations = await read('translations.js');
const chartBuild = await build({entryPoints:[path.join(root,'components/chart-adapter.tsx')],bundle:true,write:false,minify:true,format:'iife',platform:'browser',define:{'process.env.NODE_ENV':'"production"'}});
const charts = chartBuild.outputFiles[0].text.replaceAll('</script','<\\/script');
const app = (await read('commerce.js'))+'\n'+(await read('app.js'));
const icons = await read('assets/icons.json');
const googleLogo='data:image/png;base64,'+(await fs.readFile(path.join(source,'assets/google-logo.png'))).toString('base64');
const favicon = Buffer.from(await fs.readFile(path.join(root, 'favicon.svg'))).toString('base64');
const html = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#ffffff"><meta name="description" content="Tarozi — закупки и сравнение цен."><title>Tarozi</title><link rel="icon" href="data:image/svg+xml;base64,${favicon}"><style>${fonts}\n${css}\n${picker}</style></head><body><a class="skip-link" href="#main-content">К содержимому</a><div id="stage"></div><div class="sr-only" id="announcer" aria-live="polite"></div><noscript>Для интерактивной демонстрации включите JavaScript в браузере.</noscript><script>${charts}\nconst ICONS = ${icons};\n${model}\n${translations}\n${app}</script></body></html>`;
await fs.writeFile(path.join(root, 'index.html'), html.replace('const ICONS =',`const GOOGLE_LOGO = ${JSON.stringify(googleLogo)};\nconst ICONS =`));
console.log(`Built self-contained index.html: ${Math.round(Buffer.byteLength(html) / 1024)} KB; Studio, embedded fonts and icons.`);
