#!/usr/bin/env node
'use strict';
/**
 * Build script — génère nexus_assistante_devis_v2.html
 * Lit offres-nexus.json (source unique), patche le HTML source, écrit les sorties.
 * Usage : node scripts/build-assistant-devis.js
 */
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT     = path.resolve(__dirname, '..');
const JSON_SRC = path.join(ROOT, 'data/offres-nexus.json');
// Source canonique : version Documents (822 lignes bien formées)
const HTML_SRC = '/home/alaeddine/Documents/Nexus/Business_Model_Nexus/nexus_assistante_devis_v2.html';
const OUT_PROJECT = path.join(ROOT, 'src/static-pages/nexus_assistante_devis_v2.html');
const OUT_DOCS    = HTML_SRC; // on réécrit aussi la source
const OUT_V1      = '/home/alaeddine/Documents/Nexus/Business_Model_Nexus/nexus_assistante_devis.html';

// ── 1. Load JSON ─────────────────────────────────────────────────────────────
const offersData = JSON.parse(fs.readFileSync(JSON_SRC, 'utf8'));
const checksum   = crypto.createHash('sha256').update(JSON.stringify(offersData)).digest('hex').slice(0,16);
const JSON_EMBED = `<script type="application/json" id="nexus-offers-json" data-checksum="${checksum}">
${JSON.stringify(offersData, null, 2)}
</script>`;

