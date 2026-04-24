/**
 * @file Generate the full axerra favicon asset set from Inter Medium.
 * @module client/scripts/generate-favicons
 *
 * Reads Inter Medium from @fontsource/inter, extracts the lowercase "a" glyph
 * as an SVG path, composes a path-based favicon.svg (navy "a" + gold square
 * dot on an off-white rounded square), rasterizes it with sharp to every
 * required PNG size, and composes favicon.ico from 16/32/48.
 *
 * Outputs land in both `apps/client/public/` (runtime) and
 * `docs/branding/files/` (docs reference for the preview HTML).
 *
 * Run: `npm -w apps/client run favicons`
 *
 * Copyright (c) 2025 – present Axerra LLC. All rights reserved.
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { openSync as openFontSync } from 'fontkit';
import sharp from 'sharp';
import pngToIco from 'png-to-ico';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const CLIENT_ROOT = resolve(__dirname, '..');
const PUBLIC_DIR = resolve(CLIENT_ROOT, 'public');
const DOCS_DIR = resolve(CLIENT_ROOT, '../../docs/branding/files');

const FONT_PATH = require.resolve('@fontsource/inter/files/inter-latin-500-normal.woff');

const COLORS = {
  bg: '#FAFAF7',
  navy: '#2F3E52',
  gold: '#F4B000',
};

const CANVAS = 64;
const BG_RADIUS = CANVAS * 0.22;

/**
 * Compose a favicon SVG for the given dot-ratio.
 *
 * @param {number} dotRatio Proportion of glyph height used for the gold dot
 *   (≈0.21 for default sizes, lifted at 16px so the accent survives downsampling).
 */
function composeSvg({ dotRatio }) {
  const font = openFontSync(FONT_PATH);
  const run = font.layout('a');
  const glyph = run.glyphs[0];
  const bbox = glyph.bbox;

  const glyphHeightFU = bbox.maxY - bbox.minY;
  const glyphWidthFU = bbox.maxX - bbox.minX;

  // Target: "a" occupies ~50% of canvas height, visually centered.
  const targetGlyphHeight = CANVAS * 0.5;
  const scale = targetGlyphHeight / glyphHeightFU;

  const scaledGlyphWidth = glyphWidthFU * scale;
  const scaledGlyphHeight = glyphHeightFU * scale;
  const dotSize = scaledGlyphHeight * dotRatio;
  const gap = scaledGlyphHeight * 0.06;

  const groupWidth = scaledGlyphWidth + gap + dotSize;
  const groupX = (CANVAS - groupWidth) / 2;

  // Vertical centering: position baseline so the scaled bbox is centered on canvas.
  const glyphCenterY = CANVAS / 2;
  const baselineY = glyphCenterY + ((bbox.maxY + bbox.minY) / 2) * scale;

  // Path transform: translate to groupX (accounting for bbox.minX), baselineY.
  // Scale y by -scale to flip font (y-up) into SVG (y-down).
  const tx = groupX - bbox.minX * scale;
  const ty = baselineY;
  const pathTransform = `translate(${tx.toFixed(4)} ${ty.toFixed(4)}) scale(${scale.toFixed(6)} ${(-scale).toFixed(6)})`;

  const dotX = groupX + scaledGlyphWidth + gap;
  const dotY = baselineY - dotSize;

  const glyphPathD = glyph.path.toSVG();

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">
  <rect width="${CANVAS}" height="${CANVAS}" rx="${BG_RADIUS}" ry="${BG_RADIUS}" fill="${COLORS.bg}"/>
  <path d="${glyphPathD}" fill="${COLORS.navy}" transform="${pathTransform}"/>
  <rect x="${dotX.toFixed(4)}" y="${dotY.toFixed(4)}" width="${dotSize.toFixed(4)}" height="${dotSize.toFixed(4)}" fill="${COLORS.gold}"/>
</svg>
`;
}

async function writeBoth(relativePath, buffer) {
  await writeFile(resolve(PUBLIC_DIR, relativePath), buffer);
  await writeFile(resolve(DOCS_DIR, relativePath), buffer);
}

async function rasterize(svg, size) {
  return sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
}

async function main() {
  await mkdir(PUBLIC_DIR, { recursive: true });
  await mkdir(DOCS_DIR, { recursive: true });

  const defaultSvg = composeSvg({ dotRatio: 0.21 });
  const tinySvg = composeSvg({ dotRatio: 0.27 }); // 16px size-adaptive variant

  await writeBoth('favicon.svg', Buffer.from(defaultSvg));

  const png16 = await rasterize(tinySvg, 16);
  const png32 = await rasterize(defaultSvg, 32);
  const png48 = await rasterize(defaultSvg, 48);
  const png64 = await rasterize(defaultSvg, 64);
  const png128 = await rasterize(defaultSvg, 128);
  const png180 = await rasterize(defaultSvg, 180);
  const png192 = await rasterize(defaultSvg, 192);
  const png512 = await rasterize(defaultSvg, 512);

  await writeBoth('favicon-16.png', png16);
  await writeBoth('favicon-32.png', png32);
  await writeBoth('favicon-48.png', png48);
  await writeBoth('favicon-64.png', png64);
  await writeBoth('favicon-128.png', png128);
  await writeBoth('favicon-512.png', png512);
  await writeBoth('apple-touch-icon.png', png180);
  await writeBoth('android-chrome-192.png', png192);
  await writeBoth('android-chrome-512.png', png512);

  const ico = await pngToIco([png16, png32, png48]);
  await writeBoth('favicon.ico', ico);

  console.log('Favicon set written to:');
  console.log(`  ${PUBLIC_DIR}`);
  console.log(`  ${DOCS_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
