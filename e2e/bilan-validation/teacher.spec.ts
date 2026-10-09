import { test, expect, login, goStep, waitSaved, bilanPath, type Account } from './fixtures';
import type { Page } from '@playwright/test';
import { prisma } from '../../lib/prisma';
import type { ExportEnvelope } from '../../lib/espace/export';

const initialTrace = 'J’ai expliqué 36 = 2² × 3².\n<script>window.__bilanInjected=true</script>';
const feedback = 'Point observé : raisonnement explicité.\nPriorité : vérifier le calcul, avec une reprise à la prochaine séance.';
async function submit(page: Page) {
  await goStep(page,7); await page.getByLabel('J’ai relu mes réponses').check(); await waitSaved(page);
  await page.getByRole('button',{name:'Transmettre mon bilan',exact:true}).click();
  await page.getByRole('button',{name:'Transmettre',exact:true}).click();
  await expect(page.getByText('Ton bilan a été transmis.',{exact:false})).toBeVisible();
}
async function prepare(page: Page, account: Account, level: '3e'|'2nde', trace=initialTrace) {
  await login(page,account); await page.goto(bilanPath(level));
  await page.getByLabel('Une autre notion ou une trace').fill(trace); await waitSaved(page);
  await submit(page);
  const work=await prisma.espaceWork.findFirstOrThrow({where:{studentId:account.id}});
  return work.id;
}