// ── 2. META (pédagogie — aucun montant) ──────────────────────────────────────
// Injecté inline dans le <script> de la page
const META_JS = `const META={
terminaleSpecialiteSimple:{cat:"Scolarisé · Terminale",vol:"60 h · 2 h/sem · groupe 5 max",h:60,desc:"Une spécialité ciblée pour sécuriser l'année.",inc:["Une spécialité au choix","Groupe de 5 maximum","Entraînement régulier + bilans"],ech:[{l:"10 mensualités sept.→juin",m:true,n:10}]},
duoTerminaleNexus:{cat:"Scolarisé · Terminale",vol:"175 h · 2 spécialités · groupe 5 max",h:175,desc:"Deux spécialités, stages vacances, Grand Oral, plateforme.",inc:["Deux spécialités (coef 16+16)","Stages Toussaint/hiver/printemps inclus","Bacs blancs corrigés","Préparation Grand Oral (coef 10)","Plateforme + compte parent"],ech:[{l:"Réservation"},{l:"1er versement — sept."},{l:"2e versement — déc."},{l:"Solde fidélité — mars"}]},
excellenceTerminale:{cat:"Scolarisé · Terminale",vol:"246 h · 2 spés + Maths expertes · groupe 5 max",h:246,desc:"Deux spécialités + Maths expertes pour dossiers sélectifs (CPGE, médecine, écoles).",inc:["Deux spécialités + Maths expertes","Stages + bacs blancs","Grand Oral scientifique","Préparation Parcoursup","6 h d'urgence en ligne incluses"],ech:[{l:"Réservation"},{l:"1er versement — sept."},{l:"2e versement — déc."},{l:"Solde fidélité — mars"}]},
terminaleLibreOnline:{cat:"Candidat libre · Terminale",vol:"Année · 2 lives/mois · en ligne",h:24,desc:"Préparation 100 % en ligne, plateforme + lives bimensuels.",inc:["Plateforme complète","2 lives/mois + corrections","Cadrage de la carte d'examen","Suivi de progression"],ech:[{l:"Réservation"},{l:"Mensualités × 8",m:true,n:8}]},
terminaleLibreMixte:{cat:"Candidat libre · Terminale",vol:"Année · présentiel + plateforme · groupe 5 max",h:120,desc:"Parcours candidat libre complet : 2 spés, Grand Oral, tronc commun en ponctuel, accompagnement administratif.",inc:["Toutes les épreuves terminales + ponctuelles","Carte d'examen personnalisée + Cyclades/IFT","Groupe de 5 maximum","Bacs blancs en conditions réelles","Plateforme + compte parent + bulletins"],ech:[{l:"Réservation"},{l:"1er versement"},{l:"2e versement"},{l:"Solde fidélité"}]},
terminaleLibrePremium:{cat:"Candidat libre · Terminale",vol:"Année · suivi renforcé · groupe 5 max",h:150,desc:"Le parcours candidat libre le plus encadré : coaching individuel et suivi renforcé.",inc:["Tout le parcours Mixte","Coaching individuel","Points parents mensuels","Oraux renforcés (français, Grand Oral)","Pont Parcoursup inclus"],ech:[{l:"Réservation"},{l:"1er versement"},{l:"2e versement"},{l:"Solde"}]},
premiereEafFrancais:{cat:"Scolarisé · Première",vol:"2 h/sem · groupe 5 max",h:60,desc:"Épreuve anticipée de français : écrit (coef 5) + oral (coef 5).",inc:["Méthode écrit + oral","Étude des textes au programme","Oraux blancs","Plateforme incluse"],ech:[{l:"Réservation"},{l:"versement"},{l:"versement"},{l:"solde"}]},
premiereMathsAnticipees:{cat:"Scolarisé · Première",vol:"2 h/sem · groupe 5 max",h:60,desc:"Nouvelle épreuve anticipée de maths (EAM, session 2027) : automatismes + exercices.",inc:["Automatismes et QCM","Exercices types EAM","Sujets blancs","Plateforme incluse"],ech:[{l:"Réservation"},{l:"versement"},{l:"versement"},{l:"solde"}]},
premiereDoubleSecurite:{cat:"Scolarisé · Première",vol:"4 h/sem · groupe 5 max",h:120,desc:"EAF + EAM : les deux épreuves anticipées de Première sécurisées ensemble.",inc:["EAF (écrit+oral) et EAM couverts","Oraux et sujets blancs","Plateforme + bilans parents","Continuité vers la Terminale"],ech:[{l:"Réservation"},{l:"versement"},{l:"versement"},{l:"solde"}]},
premiereSciences:{cat:"Scolarisé · Première",vol:"4 h/sem · groupe 5 max",h:120,desc:"Deux spécialités scientifiques consolidées dès la Première, avec EAM approfondie.",inc:["Deux spécialités scientifiques","Préparation EAM approfondie","Bilans parents","Plateforme incluse"],ech:[{l:"10 mensualités",m:true,n:10}]},
premiereLibreEssentiel:{cat:"Candidat libre · Première",vol:"Année en ligne · groupe 5 max",h:40,desc:"Socle candidat libre : cadrer EAF, EAM et le tronc commun en autonomie encadrée.",inc:["EAF + EAM cadrés","Carte d'examen et calendrier","Plateforme + sujets types","Points d'étape"],ech:[{l:"Réservation"},{l:"Mensualités × 4",m:true,n:4}]},
premiereLibreAccompagnee:{cat:"Candidat libre · Première",vol:"Année · présentiel + plateforme · groupe 5 max",h:80,desc:"Préparation accompagnée des anticipées et du tronc commun en ponctuel.",inc:["EAF, EAM et ponctuelles préparés","Accompagnement administratif (Cyclades/IFT)","Oraux et sujets blancs","Plateforme incluse"],ech:[{l:"Réservation"},{l:"Mensualités × 8",m:true,n:8}]},
premiereLibreIntensif:{cat:"Candidat libre · Première",vol:"Stage 20-30 h · groupe 5 max",h:25,desc:"Format intensif pour élève arrivant tard ou devant rattraper.",inc:["Stage intensif + plateforme","Cadrage de la carte d'examen","Sujets types"],ech:[{l:"Réservation"},{l:"solde"}]},
plateformeAutonomie:{cat:"Plateforme en ligne",vol:"Année · ressources",h:0,desc:"Ressources et parcours pour travailler seul.",inc:["Cours, exercices, sujets","Accès permanent","Suivi non individualisé"],ech:[{l:"Annuel"}]},
plateformeSuivi:{cat:"Plateforme en ligne",vol:"Année · suivi régulier",h:12,desc:"Plateforme + compte parent + bilans + 1 live/mois.",inc:["Plateforme complète","Compte parent + bilans","1 live collectif/mois"],ech:[{l:"Réservation"},{l:"versement"},{l:"solde"}]},
plateformeAccompagnee:{cat:"Plateforme en ligne",vol:"Année · live hebdo (effectif à valider direction)",h:36,desc:"Cadre Nexus à distance : séances hebdomadaires en groupe.",inc:["Plateforme + lives hebdomadaires","Référent dédié","Bilans parents"],ech:[{l:"Réservation"},{l:"versement"},{l:"solde"}]},
secondeMathsMethode:{cat:"Seconde",vol:"2 h/sem · groupe 5 max",h:60,desc:"Maths, méthode et préparation du choix des spécialités.",inc:["Maths + méthode","Organisation et régularité","Orientation spécialités"],ech:[{l:"10 mensualités",m:true,n:10}]},
secondeSciences:{cat:"Seconde",vol:"4 h/sem · groupe 5 max",h:120,desc:"Maths + Physique-Chimie et orientation vers les spécialités.",inc:["Maths + Physique-Chimie","Méthode","Orientation spécialités"],ech:[{l:"10 mensualités",m:true,n:10}]},
secondeCoachingOrientation:{cat:"Seconde",vol:"3 rendez-vous",h:6,desc:"Choix des spécialités, méthode et bilan d'orientation.",inc:["3 rendez-vous dans l'année","Choix des spécialités","Bilan d'orientation"],ech:[{l:"Cycle"}]},
brevetMaths:{cat:"Troisième",vol:"2 h/sem · groupe 5 max",h:60,desc:"Préparation DNB sur une matière clé.",inc:["Maths ou Français","Sujets types DNB","Méthode"],ech:[{l:"10 mensualités",m:true,n:10}]},
brevetComplet:{cat:"Troisième",vol:"4 h/sem · groupe 5 max",h:120,desc:"Maths + Français + méthode, brevet blanc (DNB : 60 % épreuves finales).",inc:["Maths + Français","Brevets blancs corrigés","Méthode + oral / langue (candidat libre)","Préparation de la Seconde"],ech:[{l:"10 mensualités",m:true,n:10}]},
stagePrerentreeMathsTerminale:{cat:"Stage prérentrée",vol:"Août · avant la rentrée · groupe 5 max",h:20,desc:"Remise à niveau et premiers chapitres. 600 TND si inscription annuelle confirmée.",inc:["Objectif clair avant septembre","Groupe réduit (5 max)","Déductible si parcours annuel confirmé"],ech:[{l:"Stage"}]},
stagePrerentreeTerminale:{cat:"Stage prérentrée",vol:"Août · avant la rentrée",h:20,desc:"Prérentrée Terminale (tarif variable selon formule).",inc:["Remise à niveau","Groupe réduit (5 max)"],ech:[{l:"Stage"}]},
stagePrerentreePremiere:{cat:"Stage prérentrée",vol:"Août · avant la rentrée",h:15,desc:"Prérentrée Première — Français ou Maths.",inc:["Remise à niveau","Groupe réduit (5 max)"],ech:[{l:"Stage"}]},
stagePrerentreeSeconde:{cat:"Stage prérentrée",vol:"Août · avant la rentrée",h:15,desc:"Prérentrée Seconde — Maths & méthode.",inc:["Remise à niveau","Groupe réduit (5 max)"],ech:[{l:"Stage"}]},
stagePrerentreeTroisieme:{cat:"Stage prérentrée",vol:"Août · avant la rentrée",h:12,desc:"Prérentrée Troisième — Prépa Brevet.",inc:["Remise à niveau","Groupe réduit (5 max)"],ech:[{l:"Stage"}]},
stagePrerentreeCandidatsLibres:{cat:"Stage candidat libre",vol:"Bilan + remise à niveau",h:20,desc:"Bilan d'entrée + remise à niveau candidats libres.",inc:["Bilan de positionnement","Remise à niveau ciblée","Carte d'examen préliminaire"],ech:[{l:"Stage"}]},
stageBrevet:{cat:"Stage",vol:"Stage brevet",h:15,desc:"Préparation intensive du Brevet.",inc:["Maths + Français","Sujets blancs","Méthode"],ech:[{l:"Stage"}]},
vacancesUneMatiere:{cat:"Stage vacances",vol:"10-12 h · groupe 5 max",h:11,desc:"Renfort ciblé sur une matière pendant les vacances.",inc:["Une matière","Groupe réduit (5 max)","Sujets types"],ech:[{l:"Stage"}]},
vacancesDuoMatieres:{cat:"Stage vacances",vol:"18-20 h · groupe 5 max",h:19,desc:"Deux matières pendant les vacances.",inc:["Deux matières","Groupe réduit (5 max)","Sujets types"],ech:[{l:"Stage"}]},
vacancesGrandOral:{cat:"Stage vacances",vol:"10 h",h:10,desc:"Préparation ciblée du Grand Oral (coef 10).",inc:["Construction des deux questions","Entraînement à l'oral","Gestion du stress"],ech:[{l:"Stage"}]},
vacancesBacBlanc:{cat:"Stage vacances",vol:"1-2 jours · en conditions réelles",h:8,desc:"Bac blanc en conditions d'examen avec correction détaillée.",inc:["Conditions d'examen réelles","Correction annotée","Bilan personnalisé"],ech:[{l:"Session"}]},
vacancesSprintFinal:{cat:"Stage vacances",vol:"20-30 h · groupe 5 max",h:25,desc:"Sprint intensif avant les épreuves.",inc:["Intensif grande surface","Sujets types + méthodes","Groupe réduit (5 max)"],ech:[{l:"Stage"}]},
urgenceMembre:{cat:"Urgence en ligne",vol:"À la séance",h:1,desc:"Aide ponctuelle en ligne avant une évaluation (membre Nexus).",inc:["Sur réservation","Selon disponibilité"],ech:[{l:"Par heure"}]},
urgenceNonMembre:{cat:"Urgence en ligne",vol:"À la séance",h:1,desc:"Aide ponctuelle en ligne (hors abonnement).",inc:["Sur réservation","Tarif non-membre"],ech:[{l:"Par heure"}]},
urgencePack5Membre:{cat:"Urgence en ligne",vol:"5 h",h:5,desc:"Pack 5 h d'urgence membre — économie sur le tarif horaire.",inc:["5 h à planifier dans l'année","Tarif préférentiel membre"],ech:[{l:"Pack"}]},
urgencePack10Membre:{cat:"Urgence en ligne",vol:"10 h",h:10,desc:"Pack 10 h d'urgence membre — meilleure économie.",inc:["10 h à planifier dans l'année","Tarif préférentiel membre"],ech:[{l:"Pack"}]},
pontParcoursup:{cat:"Orientation",vol:"Accompagnement ponctuel",h:8,desc:"Stratégie Parcoursup sans contrôle continu d'établissement (candidats libres).",inc:["Bilan et stratégie de vœux","Aide à la rédaction","Choix des filières"],ech:[{l:"Accompagnement"}]},
celluleCandidatLibre:{cat:"Candidat libre",vol:"Accompagnement administratif",h:6,desc:"Cellule Candidat Libre seule : Cyclades, IFT, pièces, calendrier (sans cours).",inc:["Inscription Cyclades + IFT","Constitution du dossier","Calendrier et convocations"],ech:[{l:"Accompagnement"}]}
};
/* Fusionner prix JSON + méta pédagogique — AUCUN montant en dur dans ce fichier */
const OFFERS_JSON=JSON.parse(document.getElementById('nexus-offers-json').textContent);
const OFFERS={};
Object.entries(OFFERS_JSON).forEach(([k,jd])=>{
  if(k.startsWith('_'))return;
  const m=META[k]||{};
  let ech=[];
  if(jd.echeancier&&jd.echeancier.length&&m.ech&&m.ech.length){
    ech=jd.echeancier.map((a,i)=>({l:(m.ech[i]&&m.ech[i].l)||('Tranche '+(i+1)),a,m:m.ech[i]&&m.ech[i].m,n:m.ech[i]&&m.ech[i].n}));
  }else if(m.ech){ech=m.ech.map(e=>({...e,a:e.a||0}));}
  OFFERS[k]={label:jd.label,cat:m.cat||'',monthly:jd.monthly,annual:jd.annual||0,
    publicAnnual:jd.publicAnnual,approx:jd.approx,monthlyAlt:jd.monthlyAlt,
    range:jd.display||null,vol:m.vol||jd.sub||'',desc:m.desc||'',
    inc:m.inc||[],ech,h:m.h||0};
});
`;

