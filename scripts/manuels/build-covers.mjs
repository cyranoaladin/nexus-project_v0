#!/usr/bin/env node
/**
 * Fabrique les visuels de couverture de la page /manuels.
 *
 *   node scripts/manuels/build-covers.mjs [--source <racine éditoriale>]
 *
 * Outil d'atelier, exécuté localement par l'éditeur : il lit la zone de
 * publication de la Maison édition, qui n'existe ni en intégration continue ni
 * en production. Ses sorties, elles, sont versionnées.
 *
 * Trois garanties :
 *  — les PDF d'origine ne sont QUE lus, jamais écrits ;
 *  — l'empreinte sha256 de chaque source est vérifiée contre celle que porte
 *    son MANIFEST.json, et une couverture qui ne concorde pas est refusée,
 *    jamais publiée en silence ;
 *  — seules les couvertures « APPROUVEE_EN_SERVICE » sont retenues.
 *
 * `images.unoptimized` est vrai dans next.config.mjs : Next ne redimensionne
 * rien à la volée. Les tailles sont donc produites ici, et la page sert un
 * srcset. Le minuscule aperçu en ligne (base64) évite le saut de mise en page
 * sur mobile, là où la bascule de hauteur est la plus désagréable.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_SOURCE = join(homedir(), 'Documents', 'Manuels_HGGSP_HLP_SES_SVT_PHILO_HG_EMC');
const OUT_DIR = join(ROOT, 'public', 'manuels', 'couvertures');
const DATA_FILE = join(ROOT, 'data', 'manuels-couvertures.generated.json');
// Fiche minimale embarquée par la page : srcset prémâché, aperçu flou, liens
// d'agrandissement. Tout le reste — empreintes, poids, statuts — reste dans la
// fiche complète, qui ne part jamais dans le navigateur.
const CLIENT_FILE = join(ROOT, 'data', 'manuels-couvertures-client.generated.json');

// Largeurs servies. 220 et 440 couvrent la carte du catalogue en 1x et 2x ;
// 560 couvre l'agrandissement, y compris en plein écran sur un téléphone.
const CARD_WIDTHS = [220, 440];
const ZOOM_WIDTH = 560;
const LQIP_WIDTH = 16;

function arg(nom, defaut) {
  const i = process.argv.indexOf(nom);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : defaut;
}

function sha256(chemin) {
  return createHash('sha256').update(readFileSync(chemin)).digest('hex');
}

function manifests(racine) {
  const base = join(racine, '00_PUBLICATION');
  const out = [];
  for (const collection of readdirSync(base)) {
    const cheminCollection = join(base, collection);
    if (!statSync(cheminCollection).isDirectory()) continue;
    for (const volume of readdirSync(cheminCollection)) {
      const m = join(cheminCollection, volume, 'MANIFEST.json');
      try {
        if (statSync(m).isFile()) out.push(m);
      } catch {
        /* pas de manifeste dans ce dossier */
      }
    }
  }
  return out.sort();
}

async function rendre(pdf, slug, face, travail) {
  const base = join(travail, `${slug}-${face}`);
  execFileSync('pdftoppm', ['-f', '1', '-l', '1', '-r', '150', '-png', '-singlefile', pdf, base]);
  const png = `${base}.png`;

  const fichiers = {};
  const largeurs = face === 'recto' ? [...CARD_WIDTHS, ZOOM_WIDTH] : [ZOOM_WIDTH];
  for (const w of largeurs) {
    const nom = `${slug}-${face}-${w}.webp`;
    const info = await sharp(png)
      .resize({ width: w })
      .webp({ quality: w <= 240 ? 72 : 76, effort: 6 })
      .toFile(join(OUT_DIR, nom));
    fichiers[w] = { src: `/manuels/couvertures/${nom}`, width: info.width, height: info.height, bytes: info.size };
  }

  const flou = await sharp(png).resize({ width: LQIP_WIDTH }).webp({ quality: 40 }).toBuffer();
  return { fichiers, lqip: `data:image/webp;base64,${flou.toString('base64')}` };
}

