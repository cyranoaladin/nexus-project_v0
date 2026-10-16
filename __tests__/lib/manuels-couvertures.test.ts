/**
 * Visuels de couverture — intégrité et budget mobile.
 *
 * Les fichiers sont engendrés par scripts/manuels/build-covers.mjs depuis les
 * couvertures approuvées en service. Ces tests tiennent trois promesses :
 * aucun volume n'est oublié, aucun visuel déclaré ne manque sur le disque, et
 * aucun ne dépasse le budget que peut encaisser une connexion mobile.
 */
import { existsSync, statSync } from 'fs';
import { join } from 'path';

import complet from '@/data/manuels-couvertures.generated.json';
import { getCouverture, VOLUMES_SANS_COUVERTURE } from '@/lib/manuels/covers';
import { getManuelVolumesClient } from '@/lib/manuels/catalogue-client';

const root = process.cwd();
const VOLUMES = getManuelVolumesClient();

/** Budget par visuel : au-delà, une carte coûte trop cher à afficher sur mobile. */
const BUDGET_CARTE_KO = 80;
const BUDGET_ZOOM_KO = 140;

describe('couvertures — périmètre', () => {
  it('les 30 couvertures approuvées sont présentes', () => {
    expect(Object.keys(complet.couvertures)).toHaveLength(30);
  });

  it('chaque volume du catalogue est soit couvert, soit déclaré sans couverture', () => {
    const couverts = new Set(Object.keys(complet.couvertures));
    const sans = new Set(VOLUMES_SANS_COUVERTURE.map((s) => s.id));
    for (const v of VOLUMES) {
      expect(couverts.has(v.id) || sans.has(v.id)).toBe(true);
      expect(couverts.has(v.id) && sans.has(v.id)).toBe(false);
    }
    expect(couverts.size + sans.size).toBe(VOLUMES.length);
  });

  it('les volumes sans couverture sont les annexes et les mathématiques sans paquet', () => {
    const sans = VOLUMES_SANS_COUVERTURE.map((s) => s.id).sort();
    expect(sans).toHaveLength(11);
    for (const id of sans) {
      const v = VOLUMES.find((x) => x.id === id)!;
      expect(v).toBeDefined();
      // soit une annexe (rôle C), soit un volume sans paquet de publication
      expect(v.role.startsWith('C') || !v.packaged).toBe(true);
    }
  });
});

describe('couvertures — fichiers', () => {
  const tous = Object.entries(complet.couvertures);

  it.each(tous)('%s : tous les fichiers déclarés existent', (_id, faces: any) => {
    for (const face of Object.values(faces) as any[]) {
      for (const fichier of Object.values(face.fichiers) as any[]) {
        const chemin = join(root, 'public', fichier.src.replace(/^\//, ''));
        expect(existsSync(chemin)).toBe(true);
        expect(statSync(chemin).size).toBe(fichier.bytes);
      }
    }
  });

  it('aucun visuel de carte ne dépasse le budget mobile', () => {
    const trop: string[] = [];
    for (const [id, faces] of tous as any[]) {
      for (const w of complet.cardWidths) {
        const f = faces.recto.fichiers[w];
        if (f.bytes > BUDGET_CARTE_KO * 1024) trop.push(`${id} ${w}w = ${Math.round(f.bytes / 1024)} Ko`);
      }
    }
    expect(trop).toEqual([]);
  });

  it('aucun agrandissement ne dépasse son budget', () => {
    const trop: string[] = [];
    for (const [id, faces] of tous as any[]) {
      for (const [nom, face] of Object.entries(faces) as any[]) {
        const f = face.fichiers[complet.zoomWidth];
        if (f.bytes > BUDGET_ZOOM_KO * 1024) trop.push(`${id} ${nom} = ${Math.round(f.bytes / 1024)} Ko`);
      }
    }
    expect(trop).toEqual([]);
  });

  it('chaque couverture porte l’empreinte de son PDF d’origine', () => {
    for (const [, faces] of tous as any[]) {
      for (const face of Object.values(faces) as any[]) {
        expect(face.sourceSha256).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });
});

describe('couvertures — ce que reçoit le navigateur', () => {
  it('une couverture est servie en deux largeurs, avec ses dimensions', () => {
    const c = getCouverture('pc-t')!;
    expect(c).toBeDefined();
    expect(c.srcSet).toMatch(/220w/);
    expect(c.srcSet).toMatch(/440w/);
    expect(c.width).toBeGreaterThan(0);
    expect(c.height).toBeGreaterThan(c.width); // portrait, format A4
    expect(c.lqip.startsWith('data:image/webp;base64,')).toBe(true);
  });

  it('l’agrandissement propose le recto et la quatrième de couverture', () => {
    const c = getCouverture('pc-t')!;
    expect(c.zoom.recto).toMatch(/\.webp$/);
    expect(c.zoom.verso).toMatch(/\.webp$/);
  });

  it('un volume sans couverture ne renvoie rien, plutôt qu’un visuel cassé', () => {
    expect(getCouverture('philosophie-epicure')).toBeUndefined();
    expect(getCouverture('neant-x')).toBeUndefined();
  });
});