// ── 3. Economics panel HTML (interne, jamais imprimé) ────────────────────────
const ECONOMICS_HTML = `
    <!-- panneau économie interne — noprint -->
    <details class="econ-panel noprint" id="econPanel">
      <summary>📊 Économie du groupe — usage interne (non imprimé)</summary>
      <div class="econ-body">
        <p class="fnote">Coût enseignant = <b>120 TND / h</b> quel que soit l'effectif. Groupe idéal = 5 élèves max.</p>
        <table class="econ-table">
          <thead><tr><th>Effectif</th><th>Coût enseignant / élève / h</th><th>Indicateur</th></tr></thead>
          <tbody>
            <tr><td>5</td><td>24 TND</td><td class="ev-vert">● Viabilité optimale</td></tr>
            <tr><td>4</td><td>30 TND</td><td class="ev-orange">● Acceptable</td></tr>
            <tr><td>3</td><td>40 TND</td><td class="ev-rouge">● Valider direction</td></tr>
            <tr><td>2</td><td>60 TND</td><td class="ev-rouge">● Semi-individuel</td></tr>
            <tr><td>1</td><td>120 TND</td><td class="ev-rouge">● Individuel</td></tr>
          </tbody>
        </table>
        <div style="margin-top:14px;display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
          <div><label class="f" for="econEffectif">Effectif groupe estimé</label>
            <select id="econEffectif" style="width:90px">
              <option value="5" selected>5</option><option value="4">4</option>
              <option value="3">3</option><option value="2">2</option><option value="1">1</option>
            </select></div>
          <div id="econResult" style="font-size:13.5px;padding-bottom:4px"></div>
        </div>
        <p class="fnote" style="margin-top:10px">⚠️ À valider direction : live « Plateforme Accompagnée » en ligne (historiquement 10 élèves — exception à confirmer).</p>
      </div>
    </details>`;

