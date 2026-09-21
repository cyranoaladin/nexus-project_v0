/**
 * Content for the DEMO_FIXTURE subject and its companion synthetic answer
 * (mission §4/§9) — entirely invented, generic, self-referential where
 * possible (its own items describe the demonstration itself), never
 * derived from any real bank content, never resembling calibrated exam
 * material. Used by scripts/core-v2/seed-diagnostic-catalog-demo.ts (the
 * subject) and by C2's own extraction fixtures (the companion answer).
 */
export const DEMO_INSTRUMENT_TITLE = 'Diagnostic — démonstration technique';
export const DEMO_INSTRUMENT_DURATION_MINUTES = 10;

export const DEMO_SUBJECT_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>
  body { font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #111; margin: 32px; }
  .banner { background: #fde68a; border: 2px solid #b45309; color: #78350f; font-weight: bold;
            text-align: center; padding: 10px; margin-bottom: 20px; text-transform: uppercase; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  .meta { color: #444; font-size: 12px; margin-bottom: 16px; }
  .instructions { margin-bottom: 20px; }
  .item { border: 1px solid #ccc; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px; }
  .item h2 { font-size: 14px; margin: 0 0 6px 0; }
  .item .kind { color: #555; font-style: italic; font-size: 12px; }
  .choices { margin: 6px 0 0 0; padding-left: 18px; }
  .zone { border: 1px dashed #999; border-radius: 4px; min-height: 40px; margin-top: 6px; padding: 6px; color: #888; }
  .deposit { margin-top: 20px; font-size: 12px; color: #333; }
</style>
</head>
<body>
  <div class="banner">Démonstration technique — non utilisable pour une décision pédagogique</div>
  <h1>${DEMO_INSTRUMENT_TITLE}</h1>
  <p class="meta">Durée indicative : ${DEMO_INSTRUMENT_DURATION_MINUTES} minutes (fixture — non calibrée). Support : démonstration technique uniquement.</p>
  <p class="instructions">
    Ce document sert uniquement à valider le fonctionnement technique de l'attribution, de la consultation
    et du dépôt d'un diagnostic. Il ne constitue en aucun cas un diagnostic pédagogique réel et ne doit
    jamais fonder une décision concernant un candidat réel.
  </p>

  <div class="item">
    <h2>Item 1 <span class="kind">(question fermée)</span></h2>
    <p>Parmi les propositions suivantes, laquelle correspond à la capitale de la France&nbsp;?</p>
    <ol class="choices" type="A">
      <li>Lyon</li>
      <li>Marseille</li>
      <li>Paris</li>
      <li>Nice</li>
    </ol>
  </div>

  <div class="item">
    <h2>Item 2 <span class="kind">(réponse courte)</span></h2>
    <p>En une phrase&nbsp;: pourquoi ce document est-il une démonstration technique et non un diagnostic réel&nbsp;?</p>
    <div class="zone">Zone de réponse (une phrase)</div>
  </div>

  <div class="item">
    <h2>Item 3 <span class="kind">(courte production rédigée, 3 à 5 lignes)</span></h2>
    <p>Décrivez, en trois à cinq lignes, les étapes que vous venez de suivre pour accéder à ce document.</p>
    <div class="zone">Zone de réponse (3 à 5 lignes)</div>
  </div>

  <p class="deposit">
    Dépôt de votre réponse&nbsp;: rédigez vos réponses aux trois items dans un document PDF (15&nbsp;Mo
    maximum) puis déposez-le via le bouton « Déposer » de la page « Diagnostics libres ».
  </p>
</body>
</html>`;

/** A plausible, complete synthetic answer to the three items above — for C1's own deposit rehearsal and for C2's extraction fixtures. */
export const DEMO_ANSWER_HTML = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<style>body { font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #111; margin: 32px; }
h1 { font-size: 16px; } .item { margin-bottom: 14px; } .kind { color: #555; font-style: italic; font-size: 12px; }</style>
</head>
<body>
  <h1>Réponses — démonstration technique</h1>
  <div class="item"><span class="kind">Item 1 :</span> C) Paris</div>
  <div class="item"><span class="kind">Item 2 :</span> Ce document sert uniquement à vérifier que l'attribution, la consultation et le dépôt fonctionnent techniquement, pas à évaluer un candidat réel.</div>
  <div class="item"><span class="kind">Item 3 :</span> Je me suis connecté avec mon compte candidat, j'ai ouvert la rubrique « Diagnostics libres », j'ai consulté le sujet attribué, puis j'ai déposé ce document de réponse via le formulaire prévu.</div>
</body>
</html>`;