for (const level of ['3e','2nde'] as const) {
  test(`${level} : réponse élève → correction → exports → rapport PDF → reprise → terminé`,async({page,browser,cohort},testInfo)=>{
    const account=level==='3e'?cohort.third:cohort.second;
    const workId=await prepare(page,account,level);
    const teacherContext=await browser.newContext(); const teacher=await teacherContext.newPage();
    try {
      await login(teacher,cohort.teacher);
      const overview=await teacher.request.get(`/api/espace/teacher/overview?activity=maths-bilan-septembre-2026-${level}`);
      expect(overview.ok()).toBeTruthy(); expect(await overview.text()).toContain(workId);
      await teacher.goto(`/espace/enseignant/corriger/${workId}`);
      await expect(teacher.getByRole('heading',{name:`${account.firstName} ${account.lastName}`,exact:true})).toBeVisible();
      await expect(teacher.getByText(initialTrace,{exact:true})).toBeVisible();
      expect(await teacher.evaluate(()=>Boolean((window as unknown as Record<string,unknown>).__bilanInjected))).toBe(false);
      await teacher.getByLabel('Commentaire',{exact:true}).fill(feedback);
      await teacher.getByRole('button',{name:'Enregistrer',exact:true}).click();
      await expect(teacher.getByText('Annotation enregistrée.',{exact:true})).toBeVisible();
      await expect(teacher.getByTestId('annotation')).toHaveCount(1);
      const beforePublish=await page.request.get(`/api/espace/works/${workId}`);
      expect((await beforePublish.json()).annotations).toEqual([]);
      await teacher.getByLabel('Porte sur',{exact:true}).selectOption('QUESTION');
      await teacher.getByLabel('Étape',{exact:true}).selectOption('scope');
      await teacher.getByLabel('Question',{exact:true}).selectOption('other');
      await teacher.getByLabel('Commentaire',{exact:true}).fill('Trace relue : conserve cette justification.');
      await teacher.getByRole('button',{name:'Corrigé',exact:true}).click();
      await expect(teacher.getByText('Travail marqué corrigé : l’élève voit vos retours.',{exact:true})).toBeVisible();
      await expect(teacher.getByTestId('annotation')).toHaveCount(2);
      await page.reload(); await goStep(page,0);
      await expect(page.getByText(feedback,{exact:true})).toBeVisible();
      await expect(page.getByText('Trace relue : conserve cette justification.',{exact:true})).toBeVisible();
      for (const query of [`workId=${workId}`,`sessionId=${cohort.sessions[level==='3e'?'third':'second']}`,`studentId=${account.id}`]) {
        const response=await teacher.request.get(`/api/espace/teacher/export?${query}`);
        expect(response.status()).toBe(200);
        expect(response.headers()['content-disposition']).toContain('attachment;');
        expect(response.headers()['cache-control']).toContain('no-store');
        const exported=await response.json() as ExportEnvelope;
        expect(exported.works).toHaveLength(1); const copy=exported.works[0];
        expect(copy.status).toBe('CORRECTED');
        expect(copy.content).toMatchObject({steps:{scope:{fields:{other:initialTrace}}}});
        expect(copy.annotations.map(a=>a.body)).toEqual([feedback,'Trace relue : conserve cette justification.']);
        expect(copy.versions.some(v=>v.reason==='SUBMIT')).toBe(true);
        const text=JSON.stringify(exported);
        expect(text).not.toContain(account.secret); expect(text).not.toContain(account.username);
        expect(text).not.toMatch(/pinHash|passwordHash|\"authorId\"/);
      }
      const download=teacher.waitForEvent('download'); await teacher.getByRole('link',{name:'Exporter',exact:true}).click();
      const file=await download; expect(file.suggestedFilename()).toMatch(/\.json$/); await file.saveAs(testInfo.outputPath(`${level}-export.json`));
      await teacher.getByRole('link',{name:'Synthèse familiale',exact:true}).click();
      const report=teacher.locator('#bilan-family-report');
      await expect(report).toContainText(initialTrace); await expect(report).toContainText(feedback);
      await expect(report).toContainText('Retour pédagogique enregistré');
      expect(await teacher.evaluate(()=>Boolean((window as unknown as Record<string,unknown>).__bilanInjected))).toBe(false);
      await teacher.emulateMedia({media:'print'});
      expect(await report.locator('h1').evaluate(el=>getComputedStyle(el).color)).toBe('rgb(15, 23, 42)');
      const pdf=await teacher.pdf({path:testInfo.outputPath(`${level}-rapport.pdf`),format:'A4',printBackground:true}); expect(pdf.length).toBeGreaterThan(10000);
      await teacher.emulateMedia({media:'screen'});
      await teacher.goto(`/espace/enseignant/corriger/${workId}`);
      await teacher.getByRole('button',{name:'À reprendre',exact:true}).click();
      await expect(teacher.getByText('Travail rouvert : l’élève peut le reprendre.',{exact:true})).toBeVisible();
      await page.reload(); await goStep(page,7);
      await expect(page.getByLabel('J’ai relu mes réponses')).not.toBeChecked();
      await expect(page.getByRole('button',{name:'Transmettre mon bilan',exact:true})).toBeDisabled();
      await goStep(page,0); await page.getByLabel('Une autre notion ou une trace').fill('Reprise : je vérifie le produit obtenu.'); await waitSaved(page); await submit(page);
      await teacher.reload();
      const versions=await teacher.request.get(`/api/espace/works/${workId}/versions`);
      const original=(await versions.json()).versions.filter((v:{reason:string})=>v.reason==='SUBMIT').sort((a:{revision:number},b:{revision:number})=>a.revision-b.revision)[0];
      await teacher.getByLabel('Version affichée').selectOption(original.id);
      await expect(teacher.getByText(initialTrace,{exact:true})).toBeVisible();
      await teacher.getByLabel('Version affichée').selectOption('');
      await expect(teacher.getByText('Reprise : je vérifie le produit obtenu.',{exact:true})).toBeVisible();
      await teacher.getByRole('button',{name:'Corrigé',exact:true}).click();
      await expect(teacher.getByRole('button',{name:'Terminé',exact:true})).toBeEnabled();
      await teacher.getByRole('button',{name:'Terminé',exact:true}).click();
      await expect(teacher.getByText('Travail terminé.',{exact:true})).toBeVisible();
      const final=await teacher.request.get(`/api/espace/teacher/export?workId=${workId}`);
      expect((await final.json()).works[0]).toMatchObject({status:'DONE',content:{steps:{scope:{fields:{other:'Reprise : je vérifie le produit obtenu.'}}}}});
      await teacher.getByRole('link',{name:'Synthèse familiale',exact:true}).click();
      await expect(teacher.locator('#bilan-family-report')).toContainText('Reprise : je vérifie le produit obtenu.');
      await expect(teacher.locator('#bilan-family-report')).not.toContainText(initialTrace);
    } finally {await teacherContext.close();}
  });
}

test('panne pendant un commentaire : brouillon conservé, statut inchangé, reprise sans doublon',async({page,browser,cohort})=>{
  const workId=await prepare(page,cohort.third,'3e');
  const context=await browser.newContext(); const teacher=await context.newPage();
  try {
    await login(teacher,cohort.teacher); await teacher.goto(`/espace/enseignant/corriger/${workId}`);
    await teacher.getByLabel('Commentaire',{exact:true}).fill(feedback);
    const url=`**/api/espace/works/${workId}/annotations`;
    await teacher.route(url,route=>route.request().method()==='POST'?route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'UNAVAILABLE',message:'Indisponibilité simulée.'})}):route.continue());
    await teacher.getByRole('button',{name:'Corrigé',exact:true}).click();
    await expect(teacher.getByRole('alert').filter({hasText:'Indisponibilité simulée.'})).toBeVisible();
    await expect(teacher.getByLabel('Commentaire',{exact:true})).toHaveValue(feedback);
    expect(await prisma.espaceWork.findUniqueOrThrow({where:{id:workId}})).toMatchObject({status:'SUBMITTED'});
    expect(await prisma.espaceAnnotation.count({where:{workId}})).toBe(0);
    await teacher.unroute(url);
    await teacher.getByRole('button',{name:'Corrigé',exact:true}).click();
    await expect(teacher.getByText('Travail marqué corrigé : l’élève voit vos retours.',{exact:true})).toBeVisible();
    expect(await prisma.espaceAnnotation.count({where:{workId}})).toBe(1);
  } finally {await context.close();}
});