// ── 4. Basket section HTML ───────────────────────────────────────────────────────────────────────────
const BASKET_HTML = `
  <section id="basketWrap" style="display:none;margin-top:18px">
    <div class="card" style="padding:22px">
      <h2 style="margin:0 0 14px">Panier de services</h2>
      <p class="fnote">Offre principale (radio) + compléments cumulables. Total et échéancier consolidés.</p>
      <div id="basketItems"></div>
      <div class="noprint" id="reducPanel" style="margin-top:16px;padding:14px;border:1px solid var(--line);border-radius:10px;background:#fffdf5">
        <h3 style="font-size:12.5px;text-transform:uppercase;letter-spacing:.05em;color:var(--gold-deep);margin:0 0 8px">Réductions &amp; avantages — usage interne</h3>
        <p class="fnote" style="margin-bottom:9px">⚠️ <b>Règle Nexus : non cumulables par défaut</b> — la réduction la plus favorable s\'applique seule. Cocher &laquo; Cumul validé direction &raquo; pour en appliquer plusieurs.</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center">
          <label class="chip"><input type="checkbox" id="reduc-ancien"><span>Ancien élève Nexus</span></label>
          <select id="reduc-ancien-taux" style="width:72px;padding:5px 8px"><option value="5">5 %</option><option value="10" selected>10 %</option><option value="15">15 %</option></select>
          <label class="chip"><input type="checkbox" id="reduc-fratrie"><span>Fratrie inscrite (10 %)</span></label>
          <label class="chip"><input type="checkbox" id="reduc-comptant"><span>Paiement comptant (5 %)</span></label>
        </div>
        <div style="margin-top:9px;padding:9px 12px;border:1px dashed #C9A24D;border-radius:8px;background:rgba(201,162,77,.06)">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13.5px"><input type="checkbox" id="cumul-dir" style="width:17px;height:17px;accent-color:var(--navy)"><b>Cumul validé direction</b> — le devis affichera &laquo; Réduction validée par la direction &raquo;</label>
        </div>
        <div style="margin-top:9px;padding:9px 12px;background:#fff3cd;border-radius:8px;border:1px solid #E3BC51;font-size:13px">
          <b>Prime parrainage :</b> 150 à 300 TND après inscription effective — <em>non déduite du total</em>, affichée en note.
          <div style="margin-top:6px;display:flex;align-items:center;gap:8px">
            <label style="display:flex;align-items:center;gap:6px;font-size:13px"><input type="checkbox" id="reduc-parrainage" style="width:16px;height:16px;accent-color:var(--navy)"> Mentionner le parrainage</label>
            <select id="reduc-parrainage-montant" style="width:100px;padding:5px 8px"><option value="150">150 TND</option><option value="200">200 TND</option><option value="300">300 TND</option></select>
          </div>
        </div>
      </div>
      <div id="basketTotals" style="margin-top:14px;padding:14px;border:2px solid var(--gold);border-radius:10px;background:rgba(201,162,77,.05)"></div>
    </div>
  </section>`;