async function main() {
  const source = resolve(arg('--source', DEFAULT_SOURCE));
  mkdirSync(OUT_DIR, { recursive: true });

  // Les limaces viennent du socle canonique : elles ne sont pas recalculées
  // ici, pour qu'un visuel ne puisse jamais porter un identifiant que le
  // catalogue ignore.
  const canonical = JSON.parse(readFileSync(join(ROOT, 'data', 'pricing.canonical.json'), 'utf-8'));
  const parVolumeId = new Map(canonical.manuels.volumes.map((v) => [v.volumeId, v]));

  const travail = mkdtempSync(join(tmpdir(), 'nexus-couvertures-'));
  const couvertures = {};
  const sans = [];
  const refusees = [];
  let octets = 0;

  try {
    for (const m of manifests(source)) {
      const d = JSON.parse(readFileSync(m, 'utf-8'));
      const volume = parVolumeId.get(d.volume_id);
      if (!volume) {
        refusees.push(`${d.volume_id} : absent du socle canonique`);
        continue;
      }

      const faces = {};
      for (const [face, cle] of [['recto', 'front_cover'], ['verso', 'back_cover']]) {
        const fiche = d[cle];
        if (!fiche || fiche.status !== 'APPROUVEE_EN_SERVICE' || !fiche.target) continue;
        const pdf = join(source, fiche.target);
        const empreinte = sha256(pdf);
        if (fiche.sha256 && empreinte !== fiche.sha256) {
          refusees.push(`${d.volume_id} ${face} : empreinte non concordante`);
          continue;
        }
        faces[face] = { ...(await rendre(pdf, volume.id, face, travail)), sourceSha256: empreinte };
      }

      if (!faces.recto) {
        sans.push({ id: volume.id, volumeId: d.volume_id, raison: d.front_cover?.status ?? 'aucune couverture déclarée' });
        continue;
      }
      couvertures[volume.id] = faces;
      for (const f of Object.values(faces)) {
        for (const v of Object.values(f.fichiers)) octets += v.bytes;
      }
    }
  } finally {
    rmSync(travail, { recursive: true, force: true });
  }

  // Les volumes du catalogue qui n'ont aucun paquet de publication n'ont pas
  // de manifeste : ils ne passent pas par la boucle ci-dessus.
  for (const v of canonical.manuels.volumes) {
    if (couvertures[v.id]) continue;
    if (sans.some((s) => s.id === v.id)) continue;
    sans.push({ id: v.id, volumeId: v.volumeId, raison: 'aucun paquet de publication' });
  }

  const client = {};
  for (const [id, faces] of Object.entries(couvertures)) {
    const carte = CARD_WIDTHS.map((w) => faces.recto.fichiers[w]);
    const plusGrande = carte[carte.length - 1];
    client[id] = {
      lqip: faces.recto.lqip,
      width: plusGrande.width,
      height: plusGrande.height,
      src: plusGrande.src,
      srcSet: carte.map((f) => `${f.src} ${f.width}w`).join(', '),
      zoom: {
        recto: faces.recto.fichiers[ZOOM_WIDTH].src,
        ...(faces.verso ? { verso: faces.verso.fichiers[ZOOM_WIDTH].src } : {}),
      },
    };
  }

  writeFileSync(
    CLIENT_FILE,
    `${JSON.stringify({ _note: 'ENGENDRÉ — voir scripts/manuels/build-covers.mjs.', couvertures: client }, null, 2)}\n`,
  );

  writeFileSync(
    DATA_FILE,
    `${JSON.stringify(
      {
        _note:
          'ENGENDRÉ par scripts/manuels/build-covers.mjs depuis les couvertures approuvées en service de la zone de publication. Ne pas éditer à la main.',
        cardWidths: CARD_WIDTHS,
        zoomWidth: ZOOM_WIDTH,
        couvertures,
        sansCouverture: sans.sort((a, b) => a.id.localeCompare(b.id)),
      },
      null,
      2,
    )}\n`,
  );

  console.log(`✓ ${Object.keys(couvertures).length} couvertures, ${(octets / 1048576).toFixed(1)} Mo sur disque`);
  console.log(`· fiche client : ${(statSync(CLIENT_FILE).size / 1024).toFixed(1)} Ko`);
  console.log(`· ${sans.length} volumes sans couverture (vignette typographique)`);
  for (const r of refusees) console.error(`✗ ${r}`);
  if (refusees.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
