import { test,expect,login,goStep,stepIndex,waitSaved,bilanPath,makeCredentialTemporary } from './fixtures';
import { prisma } from '../../lib/prisma';
import { bilanData, getBilanLesson } from '../../lib/espace/bilan-data';

test('390 px tactile et clavier : les étapes adaptées restent lisibles et utilisables',async({browser,browserName,cohort},testInfo)=>{
  // Firefox does not implement mobile user-agent emulation; viewport and touch remain exercised.
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:browserName!=='firefox',hasTouch:true});
  const page=await ctx.newPage();
  try {
    await login(page,cohort.second);await page.goto(bilanPath('2nde'));
    const scope=page.getByRole('group',{name:'Calcul numérique et fractions',exact:true});
    const yes=scope.getByLabel('Oui, travaillé en séance',{exact:true});
    await yes.focus();await yes.press('Space');await expect(yes).toBeChecked();
    await waitSaved(page);
    for(const [index,step] of getBilanLesson('2nde').steps.entries()) {
      if(await page.locator(`#bilan-step option[value="${step.id}"]`).isDisabled()) continue;
      await goStep(page,step.id);
      await expect(page.locator('#bilan-heading')).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await page.screenshot({path:testInfo.outputPath(`mobile-student-step-${index+1}.png`),fullPage:true});
    }
    await goStep(page,0);await page.getByRole('button',{name:'Continuer',exact:true}).tap();
    await expect(page.locator('#bilan-step')).toHaveValue(stepIndex(page, 'journey'));
  }finally{await ctx.close();}
});

test('390 px enseignant : aperçu par niveau, tableau et étapes adaptées sans débordement',async({page,cohort},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await login(page,cohort.teacher);
  await page.goto('/espace/enseignant');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('teacher-mobile-dashboard.png'),fullPage:true});
  for(const level of ['3e','2nde'] as const) {
    await page.goto(`/espace/enseignant/bilans?niveau=${level}`);
    await expect(page.getByText('Aperçu enseignant :',{exact:false})).toBeVisible();
    await expect(page.getByRole('radio',{checked:true})).toHaveCount(bilanData.modules[level].length);
    for(const [index,step] of getBilanLesson(level).steps.entries()) {
      await goStep(page,step.id);
      if(step.id.startsWith('mastery')) {
        for(const field of step.fields) await expect(page.getByRole('group',{name:field.label,exact:true})).toBeAttached();
      }
      if(step.id==='evidence') {
        await page.getByRole('group',{name:/Les essais choisis/}).getByRole('checkbox').first().check();
        await expect(page.getByRole('article')).toHaveCount(1);
        await expect(page.getByLabel('Mon premier essai et mon explication')).toBeVisible();
      }
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      if(step.id.startsWith('mastery') || step.id==='evidence') await page.screenshot({path:testInfo.outputPath(`teacher-mobile-preview-${level}-step-${index+1}.png`),fullPage:true});
    }
    await page.screenshot({path:testInfo.outputPath(`teacher-mobile-preview-${level}.png`),fullPage:true});
  }
  expect(await prisma.espaceWork.count({where:{studentId:{in:[cohort.third.id,cohort.second.id,cohort.peer.id,cohort.unassigned.id]}}})).toBe(0);
});

test('code temporaire : passage obligatoire, nouveau code, ancienne session révoquée puis bilan accessible',async({page,browser,cohort})=>{
  await makeCredentialTemporary(cohort.third);await login(page,cohort.third);
  await expect(page.getByTestId('credential-mandatory')).toBeVisible();
  await page.goto(bilanPath('3e'));
  await expect(page).toHaveURL(/\/espace\/eleve\/compte\?obligatoire=1/);
  await expect(page.getByTestId('bilan-workbench')).toHaveCount(0);
  const oldSession=await browser.newContext({storageState:await page.context().storageState()});
  const chosen='BilanExemple42';
  try {
    await page.getByTestId('input-current').fill(cohort.third.secret);
    await page.getByTestId('input-next').fill(chosen);
    await page.getByTestId('input-confirm').fill('AutreExemple42');
    await page.getByTestId('btn-credential').click();
    await expect(page.getByTestId('credential-error')).toContainText('ne correspondent pas');
    await page.getByTestId('input-confirm').fill(chosen);await page.getByTestId('btn-credential').click();
    await expect(page.getByTestId('credential-success')).toBeVisible();
    await page.waitForURL(/\/espace\/connexion\?modifie=1/);
    const stale=await oldSession.newPage();await stale.goto(bilanPath('3e'));
    await expect(stale).toHaveURL(/\/espace\/connexion/);
    await page.getByTestId('input-username').fill(cohort.third.username);
    await page.getByTestId('input-secret').fill(cohort.third.secret);await page.getByTestId('btn-connexion').click();
    await expect(page.getByTestId('connexion-erreur')).toBeVisible();
    await login(page,{...cohort.third,secret:chosen});await page.goto(bilanPath('3e'));
    await expect(page.getByTestId('bilan-workbench')).toBeVisible();
    expect((await prisma.user.findUniqueOrThrow({where:{id:cohort.third.id}})).pinMustChange).toBe(false);
  }finally{await oldSession.close();}
});