// ── 5. Additional CSS (economics panel + basket) ─────────────────────────────
const EXTRA_CSS = `
.econ-panel{border:1px solid var(--line);border-radius:10px;background:#fff;margin-bottom:24px}
.econ-panel>summary{cursor:pointer;padding:12px 14px;font-weight:800;color:var(--night);font-size:14px;list-style:none}
.econ-panel>summary::before{content:"▶ ";font-size:11px}
details[open].econ-panel>summary::before{content:"▼ "}
.econ-body{padding:0 14px 14px}
.econ-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:13.5px}
.econ-table th,.econ-table td{border-bottom:1px solid var(--line);padding:7px 9px;text-align:left}
.econ-table th{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--gold-deep)}
.ev-vert{color:var(--green);font-weight:700}.ev-orange{color:#B45309;font-weight:700}.ev-rouge{color:var(--red);font-weight:700}
.basket-item{display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
.basket-item:last-child{border-bottom:none}
.basket-item input[type=radio],.basket-item input[type=checkbox]{width:18px;height:18px;accent-color:var(--navy)}
.basket-label{flex:1;min-width:200px}
.basket-label b{display:block;font-size:14px;color:var(--night)}
.basket-label span{font-size:12.5px;color:var(--muted)}
.basket-price{font-weight:800;color:var(--navy);font-size:14.5px;white-space:nowrap}
.basket-totals-row{display:flex;justify-content:space-between;padding:6px 0;font-size:14px;border-bottom:1px solid var(--line)}
.basket-totals-row.grand{font-weight:800;font-size:16px;color:var(--night);border-bottom:none;margin-top:6px}
.basket-totals-row.reduc{color:var(--red)}
`;

