#!/usr/bin/env node
/** Image Open Graph 1200×630 : logo blanc de la charte sur fond navy. */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const NAVY = '#07112A', OR = '#C49526';
const racine = process.cwd();
const logo = readFileSync(path.join(racine, 'public/inscription-bac-2027/nexus-logo-horizontal-blanc.svg'));
const largeur = 620; // le logo fait 385,68 × 142,29 : on garde le rapport
const hauteur = Math.round((142.29 / 385.68) * largeur);

const fond = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
     <rect width="1200" height="630" fill="${NAVY}"/>
     <rect y="624" width="1200" height="6" fill="${OR}"/>
   </svg>`,
);

const rendu = await sharp(logo).resize({ width: largeur }).png().toBuffer();
const image = await sharp(fond)
  .composite([{ input: rendu, left: Math.round((1200 - largeur) / 2), top: Math.round((630 - hauteur) / 2) }])
  .png()
  .toBuffer();
const cible = path.join(racine, 'public/inscription-bac-2027/og-inscription-2027.png');
writeFileSync(cible, image);
const meta = await sharp(image).metadata();
console.log(`  og-inscription-2027.png  ${meta.width}×${meta.height}  ${image.length} octets`);
