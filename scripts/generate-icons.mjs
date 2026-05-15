import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(here, '..', 'public');

function renderSvg(svgPath, outPath, size) {
  const svg = readFileSync(svgPath, 'utf8');
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  });
  const png = resvg.render().asPng();
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(`✓ ${outPath} (${size}px, ${(png.byteLength / 1024).toFixed(1)} kB)`);
}

const iconSvg = resolve(publicDir, 'icon.svg');
const maskableSvg = resolve(publicDir, 'icon-maskable.svg');

renderSvg(iconSvg, resolve(publicDir, 'icon-192.png'), 192);
renderSvg(iconSvg, resolve(publicDir, 'icon-512.png'), 512);
renderSvg(maskableSvg, resolve(publicDir, 'icon-maskable-512.png'), 512);
renderSvg(iconSvg, resolve(publicDir, 'apple-touch-icon.png'), 180);
renderSvg(iconSvg, resolve(publicDir, 'favicon-32.png'), 32);