// ── 6. Additional JS functions ───────────────────────────────────────────────
const EXTRA_JS = `
/* ===================== ÉCONOMIE DU GROUPE ===================== */
const COUT_ENSEIGNANT=120;
function econCalc(){
  const key=RECO&&RECO.pri;
  if(!key||!OFFERS[key])return;
  const o=OFFERS[key];
  const eff=parseInt(document.getElementById('econEffectif').value)||5;
  const h=o.h||0;
  const heuresLabel=h?h+' h documentées':'volume indicatif (rythme × 30 sem)';
  const heuresCalc=h||30*2;
  const coutTotal=COUT_ENSEIGNANT*heuresCalc;
  const revenue=annual(o)*eff;
  const marge=revenue-coutTotal;
  const pct=revenue>0?Math.round(marge/revenue*100):0;
  const indic=eff>=5?'<span class="ev-vert">● Viable</span>':eff===4?'<span class="ev-orange">● Acceptable</span>':'<span class="ev-rouge">● Valider direction</span>';
  document.getElementById('econResult').innerHTML=
    '<b>Offre : '+o.label+'</b><br>'+
    'Heures : '+heuresLabel+' · Coût enseignant : <b>'+fmt(coutTotal)+' TND</b><br>'+
    'Revenu groupe ('+eff+' élèves) : <b>'+fmt(revenue)+' TND</b> · '+
    'Marge brute : <b>'+fmt(marge)+' TND</b> ('+pct+'%) '+indic;
}
document.addEventListener('change',e=>{if(e.target.id==='econEffectif')econCalc();});

/* ===================== PANIER ===================== */
const BASKET_MAIN_KEYS=['terminaleSpecialiteSimple','duoTerminaleNexus','excellenceTerminale','terminaleLibreOnline','terminaleLibreMixte','terminaleLibrePremium','premiereEafFrancais','premiereMathsAnticipees','premiereDoubleSecurite','premiereSciences','premiereLibreEssentiel','premiereLibreAccompagnee','premiereLibreIntensif','secondeMathsMethode','secondeSciences','brevetMaths','brevetComplet'];
const BASKET_COMP_KEYS=['plateformeAutonomie','plateformeSuivi','plateformeAccompagnee','vacancesUneMatiere','vacancesDuoMatieres','vacancesGrandOral','vacancesBacBlanc','vacancesSprintFinal','stagePrerentreeMathsTerminale','urgenceMembre','urgencePack5Membre','urgencePack10Membre','pontParcoursup','celluleCandidatLibre'];

function priceNum(o){return o.annual||(o.monthly?o.monthly*10:0);}
function annualOf(key){return priceNum(OFFERS[key]||{});}

function renderBasket(){
  const p=CUR||readProfile();
  const libre=p.status!=='scolarise';
  // filter main keys by level
  const levelMap={troisieme:['brevetMaths','brevetComplet'],seconde:['secondeMathsMethode','secondeSciences','secondeCoachingOrientation'],premiere:libre?['premiereLibreEssentiel','premiereLibreAccompagnee','premiereLibreIntensif']:['premiereEafFrancais','premiereMathsAnticipees','premiereDoubleSecurite','premiereSciences'],terminale:libre?['terminaleLibreOnline','terminaleLibreMixte','terminaleLibrePremium']:['terminaleSpecialiteSimple','duoTerminaleNexus','excellenceTerminale']};
  const mainKeys=levelMap[p.level]||[];
  const defaultMain=RECO?RECO.pri:mainKeys[0];

  const wrapB=document.getElementById('basketItems');
  let html='<h3 style="font-size:14px;margin:0 0 8px;color:var(--gold-deep);text-transform:uppercase;letter-spacing:.05em">Offre principale</h3>';
  mainKeys.forEach(k=>{
    if(!OFFERS[k])return;
    const o=OFFERS[k];
    const price=o.range||((o.monthly?(o.approx?'≈ ':'')+fmt(o.monthly)+' TND/mois':fmt(annual(o))+' TND/an'));
    html+='<div class="basket-item"><input type="radio" name="bMain" value="'+k+'"'+(k===defaultMain?' checked':'')+' id="bm_'+k+'"><label for="bm_'+k+'" class="basket-label"><b>'+o.label+'</b><span>'+o.cat+' · '+o.vol+'</span></label><span class="basket-price">'+price+'</span></div>';
  });
  html+='<h3 style="font-size:14px;margin:14px 0 8px;color:var(--gold-deep);text-transform:uppercase;letter-spacing:.05em">Compléments cumulables</h3>';
  BASKET_COMP_KEYS.forEach(k=>{
    if(!OFFERS[k])return;
    const o=OFFERS[k];
    const price=o.range||(fmt(annual(o))+' TND');
    const chk=RECO&&RECO.comp&&RECO.comp.includes(k)?' checked':'';
    html+='<div class="basket-item"><input type="checkbox" name="bComp" value="'+k+'"'+chk+' id="bc_'+k+'"><label for="bc_'+k+'" class="basket-label"><b>'+o.label+'</b><span>'+o.cat+' · '+o.vol+'</span></label><span class="basket-price">'+price+'</span></div>';
  });
  wrapB.innerHTML=html;
  document.querySelectorAll('input[name=bMain],input[name=bComp]').forEach(el=>el.addEventListener('change',calcBasket));
  calcBasket();
}

function calcBasket(){
  const mainEl=document.querySelector('input[name=bMain]:checked');
  if(!mainEl)return;
  const mainKey=mainEl.value;
  const compKeys=[...document.querySelectorAll('input[name=bComp]:checked')].map(x=>x.value);
  const mainPrice=annualOf(mainKey);
  let compTotal=compKeys.reduce((s,k)=>s+annualOf(k),0);
  // Réductions — NON CUMULABLES par défaut (règle commerciale Nexus)
  const redAncien=document.getElementById('reduc-ancien')?.checked||false;
  const tauxAncien=parseInt(document.getElementById('reduc-ancien-taux')?.value||'10')||10;
  const redFratrie=document.getElementById('reduc-fratrie')?.checked||false;
  const redComptant=document.getElementById('reduc-comptant')?.checked||false;
  const cumulDir=document.getElementById('cumul-dir')?.checked||false;
  const redParrainage=document.getElementById('reduc-parrainage')?.checked||false;
  const montantParrainage=parseInt(document.getElementById('reduc-parrainage-montant')?.value||'150')||150;
  let reducPct=0,reducLabel='';
  if(redAncien&&tauxAncien>reducPct){reducPct=tauxAncien;reducLabel='Ancien élève Nexus ('+tauxAncien+'%)'}
  if(redFratrie&&10>reducPct){reducPct=10;reducLabel='Fratrie inscrite (10%)'}
  if(redComptant&&5>reducPct&&!redAncien&&!redFratrie){reducPct=5;reducLabel='Paiement comptant (5%)'}
  let reduc=Math.round(mainPrice*reducPct/100);
  if(cumulDir){
    let cumul=0;
    if(redAncien)cumul+=Math.round(mainPrice*tauxAncien/100);
    else if(redFratrie)cumul+=Math.round(mainPrice*0.10);
    if(redComptant)cumul+=Math.round(mainPrice*0.05);
    reduc=cumul;
    reducLabel=(reducLabel?reducLabel+(redComptant&&(redAncien||redFratrie)?' + Comptant (5%)':''):'')||'Réductions cumulées';
  }
  reduc=Math.min(reduc,mainPrice);
  const total=Math.max(0,mainPrice+compTotal-reduc);
  const mainO=OFFERS[mainKey]||{};
  const pub=mainO.publicAnnual;
  let html='';
  html+='<div class="basket-totals-row"><span>Offre principale — '+mainO.label+'</span><span>'+fmt(mainPrice)+' TND</span></div>';
  if(compTotal>0)html+='<div class="basket-totals-row"><span>Compléments ('+compKeys.length+')</span><span>'+fmt(compTotal)+' TND</span></div>';
  if(reduc>0)html+='<div class="basket-totals-row reduc"><span>Réduction — '+reducLabel+'</span><span>− '+fmt(reduc)+' TND</span></div>';
  if(cumulDir&&reduc>0)html+='<div style="margin:4px 0 8px;padding:7px 10px;border-radius:7px;background:#FFF3CD;border:1px solid #E3BC51;font-size:12.5px;color:#3a2c00">⚠️ <b>Réduction cumulée — À valider par la direction avant remise du devis.</b></div>';
  if(pub)html+='<div class="basket-totals-row" style="color:var(--muted);font-size:12.5px"><span>Valeur tarif public (anti-désistement)</span><span>'+fmt(pub+compTotal)+' TND</span></div>';
  html+='<div class="basket-totals-row grand"><span>TOTAL ANNUEL</span><span>'+fmt(total)+' TND</span></div>';
  if(redParrainage)html+='<div style="margin-top:8px;padding:7px 10px;border-radius:7px;background:#fff3cd;border:1px solid #E3BC51;font-size:12.5px">🤝 <b>Prime parrainage :</b> '+fmt(montantParrainage)+' TND après inscription effective — non déduite du total.</div>';
  const echMain=buildEchancier(mainKey,mainPrice-reduc);
  const hasRealEch=echMain.length&&echMain.some(e=>e.a>0);
  const isReconstructed=!(OFFERS_JSON[mainKey]&&OFFERS_JSON[mainKey].echeancier&&OFFERS_JSON[mainKey].echeancier.length);
  if(hasRealEch){
    html+='<div style="margin-top:12px"><b style="font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Échéancier indicatif</b>';
    if(isReconstructed)html+='<span style="font-size:11.5px;color:#B45309"> — indicatif, à valider direction</span>';
    html+='<table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:13px">';
    echMain.filter(e=>e.a>0).forEach(e=>{html+='<tr><td style="padding:5px 8px;border-bottom:1px solid var(--line)">'+e.l+'</td><td style="padding:5px 8px;border-bottom:1px solid var(--line);text-align:right;font-weight:700">'+fmt(e.a)+' TND</td></tr>';});
    html+='<tr><td style="padding:7px 8px;font-weight:800">Total</td><td style="padding:7px 8px;font-weight:800;text-align:right">'+fmt(echMain.filter(e=>e.a>0).reduce((s,e)=>s+e.a,0))+' TND</td></tr></table></div>';
  }else if(mainO.monthly){
    html+='<div style="margin-top:12px;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:13.5px">💳 <b>Mensualisation :</b> '+fmt(mainO.monthly)+' TND × 10 = '+fmt(mainO.monthly*10)+' TND — <span style="color:#B45309">indicatif, à valider direction</span></div>';
  }else if(mainO.range){
    html+='<div style="margin-top:12px;padding:10px;border:1px solid var(--line);border-radius:8px;font-size:13.5px">💳 <b>Tarif :</b> '+mainO.range+' — à préciser avec la direction</div>';
  }
  document.getElementById('basketTotals').innerHTML=html;
  document.getElementById('reducPanel').querySelectorAll('input,select').forEach(el=>el.addEventListener('change',calcBasket));
  document.getElementById('basketWrap').style.display='block';
}

function buildEchancier(key,totalAdjusted){
  const o=OFFERS[key];if(!o||!o.ech||!o.ech.length)return[];
  const orig=annual(o)||0;const ratio=orig>0?totalAdjusted/orig:1;
  return o.ech.map(e=>{
    const base=e.m?e.a*(e.n||10):e.a;
    return{l:e.l,a:Math.round(base*ratio)};
  });
}

/* ===================== RÉSUMÉ INTERNE ===================== */
function buildInternalResume(){
  if(!CUR||!RECO)return'G\\u00E9n\\u00E9rer une recommandation d\\u2019abord.';
  const p=CUR,r=RECO;
  const ST={scolarise:'scolarisé',libre:'candidat libre',double:'double cursus'};
  const NV={troisieme:'Troisième',seconde:'Seconde',premiere:'Première',terminale:'Terminale'};
  const pri=OFFERS[r.pri]||{},alt=OFFERS[r.alt]||{};
  const mainEl=document.querySelector('input[name=bMain]:checked');
  const mainKey=mainEl?mainEl.value:r.pri;
  const compKeys=[...document.querySelectorAll('input[name=bComp]:checked')].map(x=>x.value);
  let txt='=== RÉSUMÉ INTERNE NEXUS ===\\n';
  txt+='Élève : '+p.eleve+' | Parent : '+p.parent+'\\n';
  txt+='Niveau : '+NV[p.level]+' | Statut : '+ST[p.status]+(p.school?' | Étab : '+p.school:'')+'\\n';
  txt+='Objectif : '+p.objective+' | Mode : '+p.mode+' | Budget : '+p.budget+'\\n';
  if(p.spes&&p.spes.length)txt+='Spécialités : '+p.spes.join(', ')+'\\n';
  if(p.status!=='scolarise'&&p.modalite)txt+='Modalité A/B : '+p.modalite+'\\n';
  txt+='---\\n';
  txt+='Recommandée : '+pri.label+' ('+fmt(annual(pri))+' TND)\\n';
  txt+='Alternative : '+alt.label+' ('+fmt(annual(alt))+' TND)\\n';
  txt+='Sélectionné panier : '+((OFFERS[mainKey]&&OFFERS[mainKey].label)||mainKey)+'\\n';
  if(compKeys.length)txt+='Compléments : '+compKeys.map(k=>OFFERS[k]&&OFFERS[k].label||k).join(', ')+'\\n';
  if(RECO.alerts&&RECO.alerts.length)txt+='Alertes : '+RECO.alerts.join(' | ')+'\\n';
  txt+='\\nNotes entretien : '+p.notes+'\\n';
  txt+='=== FIN RÉSUMÉ ===';
  return txt;
}

/* ===================== EXPORT JSON ===================== */
function exportQuoteJSON(){
  if(!CUR||!RECO)return;
  const p=CUR,r=RECO;
  const mainEl=document.querySelector('input[name=bMain]:checked');
  const mainKey=mainEl?mainEl.value:r.pri;
  const compKeys=[...document.querySelectorAll('input[name=bComp]:checked')].map(x=>x.value);
  const data={
    meta:{tool:'nexus-assistante-devis-v2',version:'2.1',generated:new Date().toISOString(),numero:LASTQUOTE&&LASTQUOTE.numero},
    profil:{eleve:p.eleve,parent:p.parent,level:p.level,status:p.status,school:p.school,objective:p.objective,mode:p.mode,budget:p.budget,spes:p.spes,modalite:p.modalite,repasse:p.repasse,lva:p.lva,notes:p.notes,phone:p.phone,email:p.email},
    recommandation:{principale:r.pri,alternative:r.alt,alertes:r.alerts,complements:r.comp},
    panier:{offre:mainKey,complements:compKeys,reducs:{ancien:document.getElementById('reduc-ancien')&&document.getElementById('reduc-ancien').checked,fratrie:document.getElementById('reduc-fratrie')&&document.getElementById('reduc-fratrie').checked,comptant:document.getElementById('reduc-comptant')&&document.getElementById('reduc-comptant').checked,parrainage:document.getElementById('reduc-parrainage')&&document.getElementById('reduc-parrainage').checked}},
    examens:examScope(p)
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download='devis-nexus-'+(LASTQUOTE&&LASTQUOTE.numero||new Date().toISOString().slice(0,10))+'.json';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
`;

