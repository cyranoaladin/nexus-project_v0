import type { Locator } from '@playwright/test';
import { test, expect, login, goStep, waitSaved, bilanPath } from './fixtures';
import { bilanData } from '../../lib/espace/bilan-data';
import { prisma } from '../../lib/prisma';

// Reveal the complete choice card before one pointer click. WebKit can focus-scroll
// a 16px radio at the viewport edge between pointerdown and pointerup.
async function selectChoice(input: Locator) {
  const label=input.locator('..');
  await label.evaluate(async element=>{
    element.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});
    let previous='', stable=0;
    for(let frame=0;frame<120;frame++) {
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      const r=element.getBoundingClientRect();
      const current=[r.top,r.left,r.width,r.height].join(',');
      stable=current===previous && r.top>=0 && r.bottom<=innerHeight ? stable+1 : 0;
      if(stable>=3) return;
      previous=current;
    }
    throw new Error('Choice card did not settle inside viewport');
  });
  await label.click(); await expect(input).toBeChecked();
}

for (const level of ['3e','2nde'] as const) {
  test(`${level} : huit étapes, toutes les questions, aides, reprise et transmission`,async({page,cohort},testInfo)=>{
    const account=level==='3e'?cohort.third:cohort.second;
    await login(page,account); await page.goto(bilanPath(level));
    await expect(page.getByRole('heading',{name:'Mon bilan du premier mois'})).toBeVisible();
    await expect(page.locator('a[href*="chatgpt"]')).toHaveCount(0);
    await expect(page.locator('#bilan-step option')).toHaveCount(8);
    for(const module of bilanData.modules[level]) await selectChoice(page.getByRole('group',{name:module.label,exact:true}).getByLabel('Oui, travaillé en séance',{exact:true}));
    await page.getByLabel('Une autre notion ou une trace').fill(`Trace ${level} : exercice revu pendant la séance de septembre.`);
    await waitSaved(page); await goStep(page,1);
    for(const module of bilanData.modules[level]) for(const skill of module.skills) await selectChoice(page.getByRole('group',{name:skill.text,exact:true}).getByLabel(bilanData.mastery.alone,{exact:true}));
    await goStep(page,2);
    const selection=page.getByRole('group',{name:/Les essais choisis/});
    const choices=selection.getByRole('checkbox');
    const titles=await choices.evaluateAll(nodes=>nodes.map(n=>n.closest('label')!.textContent!.trim()));
    await choices.nth(0).check(); await choices.nth(1).check(); await choices.nth(2).click();
    await expect(choices.nth(2)).not.toBeChecked();
    await expect(page.getByText('Choisis deux essais au maximum avec ton professeur.')).toBeVisible();
    const first=page.getByRole('article').filter({has:page.getByRole('heading',{name:titles[0],exact:true})});
    await first.getByLabel('Mon premier essai et mon explication').fill('Premier essai : je détaille mon raisonnement et je vérifie les conditions.');
    await first.getByRole('combobox',{name:'Aide utilisée',exact:true}).selectOption({label:'Un indice'});
    await first.getByLabel('Après une aide ou une reprise').fill('Après indice : je corrige mon calcul en gardant mon premier essai.');
    const second=page.getByRole('article').filter({has:page.getByRole('heading',{name:titles[1],exact:true})});
    await second.getByLabel('Je n’ai pas fait cet essai').check();
    await expect(second.getByLabel('Mon premier essai et mon explication')).toHaveCount(0);
    for(const [i,section] of bilanData.sections.entries()) {
      await goStep(page,i+3);
      for(const q of section.questions) {
        if(q.type==='text') await page.getByRole('textbox',{name:q.text}).fill(`Mon exemple pour ${q.id} : j’ai progressé avec une reprise précise.`);
        else if(q.type==='multi') await selectChoice(page.getByRole('group',{name:q.text,exact:true}).getByLabel(q.options![0],{exact:true}));
        else await selectChoice(page.getByRole('group',{name:q.text,exact:true}).getByLabel(q.options![0],{exact:true}));
      }
    }
    await waitSaved(page); await page.reload();
    await expect(page.locator('#bilan-step')).toHaveValue('6');
    await expect(page.getByRole('textbox',{name:'Quelle petite action réaliste choisis-tu avant la prochaine séance ?'})).toHaveValue(/Mon exemple pour commitment/);
    await goStep(page,7);
    await expect(page.getByRole('button',{name:'Transmettre mon bilan',exact:true})).toBeDisabled();
    await page.locator('details').filter({has:page.locator('summary').getByText('Mes essais',{exact:true})}).locator('summary').click();
    await expect(page.getByText(/Premier essai : Premier essai : je détaille/)).toBeVisible();
    await expect(page.getByText('Essai non fait',{exact:true})).toBeVisible();
    await page.getByLabel('J’ai relu mes réponses').check(); await waitSaved(page);
    await page.screenshot({path:testInfo.outputPath(`${level}-review.png`),fullPage:true});
    await page.getByRole('button',{name:'Transmettre mon bilan',exact:true}).click();
    await page.getByRole('button',{name:'Revenir à mes réponses',exact:true}).click();
    await expect(page.getByRole('button',{name:'Transmettre mon bilan',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Transmettre mon bilan',exact:true}).click();
    await page.getByRole('button',{name:'Transmettre',exact:true}).click();
    await expect(page.getByText('Ton bilan a été transmis.',{exact:false})).toBeVisible();
    await page.reload(); await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state','locked');
    await goStep(page,0); await expect(page.getByRole('radio').first()).toBeDisabled();
    await expect(page.getByLabel('Une autre notion ou une trace')).toHaveValue(/Trace/);
  });
}

test('sélections maximales, refus exclusif, absence de réponse et révision de la confirmation',async({page,cohort})=>{
  await login(page,cohort.third); await page.goto(bilanPath('3e')); await goStep(page,3);
  const blockers=page.getByRole('group',{name:'Qu’est-ce qui te gêne le plus en ce moment ?',exact:true});
  await blockers.getByLabel('Comprendre la consigne',{exact:true}).check();
  await blockers.getByLabel('Retrouver le cours utile',{exact:true}).check();
  await blockers.getByLabel('Choisir une méthode',{exact:true}).click();
  await expect(blockers.getByLabel('Choisir une méthode',{exact:true})).not.toBeChecked();
  await blockers.getByLabel('Aucune difficulté précise',{exact:true}).check();
  await expect(blockers.locator('input:checked')).toHaveCount(1);
  await blockers.getByLabel('Je ne souhaite pas répondre',{exact:true}).check();
  await expect(blockers.getByLabel('Aucune difficulté précise',{exact:true})).not.toBeChecked();
  await blockers.getByLabel('Faire les calculs',{exact:true}).check();
  await expect(blockers.getByLabel('Je ne souhaite pas répondre',{exact:true})).not.toBeChecked();
  await goStep(page,7); await page.getByLabel('J’ai relu mes réponses').check(); await waitSaved(page);
  await goStep(page,3); await blockers.getByLabel('Faire les calculs',{exact:true}).uncheck();
  await goStep(page,7); await expect(page.getByLabel('J’ai relu mes réponses')).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Transmettre mon bilan',exact:true})).toBeDisabled();
});

test('fractions : un prérequis non travaillé retire l’essai et sa trace, y compris après reprise',async({page,cohort})=>{
  await login(page,cohort.third); await page.goto(bilanPath('3e'));
  for(const label of ['Divisibilité, nombres premiers et division','Fractions irréductibles']) await page.getByRole('group',{name:label,exact:true}).getByLabel('Oui, travaillé en séance').check();
  await goStep(page,2); await page.getByRole('checkbox',{name:'Simplifier jusqu’au bout',exact:true}).check();
  await page.getByLabel('Mon premier essai et mon explication').fill('Ma trace provisoire : facteurs premiers.'); await waitSaved(page);
  await goStep(page,1);
  await page.getByRole('group',{name:'Je décompose un entier en facteurs premiers et je contrôle le produit.',exact:true}).getByLabel('Cette compétence n’a pas été travaillée',{exact:true}).check();
  await goStep(page,2); await expect(page.getByRole('checkbox',{name:'Simplifier jusqu’au bout',exact:true})).toHaveCount(0);
  await waitSaved(page); await page.reload();
  await expect(page.getByRole('checkbox',{name:'Simplifier jusqu’au bout',exact:true})).toHaveCount(0);
  await goStep(page,1);
  await page.getByRole('group',{name:'Je décompose un entier en facteurs premiers et je contrôle le produit.',exact:true}).getByLabel(bilanData.mastery.alone,{exact:true}).check();
  await goStep(page,2); await expect(page.getByRole('checkbox',{name:'Simplifier jusqu’au bout',exact:true})).not.toBeChecked();
  await page.getByRole('checkbox',{name:'Simplifier jusqu’au bout',exact:true}).check();
  await expect(page.getByLabel('Mon premier essai et mon explication')).toHaveValue('');
  await goStep(page,0); await page.getByRole('group',{name:'Divisibilité, nombres premiers et division',exact:true}).getByLabel('Non travaillé',{exact:true}).check();
  await goStep(page,2); await expect(page.getByRole('checkbox',{name:'Simplifier jusqu’au bout',exact:true})).toHaveCount(0);
});

test('coupure réseau : brouillon honnête, retour réseau puis reprise sur une autre session',async({page,context,browser,cohort})=>{
  await login(page,cohort.third); await page.goto(bilanPath('3e')); await waitSaved(page);
  await context.setOffline(true);
  await page.getByLabel('Une autre notion ou une trace').fill('Saisie pendant une coupure réseau.');
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state','offline');
  await context.setOffline(false); await waitSaved(page);
  const other=await browser.newContext(); const fresh=await other.newPage();
  try { await login(fresh,cohort.third); await fresh.goto(bilanPath('3e')); await expect(fresh.getByLabel('Une autre notion ou une trace')).toHaveValue('Saisie pendant une coupure réseau.'); }
  finally {await other.close();}
});

test('IndexedDB réel : deux rubriques hors connexion survivent à la fermeture de l’onglet',async({page,context,cohort})=>{
  const scopeAnswer='Trace conservée sur cet appareil avant fermeture.';
  const methodAnswer='Je reprends ma méthode après la coupure réseau.';
  await login(page,cohort.third);await page.goto(bilanPath('3e'));await waitSaved(page);
  const work=await prisma.espaceWork.findFirstOrThrow({where:{studentId:cohort.third.id,activity:{slug:'maths-bilan-septembre-2026-3e'}}});
  await context.setOffline(true);
  await page.getByLabel('Une autre notion ou une trace').fill(scopeAnswer);
  await goStep(page,3);
  await page.getByRole('textbox',{name:'Décris un blocage concret, ou une méthode qui t’a aidé à le dépasser.'}).fill(methodAnswer);
  await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state','offline');
  await expect.poll(()=>page.evaluate(async({key,scopeAnswer,methodAnswer})=>{
    const record=await new Promise<{pending?:Record<string,{fields?:Record<string,string>}>}|undefined>((resolve,reject)=>{
      const open=indexedDB.open('nexus-espace',1);
      open.onerror=()=>reject(open.error);
      open.onsuccess=()=>{
        const db=open.result;const transaction=db.transaction('drafts','readonly');
        const get=transaction.objectStore('drafts').get(key);
        get.onsuccess=()=>resolve(get.result);get.onerror=()=>reject(get.error);
        transaction.oncomplete=()=>db.close();
      };
    });
    return {scope:record?.pending?.scope?.fields?.other===scopeAnswer,methods:record?.pending?.methods?.fields?.['block-example']===methodAnswer};
  },{key:`${cohort.third.id}:${work.id}`,scopeAnswer,methodAnswer})).toEqual({scope:true,methods:true});
  await page.close();
  await context.setOffline(false);
  const restored=await context.newPage();await restored.goto(bilanPath('3e'));
  await expect(restored.getByLabel('Une autre notion ou une trace')).toHaveValue(scopeAnswer);
  await waitSaved(restored);await goStep(restored,3);
  await expect(restored.getByRole('textbox',{name:'Décris un blocage concret, ou une méthode qui t’a aidé à le dépasser.'})).toHaveValue(methodAnswer);
  await waitSaved(restored);await restored.reload();
  await expect(restored.getByRole('textbox',{name:'Décris un blocage concret, ou une méthode qui t’a aidé à le dépasser.'})).toHaveValue(methodAnswer);
  await goStep(restored,0);await expect(restored.getByLabel('Une autre notion ou une trace')).toHaveValue(scopeAnswer);
  await waitSaved(restored);
});

for(const resolution of ['Prendre l’autre version','Garder ma version']) {
  test(`deux onglets : conflit explicite et résolution « ${resolution} »`,async({page,browser,cohort})=>{
    await login(page,cohort.third); await page.goto(bilanPath('3e')); await waitSaved(page);
    const other=await browser.newContext(); const rival=await other.newPage();
    try {
      await login(rival,cohort.third); await rival.goto(bilanPath('3e')); await waitSaved(rival);
      await page.getByLabel('Une autre notion ou une trace').fill('Version du premier appareil.'); await waitSaved(page);
      await rival.getByLabel('Une autre notion ou une trace').fill('Version du second appareil.');
      await expect(rival.getByRole('heading',{name:'Ce bilan a été modifié ailleurs',exact:true})).toBeVisible();
      await rival.getByRole('button',{name:resolution,exact:true}).click(); await waitSaved(rival);
      await rival.reload();
      await expect(rival.getByLabel('Une autre notion ou une trace')).toHaveValue(resolution==='Garder ma version'?'Version du second appareil.':'Version du premier appareil.');
    } finally {await other.close();}
  });
}

test('niveau, élève voisin et compte non attribué : les copies restent privées',async({page,browser,cohort})=>{
  await login(page,cohort.third); await page.goto(bilanPath('3e')); await waitSaved(page);
  const work=await prisma.espaceWork.findFirstOrThrow({where:{studentId:cohort.third.id,activity:{slug:'maths-bilan-septembre-2026-3e'}}});
  await page.goto(bilanPath('2nde')); await expect(page.getByTestId('bilan-workbench')).toHaveCount(0);
  for(const account of [cohort.peer,cohort.unassigned]) {
    const ctx=await browser.newContext();const p=await ctx.newPage();
    try {
      await login(p,account);
      expect((await p.request.get(`/api/espace/works/${work.id}`)).status()).toBe(404);
      if(account===cohort.unassigned) for(const level of ['3e','2nde'] as const) {await p.goto(bilanPath(level));await expect(p.getByTestId('bilan-workbench')).toHaveCount(0);}
    } finally {await ctx.close();}
  }
});
