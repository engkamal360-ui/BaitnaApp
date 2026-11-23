import * as esbuild from 'esbuild';
import fs from 'fs';
fs.rmSync('www', { recursive: true, force: true });
fs.mkdirSync('www/fonts', { recursive: true });
await esbuild.build({ entryPoints: ['main.js'], bundle: true, minify: true, format: 'iife', target: 'chrome89',
  loader: { '.html': 'text' }, outfile: 'www/app.js' });
const fdir = 'node_modules/@fontsource/ibm-plex-sans-arabic/files/';
let faces = '';
for (const sub of ['arabic', 'latin']) for (const w of [400, 600, 700]) {
  const f = `ibm-plex-sans-arabic-${sub}-${w}-normal.woff2`;
  if (!fs.existsSync(fdir + f)) continue;
  fs.copyFileSync(fdir + f, 'www/fonts/' + f);
  faces += `@font-face{font-family:'IBM Plex Sans Arabic';font-weight:${w};font-display:swap;src:url(fonts/${f}) format('woff2');${sub === 'latin' ? 'unicode-range:U+0000-00FF,U+2000-206F,U+20AC;' : ''}}\n`;
}
const css = faces + `html,body{margin:0;height:100%;background:#F4F3EF}#root{height:100%}
.app{width:100% !important;height:100% !important;padding-top:env(safe-area-inset-top)}
.nav{padding-bottom:calc(10px + env(safe-area-inset-bottom)) !important}
*{-webkit-tap-highlight-color:transparent}
` + fs.readFileSync('styles.css', 'utf8');
fs.writeFileSync('www/index.html', `<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="theme-color" content="#0F766E"><title>بيتنا</title>
<style>${css}</style></head>
<body><div id="root"></div><script src="app.js"></script></body></html>`);
console.log('built', fs.statSync('www/app.js').size);