// ── 7. Read source HTML, apply all patches, write outputs ────────────────────
let html = fs.readFileSync(HTML_SRC, 'utf8');

// P0: remove previous JSON embed
html = html.replace(/<script type="application\/json" id="nexus-offers-json"[\s\S]*?<\/script>\n?/, '');

// P1: inject JSON embed (after </style>)
html = html.replace('</style>', `</style>\n${JSON_EMBED}`);

// ── Idempotency helpers ───────────────────────────────────────────────────────
const already = (marker) => html.includes(marker);

// P2: inject extra CSS (idempotent)
if (!already('.econ-panel{')) html = html.replace('</style>', `${EXTRA_CSS}</style>`);

// P3: inject META + OFFERS merge (idempotent)
if (!already('const META=')) {
  const OFFERS_RE = /\/\* ={5,} DONNÉES OFFRES[\s\S]*?(?=\/\* ={5,} RÉFÉRENTIEL)/;
  if (OFFERS_RE.test(html)) html = html.replace(OFFERS_RE, META_JS + '\n');
  else html = html.replace('const SPECIALITES=', META_JS + '\nconst SPECIALITES=');
}

// P4: fix group size strings (idempotent — safe to re-run)
html = html
  .replace(/groupe 6 max/g, 'groupe 5 max')
  .replace(/groupe 6-8 max/g, 'groupe 5 max')
  .replace(/groupe 6-8/g, 'groupe 5')
  .replace(/groupe 6/g, 'groupe 5')
  .replace(/Groupe de 6/g, 'Groupe de 5')
  .replace(/groupes? de 5 à 6/gi, 'groupe de 5');