test('navigation entre deux élèves : aucune ancienne version ni commentaire attribué au suivant',async({page,browser,cohort})=>{
  const firstId=await prepare(page,cohort.third,'3e','Trace du premier élève.');
  const other=await browser.newContext(); const peer=await other.newPage();
  const teacherContext=await browser.newContext(); const teacher=await teacherContext.newPage();
  try {
    const secondId=await prepare(peer,cohort.peer,'3e','Trace du second élève.');
    await login(teacher,cohort.teacher); await teacher.goto(`/espace/enseignant/corriger/${firstId}`);
    const versions=await (await teacher.request.get(`/api/espace/works/${firstId}/versions`)).json();
    const version=versions.versions.find((v:{reason:string})=>v.reason==='SUBMIT');
    await teacher.getByLabel('Version affichée').selectOption(version.id);
    await expect(teacher.getByText(/Vous consultez une ancienne version/)).toBeVisible();
    await teacher.getByLabel('Commentaire',{exact:true}).fill('Observation réservée au premier élève.');
    await teacher.getByRole('navigation',{name:'Élèves de cette activité'}).locator(`a[href$="/${secondId}"]`).click();
    await expect(teacher.getByRole('heading',{name:`${cohort.peer.firstName} ${cohort.peer.lastName}`,exact:true})).toBeVisible();
    await expect(teacher.getByLabel('Commentaire',{exact:true})).toHaveValue('');
    await expect(teacher.getByText(/Vous consultez une ancienne version/)).toHaveCount(0);
    await expect(teacher.getByText('Trace du second élève.',{exact:true})).toBeVisible();
    await expect(teacher.getByText('Trace du premier élève.',{exact:true})).toHaveCount(0);
    expect(await prisma.espaceAnnotation.count({where:{workId:secondId}})).toBe(0);
  } finally {await other.close(); await teacherContext.close();}
});

test('accès HTTP : autre enseignant, élève et visiteur ne récupèrent ni export ni correction',async({page,browser,cohort})=>{
  const workId=await prepare(page,cohort.third,'3e','Réponse strictement privée de cet élève.');
  for(const account of [cohort.otherTeacher,cohort.peer,null]) {
    const context=await browser.newContext(); const outsider=await context.newPage();
    try {
      if(account) await login(outsider,account);
      for(const path of [`/api/espace/works/${workId}`,`/api/espace/works/${workId}/versions`,`/api/espace/teacher/export?workId=${workId}`,`/api/espace/teacher/export?sessionId=${cohort.sessions.third}`,`/api/espace/teacher/export?studentId=${cohort.third.id}`]) {
        const response=await outsider.request.get(path);
        expect([401,403,404]).toContain(response.status());
        expect(await response.text()).not.toContain('Réponse strictement privée');
      }
      const mutation=await outsider.request.post(`/api/espace/works/${workId}/review`,{data:{action:'REOPEN'},headers:{origin:'http://127.0.0.1:3017'}});
      expect([401,403,404]).toContain(mutation.status());
      for(const path of [`/espace/enseignant/corriger/${workId}`,`/espace/enseignant/bilans/${workId}`]) {
        await outsider.goto(path);
        await expect(outsider.getByText('Réponse strictement privée de cet élève.',{exact:true})).toHaveCount(0);
        await expect(outsider.locator('#bilan-family-report')).toHaveCount(0);
      }
    } finally {await context.close();}
  }
  expect(await prisma.espaceWork.findUniqueOrThrow({where:{id:workId}})).toMatchObject({status:'SUBMITTED'});
});
