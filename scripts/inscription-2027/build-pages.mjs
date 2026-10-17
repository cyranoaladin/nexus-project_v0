#!/usr/bin/env node
/**
 * Produit les pages « Inscription 2027 » servies par le site, à partir des
 * fichiers audités de `content/inscription-2027/source/`.
 *
 * Pourquoi un document statique et non un composant React : les trois
 * fonctionnalités de ces pages — compte à rebours, check-list mémorisée,
 * boutons de copie — vivent dans un `<script>` inline. Un HTML injecté par
 * `dangerouslySetInnerHTML` n'exécute pas ses `<script>` : le portage en
 * composant les aurait tuées en silence. Le document est donc servi tel quel,
 * par un rewrite, comme /planning l'est déjà dans ce dépôt.
 *
 * Ce script n'édite jamais le texte du document. Il ajoute seulement :
 *   · le squelette que la plateforme de rédaction injectait (doctype, charset,
 *     viewport, socle de styles), reproduit et non deviné ;
 *   · les métadonnées de référencement, dérivées du document lui-même ;
 *   · le logo de la charte, absent du document d'origine.
 * Il retire le seul élément propre à cette plateforme :
 *   `<meta name="claude:viewport-fit-sides">`.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const RACINE = process.cwd();
const SOURCE = path.join(RACINE, 'content/inscription-2027/source');
const CIBLE = path.join(RACINE, 'public/inscription-bac-2027');
const SITE = 'https://nexusreussite.academy';

export const PAGES = [
  {
    slug: 'general',
    chemin: '/inscription-bac-2027/general',
    titre: 'Inscription au bac général 2027 en candidat individuel — Tunisie',
    sujet: 'Bac général',
  },
  {
    slug: 'stmg',
    chemin: '/inscription-bac-2027/stmg',
    titre: 'Inscription au bac STMG 2027 en candidat individuel — Tunisie',
    sujet: 'Bac STMG',
  },
];

/** Le document s'arrête à `</style>` pour la tête ; le reste est le corps. */
function decouper(source) {
  const fin = source.indexOf('</style>');
  if (fin === -1) throw new Error('STYLE_DE_TETE_INTROUVABLE');
  return { tete: source.slice(0, fin + '</style>'.length), corps: source.slice(fin + '</style>'.length) };
}

/**
 * Un repère est du texte simple. On ne le nettoie pas, on refuse ce qui n'en
 * est pas : la valeur finit dans un attribut `content="…"`, et un balisage
 * rogné par une expression régulière se recolle (« <scr<script>ipt> »). Du
 * balisage apparu dans la source devient donc une erreur de fabrication,
 * visible, jamais un contenu amputé en silence puis réinjecté.
 */
function texteSimple(valeur) {
  if (/[<>&"]/.test(valeur)) throw new Error(`REPERE_NON_TEXTUEL: ${valeur}`);
  return valeur.trim();
}

/** Les repères datés du document : « Ouverture → 16 oct. 2026, 8 h », etc. */
export function reperes(source) {
  const bloc = /<dl class="ouverture">([\s\S]*?)<\/dl>/.exec(source);
  if (!bloc) throw new Error('BLOC_OUVERTURE_INTROUVABLE');
  const paires = [...bloc[1].matchAll(/<dt>([^<>]*)<\/dt><dd>([^<>]*)<\/dd>/g)];
  if (paires.length === 0) throw new Error('REPERES_INTROUVABLES');
  return paires.map(([, cle, valeur]) => [texteSimple(cle), texteSimple(valeur)]);
}

/** La clôture, lue sur la seule écriture lisible par machine du document. */
export function cloture(source) {
  const trouve = /Date\.parse\("([^"]+)"\)/.exec(source);
  if (!trouve) throw new Error('CIBLE_DU_COMPTE_A_REBOURS_INTROUVABLE');
  return trouve[1];
}

/**
 * Les deux adresses officielles, lues sur le document audité — bloc « Les deux
 * seules adresses utiles ». Elles ne sont écrites nulle part ailleurs : le jour
 * où un portail déménage, corriger le dossier suffit, et le site suit.
 *
 * L'hôte attendu fait partie du contrat : un lien qui pointerait ailleurs ne
 * serait pas le portail officiel, et vaut mieux une fabrication arrêtée qu'une
 * famille envoyée sur un site qui n'est pas celui de l'examen.
 */
const LIENS = /<a href="(https:\/\/[^"]+)"/g;