// P5: inject economics panel (idempotent)
if (!already('id="econPanel"')) html = html.replace('</form>', `${ECONOMICS_HTML}\n</form>`);

// P6: inject basket section (idempotent)
if (!already('id="basketWrap"')) html = html.replace('<section id="devisWrap">', `${BASKET_HTML}\n  <section id="devisWrap">`);

// P7: add new export buttons (idempotent)
if (!already('id="showBasketBtn"')) {
  html = html.replace(
    '<button type="reset" class="btn danger" id="resetBtn">Réinitialiser</button>',
    `<button type="reset" class="btn danger" id="resetBtn">Réinitialiser</button>
      <button type="button" class="btn gold" id="showBasketBtn">Configurer le panier</button>
      <button type="button" class="btn" id="copyResumeBtn">Copier résumé interne</button>
      <button type="button" class="btn" id="exportJsonBtn">Exporter JSON</button>`
  );
}

// P8: inject extra JS before closing </script> (idempotent)
const SCRIPT_END = '</script>\n</body>';
if (!already('function econCalc()')) html = html.replace(SCRIPT_END, `${EXTRA_JS}\n/* ===================== ÉVÉNEMENTS SUPPLÉMENTAIRES ===================== */
document.getElementById('showBasketBtn').addEventListener('click',()=>{
  if(!CUR){const p=readProfile();if(!p.eleve||!p.parent)return;}
  if(!RECO){render();}
  else{renderBasket();}
  document.getElementById('basketWrap').scrollIntoView({behavior:'smooth'});
});
document.getElementById('copyResumeBtn').addEventListener('click',async()=>{
  const txt=buildInternalResume();
  try{await navigator.clipboard.writeText(txt);
    document.getElementById('copyResumeBtn').textContent='Copié ✓';
    setTimeout(()=>document.getElementById('copyResumeBtn').textContent='Copier résumé interne',1500);
  }catch(_){alert(txt);}
});
document.getElementById('exportJsonBtn').addEventListener('click',exportQuoteJSON);

/* Déclencher le calcul éco après soumission du formulaire */
document.getElementById('quiz').addEventListener('submit',()=>{setTimeout(()=>{econCalc();renderBasket();},0);});
</script>\n</body>`);

// ── 8. Write outputs ─────────────────────────────────────────────────────────
// Écrire vers le projet Bureau
fs.writeFileSync(OUT_PROJECT, html, 'utf8');
console.log('✓ Écrit :', OUT_PROJECT);

// Réécrire la source Documents (si différente)
try {
  if (OUT_DOCS !== HTML_SRC || html !== fs.readFileSync(HTML_SRC, 'utf8')) {
    fs.writeFileSync(OUT_DOCS, html, 'utf8');
    console.log('✓ Écrit :', OUT_DOCS);
  }
} catch(e) {
  console.warn('⚠ Impossible d\'écrire vers Documents :', e.message);
}

// Archive v1 if it exists
if (fs.existsSync(OUT_V1)) {
  const archive = OUT_V1.replace('.html', `.archive-${Date.now()}.html`);
  fs.renameSync(OUT_V1, archive);
  console.log('✓ v1 archivée :', archive);
}

console.log('\n✅ Build terminé. Checksum JSON :', checksum);
console.log('   Points à valider direction :');
console.log('   0.1 Spé Simple Tle 65 TND/h > Excellence 39 TND/h — arbitrage tarifaire');
console.log('   0.2 Première Sciences 5 900 vs Double Sécurité 4 900');
console.log('   0.3 Remise Libre Mixte ≈ 9.7 % vs 18 % Duo');
console.log('   Exception : live Plateforme Accompagnée (10 élèves ?) vs règle des 5');
console.log('   Dates exactes stages vacances à confirmer');