function hoteDe(url) {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function lienVers(source, hote, erreur) {
  // L'hote est compare apres analyse de l'adresse, jamais au motif : un
  // « https://candidat.examens-concours.gouv.fr.autre-site.tn/ » satisfait une
  // expression reguliere naive et n'est pas le portail de l'examen.
  const trouvees = new Set(
    [...source.matchAll(LIENS)].map(([, url]) => url).filter((url) => hoteDe(url) === hote),
  );
  if (trouvees.size === 0) throw new Error(erreur);
  // Le document cite l'adresse plus d'une fois. Toutes doivent s'accorder :
  // deux adresses differentes dans un meme dossier, c'est une relecture a
  // refaire, pas un choix a trancher par l'ordre d'apparition.
  if (trouvees.size > 1) throw new Error(`${erreur.replace('_INTROUVABLE', '')}_DIVERGENT_DANS_LE_DOCUMENT`);
  return [...trouvees][0];
}

/** Le portail d'inscription : « Pour s'inscrire — Cyclades, espace candidat ». */
export function lienCyclades(source) {
  return lienVers(source, 'candidat.examens-concours.gouv.fr', 'LIEN_CYCLADES_INTROUVABLE');
}

/** Le suivi de session : « Institut français de Tunisie, Examens & concours ». */
export function lienInstitutFrancais(source) {
  return lienVers(source, 'www.institutfrancais-tunisie.com', 'LIEN_IFT_INTROUVABLE');
}

/**
 * Texte d'un fragment du document : le balisage est retiré jusqu'à point fixe,
 * puis le résultat est **vérifié**. Un nettoyage peut être incomplet ; une
 * vérification, non. Ce qui sort d'ici n'a plus ni chevron ni entité inconnue,
 * et peut donc entrer dans un JSON-LD sans refermer la balise qui le porte.
 */
const ENTITES = new Map([['&amp;', '&'], ['&nbsp;', '\u00a0'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&#39;', "'"]]);

function texteDuFragment(fragment) {
  let texte = fragment;
  let precedent;
  do {
    precedent = texte;
    texte = texte.replace(/<[^<>]*>/g, '');
  } while (texte !== precedent);
  if (texte.includes('<') || texte.includes('>')) throw new Error('FRAGMENT_NON_TEXTUEL');
  const inconnue = texte.replace(/&(?:amp|nbsp|lt|gt|quot|#39);/g, '').match(/&[a-zA-Z#0-9]+;/);
  if (inconnue) throw new Error(`ENTITE_INCONNUE: ${inconnue[0]}`);
  for (const [entite, caractere] of ENTITES) texte = texte.split(entite).join(caractere);
  if (texte.includes('<') || texte.includes('>')) throw new Error('FRAGMENT_NON_TEXTUEL');
  return texte.replace(/\s+/g, ' ').trim();
}

/** Le titre du document, tel qu'il est lu par l'humain. */
export function titreDuDocument(source) {
  const trouve = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(source);
  if (!trouve) throw new Error('TITRE_DU_DOCUMENT_INTROUVABLE');
  return texteDuFragment(trouve[1]);
}

/**
 * Les questions que posent les parents, telles que le document les expose en
 * « details / summary ». Elles sont visibles sur la page : c'est la condition
 * que Google pose à une FAQ déclarée, et la seule honnête.
 */
export function questionsDesParents(source) {
  const bloc = /<section[^>]*id="parents"[^>]*>([\s\S]*?)<\/section>/.exec(source);
  if (!bloc) throw new Error('QUESTIONS_DES_PARENTS_INTROUVABLES');
  const paires = [...bloc[1].matchAll(/<details[^>]*>([\s\S]*?)<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (paires.length === 0) throw new Error('QUESTIONS_DES_PARENTS_INTROUVABLES');
  return paires.map(([, , question, reponse]) => ({
    question: texteDuFragment(question),
    reponse: texteDuFragment(reponse),
  }));
}

/**
 * Le JSON-LD de la page. Tout vient du document : le titre, les questions,
 * la description. Aucune date n'est déclarée — une date de mise à jour qui
 * n'est pas écrite dans le document serait une date inventée.
 */
export function donneesStructurees(source, page) {
  const url = `${SITE}${page.chemin}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: titreDuDocument(source),
        description: description(source, page.sujet),
        inLanguage: 'fr',
        mainEntityOfPage: url,
        isPartOf: { '@id': `${SITE}/#site` },
        publisher: { '@id': `${SITE}/#organisation` },
        about: [page.sujet, 'Baccalauréat français', 'Candidat individuel', 'Inscription Cyclades'],
        audience: { '@type': 'EducationalAudience', educationalRole: 'student' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#questions`,
        mainEntity: questionsDesParents(source).map(({ question, reponse }) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: reponse },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#fil`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'Inscription au bac 2027', item: `${SITE}/inscription-bac-2027` },
          { '@type': 'ListItem', position: 3, name: page.sujet, item: url },
        ],
      },
    ],
  };
}

/** Le chevron est échappé : une réponse ne peut pas refermer la balise script. */
function scriptJsonLd(donnees) {
  return `<script type="application/ld+json">${JSON.stringify(donnees).replace(/</g, '\\u003c')}</script>`;
}

/** Description dérivée du document, jamais saisie à la main : aucune date inventée. */
export function description(source, sujet) {
  const table = new Map(reperes(source));
  const cloture = table.get('Clôture');
  if (!cloture) throw new Error('DATE_DE_CLOTURE_INTROUVABLE');
  return `${sujet} 2027 en candidat individuel depuis la Tunisie : la campagne Cyclades close le `
    + `${cloture}, écran par écran — pièces à fournir, choix d’épreuves, pièges à éviter.`;
}

const LOGO = (classe) => `<a class="ident ${classe}" href="${SITE}/" aria-label="Nexus Réussite — accueil">
  <img class="clair" src="/inscription-bac-2027/nexus-logo-horizontal.svg" alt="Nexus Réussite" width="385" height="142" decoding="async">
  <img class="sombre" src="/inscription-bac-2027/nexus-logo-horizontal-blanc.svg" alt="Nexus Réussite" width="385" height="142" decoding="async">
</a>`;

/** Socle que la plateforme de rédaction fournissait, reproduit à l'identique, plus le logo. */
const SOCLE = `<style>
/* Socle de la plateforme de rédaction, reproduit : le document a été écrit
   contre lui. La racine porte les encoches ; le bandeau collant s'y appuie. */
/* Selecteur html, et non la pseudo-classe racine : le premier bloc de la
   racine doit rester celui des jetons de couleur, que l'outillage d'audit
   extrait par position dans le document. */
html{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;font-size:14px}
img{max-width:100%}
/* Le script de la page pilote la visibilite par la propriete hidden. */
[hidden]{display:none!important}
</style>`;

const STYLES_LOGO = `<style>
/* Logo de la charte, absent du document d'origine. Les deux versions sont
   servies et commutées par thème : le lettrage bleu est illisible sur le
   fond sombre, et le pied de page est toujours navy. */
.ident{display:block;width:240px;max-width:62%;margin:0 0 20px}
.ident img{display:block;width:100%;height:auto}
.ident .sombre{display:none}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .ident .clair{display:none}
  :root:not([data-theme="light"]) .ident .sombre{display:block}}
:root[data-theme="dark"] .ident .clair{display:none}
:root[data-theme="dark"] .ident .sombre{display:block}
.ident.pied{margin:30px 0 0}
.ident.pied .clair{display:none}
.ident.pied .sombre{display:block}
</style>`;

function construire(page) {
  const source = readFileSync(path.join(SOURCE, `${page.slug}.html`), 'utf8');
  const { tete, corps } = decouper(source);

  const teteNettoyee = tete
    .replace(/^<meta name="claude:viewport-fit-sides"[^>]*>\n?/m, '')
    .replace(/^<title>.*<\/title>\n?/m, '');
  if (teteNettoyee.includes('claude:viewport-fit-sides')) throw new Error('META_PLATEFORME_RESIDUELLE');

  let corpsOrne = corps.replace(
    /(<p class="marque">)/,
    `${LOGO('')}\n    $1`,
  );
  if (corpsOrne === corps) throw new Error('POINT_D_INSERTION_EN_TETE_INTROUVABLE');
  const pied = corpsOrne.lastIndexOf('  </div>\n</footer>');
  if (pied === -1) throw new Error('POINT_D_INSERTION_EN_PIED_INTROUVABLE');
  corpsOrne = corpsOrne.slice(0, pied) + `  ${LOGO('pied')}\n` + corpsOrne.slice(pied);

  const desc = description(source, page.sujet);
  const url = `${SITE}${page.chemin}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${page.titre}</title>
<meta name="description" content="${desc}">
<link rel="canonical" href="${url}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Nexus Réussite">
<meta property="og:locale" content="fr_FR">
<meta property="og:title" content="${page.titre}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/inscription-bac-2027/og-inscription-2027.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/inscription-bac-2027/favicon-32.png" sizes="32x32">
<link rel="apple-touch-icon" href="/inscription-bac-2027/apple-touch-icon-180.png">
${scriptJsonLd(donneesStructurees(source, page))}
${SOCLE}
${teteNettoyee}
${STYLES_LOGO}
</head>
<body>
${corpsOrne.replace(/^\n+/, '')}
</body>
</html>
`;
}

/**
 * Manifeste lu par le plan du site et par les tests. Tout y vient du document
 * audité : ni la date de clôture ni la description ne sont saisies ailleurs.
 */
export function manifeste() {
  return PAGES.map((page) => {
    const source = readFileSync(path.join(SOURCE, `${page.slug}.html`), 'utf8');
    return {
      slug: page.slug,
      chemin: page.chemin,
      titre: page.titre,
      description: description(source, page.sujet),
      cloture: cloture(source),
      cyclades: lienCyclades(source),
      institut_francais: lienInstitutFrancais(source),
      questions: questionsDesParents(source),
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(CIBLE, { recursive: true });
  for (const page of PAGES) {
    const html = construire(page);
    writeFileSync(path.join(CIBLE, `${page.slug}.html`), html);
    console.log(`  ${page.slug}.html  ${html.length} octets`);
  }
  const fichier = path.join(RACINE, 'content/inscription-2027/pages.generated.json');
  writeFileSync(fichier, `${JSON.stringify(manifeste(), null, 2)}\n`);
  console.log(`  pages.generated.json  ${manifeste().length} pages`);
}

export { construire };
