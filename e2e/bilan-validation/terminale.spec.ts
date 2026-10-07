import type { Locator, Page } from '@playwright/test';
import { test, expect, login, goStep, waitSaved, terminalePath, type TerminaleLevel } from './terminale-fixtures';
import { bilanData, getBilanSections } from '../../lib/espace/bilan-data';
import { BILAN_PROFILES } from '../../lib/espace/bilan-profiles';
import { prisma } from '../../lib/prisma';
import type { ExportEnvelope } from '../../lib/espace/export';

async function choose(input: Locator) {
  await input.locator('..').scrollIntoViewIfNeeded();
  await input.check();
  await expect(input).toBeChecked();
}
async function transmit(page: Page) {
  await goStep(page, 7);
  await page.getByLabel('J’ai relu mes réponses').check();
  await waitSaved(page);
  await page.getByRole('button', { name: 'Transmettre mon bilan', exact: true }).click();
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();
  await expect(page.getByText('Ton bilan a été transmis.', { exact: false })).toBeVisible();
}
async function workOf(studentId: string, level: TerminaleLevel) {
  return prisma.espaceWork.findFirstOrThrow({ where: { studentId, activity: { slug: BILAN_PROFILES[level].slug } } });
}

for (const level of ['tle-maths', 'tle-nsi'] as const) {
  test(`${level} : huit étapes, sauvegarde serveur, reprise, transmission, correction et rapport exporté`, async ({ page, browser, browserName, terminale }, testInfo) => {
    await login(page, terminale.dual);
    await page.goto(terminalePath(level));
    await expect(page.getByTestId('bilan-workbench')).toBeVisible();
    await expect(page.locator('#bilan-step option')).toHaveCount(8);
    const modules = bilanData.modules[level];
    const theme = modules[0];
    await choose(page.getByRole('group', { name: theme.label, exact: true }).getByLabel('Oui, travaillé en séance', { exact: true }));
    const trace = `Trace ${level} : je justifie ma démarche sur un exemple travaillé.`;
    await page.getByLabel('Une autre notion ou une trace').fill(trace);
    await goStep(page, 1);
    for (const skill of theme.skills) await choose(page.getByRole('group', { name: skill.text, exact: true }).getByLabel(bilanData.mastery.alone, { exact: true }));
    await goStep(page, 2);
    await page.getByRole('group', { name: /Les essais choisis/ }).getByRole('checkbox').first().check();
    const attempt = `Premier essai ${level} : j’explicite les étapes.`;
    const retry = `Reprise ${level} après un indice : je vérifie un cas limite.`;
    await page.getByLabel('Mon premier essai et mon explication').fill(attempt);
    await page.getByRole('combobox', { name: 'Aide utilisée', exact: true }).selectOption({ label: 'Un indice' });
    await page.getByLabel('Après une aide ou une reprise').fill(retry);
    for (const [index, section] of getBilanSections(level).entries()) {
      await goStep(page, index + 3);
      expect(section.questions.length).toBeGreaterThan(0);
      for (const question of section.questions) {
        if (question.type === 'text') await page.getByRole('textbox', { name: question.text }).fill(`Réponse ${level} ${question.id} : une reprise personnelle.`);
        else await choose(page.getByRole('group', { name: question.text, exact: true }).getByLabel(question.options![0], { exact: true }));
      }
    }
    await waitSaved(page);
    await page.reload();
    await expect(page.locator('#bilan-step')).toHaveValue('6');
    await goStep(page, 2);
    await expect(page.getByLabel('Mon premier essai et mon explication')).toHaveValue(attempt);
    await expect(page.getByLabel('Après une aide ou une reprise')).toHaveValue(retry);
    await transmit(page);
    const work = await workOf(terminale.dual.id, level);
    expect(work.status).toBe('SUBMITTED');
    const teacherContext = await browser.newContext();
    const teacher = await teacherContext.newPage();
    const feedback = `Observation ${level} : première démarche conservée. Deux priorités : expliquer le choix ; contrôler un cas limite.`;
    try {
      await login(teacher, level === 'tle-maths' ? terminale.mathsTeacher : terminale.nsiTeacher);
      await teacher.goto(`/espace/enseignant/corriger/${work.id}`);
      await expect(teacher.getByText(trace, { exact: true })).toBeVisible();
      await expect(teacher.getByText(attempt, { exact: false })).toBeVisible();
      await teacher.getByLabel('Commentaire', { exact: true }).fill(feedback);
      await teacher.getByRole('button', { name: 'Corrigé', exact: true }).click();
      await expect(teacher.getByText('Travail marqué corrigé : l’élève voit vos retours.', { exact: true })).toBeVisible();
      await page.reload();
      await expect(page.getByText(feedback, { exact: true })).toBeVisible();
      const response = await teacher.request.get(`/api/espace/teacher/export?workId=${work.id}`);
      expect(response.status()).toBe(200);
      expect(response.headers()['cache-control']).toContain('no-store');
      const exported = await response.json() as ExportEnvelope;
      expect(exported.works).toHaveLength(1);
      expect(exported.works[0]).toMatchObject({ status: 'CORRECTED', content: { steps: { scope: { fields: { other: trace } } } } });
      expect(JSON.stringify(exported)).toContain(attempt);
      expect(JSON.stringify(exported)).toContain(retry);
      expect(JSON.stringify(exported)).not.toContain(terminale.dual.secret);
      expect(JSON.stringify(exported)).not.toMatch(/pinHash|passwordHash/);
      await teacher.getByRole('link', { name: 'Synthèse familiale', exact: true }).click();
      const report = teacher.locator('#bilan-family-report');
      await expect(report).toContainText(feedback);
      await expect(report).toContainText(attempt);
      await expect(report).toContainText(retry);
      await expect(report).toContainText('Terminale');
      if (level === 'tle-nsi') {
        await expect(report.locator('header')).toContainText('NSI');
        await expect(report.locator('header')).not.toContainText(/mathématiques/i);
      }
      await teacher.emulateMedia({ media: 'print' });
      expect(await report.locator('h1').evaluate(el => getComputedStyle(el).color)).toBe('rgb(15, 23, 42)');
      if (browserName === 'chromium') await teacher.pdf({ path: testInfo.outputPath(`${level}-rapport.pdf`), format: 'A4', printBackground: true });
    } finally { await teacherContext.close(); }
  });
}

test('double inscription : deux copies, révisions, confirmations et exports indépendants', async ({ page, browser, terminale }) => {
  await login(page, terminale.dual);
  await page.goto(terminalePath('tle-maths'));
  await page.getByLabel('Une autre notion ou une trace').fill('Trace réservée aux mathématiques.');
  await waitSaved(page);
  await goStep(page, 7); await page.getByLabel('J’ai relu mes réponses').check(); await waitSaved(page);
  const mathsBefore = await workOf(terminale.dual.id, 'tle-maths');
  await page.goto(terminalePath('tle-nsi'));
  await expect(page.getByLabel('Une autre notion ou une trace')).toHaveValue('');
  await page.getByLabel('Une autre notion ou une trace').fill('Trace réservée à la NSI.');
  await waitSaved(page); await transmit(page);
  const nsi = await workOf(terminale.dual.id, 'tle-nsi');
  const mathsAfter = await workOf(terminale.dual.id, 'tle-maths');
  expect(nsi.id).not.toBe(mathsAfter.id);
  expect(nsi.status).toBe('SUBMITTED');
  expect(mathsAfter.revision).toBe(mathsBefore.revision);
  expect(mathsAfter.content).toEqual(mathsBefore.content);
  await page.goto(terminalePath('tle-maths'));
  await expect(page.getByLabel('J’ai relu mes réponses')).toBeChecked();
  await goStep(page, 0);
  await expect(page.getByLabel('Une autre notion ou une trace')).toHaveValue('Trace réservée aux mathématiques.');
  for (const [account, ownId, otherId, ownTrace, otherTrace] of [
    [terminale.mathsTeacher, mathsAfter.id, nsi.id, 'Trace réservée aux mathématiques.', 'Trace réservée à la NSI.'],
    [terminale.nsiTeacher, nsi.id, mathsAfter.id, 'Trace réservée à la NSI.', 'Trace réservée aux mathématiques.'],
  ] as const) {
    const ctx = await browser.newContext(); const teacher = await ctx.newPage();
    try {
      await login(teacher, account);
      const response = await teacher.request.get(`/api/espace/teacher/export?studentId=${terminale.dual.id}`);
      expect(response.status()).toBe(200);
      const exported = await response.json() as ExportEnvelope;
      expect(exported.works).toHaveLength(1);
      const serialized = JSON.stringify(exported);
      expect(serialized).toContain(ownId); expect(serialized).toContain(ownTrace);
      expect(serialized).not.toContain(otherId); expect(serialized).not.toContain(otherTrace);
    } finally { await ctx.close(); }
  }
});

test('inscriptions matières et séances publiées : maths seul, NSI seul et absence d’attribution', async ({ browser, terminale }) => {
  for (const [account, allowed] of [[terminale.mathsOnly, 'tle-maths'], [terminale.nsiOnly, 'tle-nsi'], [terminale.unassigned, null]] as const) {
    const context = await browser.newContext(); const page = await context.newPage();
    try {
      await login(page, account);
      for (const level of ['tle-maths', 'tle-nsi'] as const) {
        await page.goto(terminalePath(level));
        if (allowed === level) await expect(page.getByTestId('bilan-workbench')).toBeVisible();
        else {
          await expect(page.getByTestId('bilan-workbench')).toHaveCount(0);
          const response = await page.request.post('/api/espace/works', { data: { activitySlug: BILAN_PROFILES[level].slug, sessionId: terminale.sessions[level] } });
          expect([403, 404]).toContain(response.status());
        }
      }
      expect(await prisma.espaceWork.count({ where: { studentId: account.id } })).toBe(allowed ? 1 : 0);
    } finally { await context.close(); }
  }
});

for (const level of ['tle-maths', 'tle-nsi'] as const) {
  test(`${level} : enseignant de l’autre matière refusé sur lecture, correction, historique et exports`, async ({ page, browser, terminale }) => {
    await login(page, terminale.dual); await page.goto(terminalePath(level));
    const trace = `Trace privée ${level}.`;
    await page.getByLabel('Une autre notion ou une trace').fill(trace); await waitSaved(page); await transmit(page);
    const work = await workOf(terminale.dual.id, level);
    const ctx = await browser.newContext(); const wrong = await ctx.newPage();
    try {
      await login(wrong, level === 'tle-maths' ? terminale.nsiTeacher : terminale.mathsTeacher);
      for (const url of [`/api/espace/works/${work.id}`, `/api/espace/works/${work.id}/versions`, `/api/espace/teacher/export?workId=${work.id}`, `/api/espace/teacher/export?sessionId=${terminale.sessions[level]}`]) {
        const response = await wrong.request.get(url);
        expect([403, 404]).toContain(response.status());
        expect(await response.text()).not.toContain(trace);
      }
      const review = await wrong.request.post(`/api/espace/works/${work.id}/review`, { data: { action: 'REOPEN' } });
      expect([403, 404]).toContain(review.status());
      const annotation = await wrong.request.post(`/api/espace/works/${work.id}/annotations`, { data: { kind: 'GENERAL', body: 'Ne doit pas être enregistré.' } });
      expect([403, 404]).toContain(annotation.status());
      for (const route of [`/espace/enseignant/corriger/${work.id}`, `/espace/enseignant/bilans/${work.id}`]) {
        await wrong.goto(route);
        await expect(wrong.getByText(trace, { exact: false })).toHaveCount(0);
        await expect(wrong.locator('#bilan-family-report')).toHaveCount(0);
      }
      expect((await workOf(terminale.dual.id, level)).status).toBe('SUBMITTED');
      expect(await prisma.espaceAnnotation.count({ where: { workId: work.id } })).toBe(0);
    } finally { await ctx.close(); }
  });
}

test('aperçu Terminale NSI : vocabulaire de la matière, questions propres et aucune création de copie', async ({ page, terminale }) => {
  await login(page, terminale.nsiTeacher);
  const before = await prisma.espaceWork.count({ where: { studentId: { in: [terminale.dual.id, terminale.mathsOnly.id, terminale.nsiOnly.id, terminale.unassigned.id] } } });
  await page.goto('/espace/enseignant/bilans?niveau=tle-nsi');
  const workbench = page.getByTestId('bilan-workbench');
  await expect(workbench.locator('header')).toContainText('NSI');
  await expect(workbench.locator('header')).not.toContainText(/mathématiques|seconde|troisième/i);
  await expect(page.getByText('Aperçu enseignant : les réponses d’essai ne sont ni enregistrées ni transmises.')).toBeVisible();
  await goStep(page, 3);
  await expect(page.getByRole('group', { name: getBilanSections('tle-nsi')[0].questions[0].text, exact: true })).toBeVisible();
  await goStep(page, 2);
  await page.getByRole('group', { name: /Les essais choisis/ }).getByRole('checkbox').first().check();
  await page.getByLabel('Mon premier essai et mon explication').fill('Essai fictif de l’enseignant.');
  await expect(page.getByRole('button', { name: 'Transmettre mon bilan', exact: true })).toHaveCount(0);
  expect(await prisma.espaceWork.count({ where: { studentId: { in: [terminale.dual.id, terminale.mathsOnly.id, terminale.nsiOnly.id, terminale.unassigned.id] } } })).toBe(before);
});

for (const level of ['tle-maths', 'tle-nsi'] as const) {
  test(`${level} mobile : rubriques pertinentes, retour aux thèmes et absence de débordement`, async ({ page, terminale }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, level === 'tle-maths' ? terminale.mathsOnly : terminale.nsiOnly);
    await page.goto(terminalePath(level));
    await expect(page.locator('#bilan-step option[value="1"]')).toBeDisabled();
    await expect(page.locator('#bilan-step option[value="2"]')).toBeDisabled();
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.locator('#bilan-step')).toHaveValue('3');
    await expect(page.getByRole('group', { name: getBilanSections(level)[0].questions[0].text, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Revoir les thèmes travaillés', exact: true }).click();
    const theme = bilanData.modules[level][0];
    await choose(page.getByRole('group', { name: theme.label, exact: true }).getByLabel('Oui, travaillé en séance', { exact: true }));
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.locator('#bilan-step')).toHaveValue('1');
    await expect(page.getByRole('group', { name: theme.skills[0].text, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continuer', exact: true }).click();
    await expect(page.locator('#bilan-step')).toHaveValue('2');
    await page.getByRole('group', { name: /Les essais choisis/ }).getByRole('checkbox').first().check();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByLabel('Mon premier essai et mon explication')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
    await waitSaved(page);
    await page.screenshot({ path: testInfo.outputPath(`${level}-mobile.png`), fullPage: true });
  });
}

test('retrait de l’inscription NSI : la copie déjà ouverte devient inaccessible, les mathématiques restent accessibles', async ({ page, terminale }) => {
  await login(page, terminale.dual);
  await page.goto(terminalePath('tle-nsi'));
  await page.getByLabel('Une autre notion ou une trace').fill('Trace NSI avant retrait de l’inscription.');
  await waitSaved(page);
  const work = await workOf(terminale.dual.id, 'tle-nsi');
  const deleted = await prisma.espaceEnrollment.deleteMany({ where: { userId: terminale.dual.id, subject: 'NSI' } });
  expect(deleted.count).toBe(1);
  expect(await prisma.espaceSession.findUniqueOrThrow({ where: { id: terminale.sessions['tle-nsi'] } })).toMatchObject({ status: 'PUBLISHED' });
  const read = await page.request.get(`/api/espace/works/${work.id}`);
  expect(read.status()).toBe(404);
  expect(await read.text()).not.toContain('Trace NSI avant retrait');
  const save = await page.request.put(`/api/espace/works/${work.id}`, { data: { baseRevision: work.revision, patch: { stepId: 'scope', step: { fields: { other: 'Modification refusée.' } } } } });
  expect(save.status()).toBe(404);
  const submission = await page.request.post(`/api/espace/works/${work.id}/submit`, { data: { baseRevision: work.revision } });
  expect(submission.status()).toBe(404);
  await page.reload();
  await expect(page.getByTestId('bilan-workbench')).toHaveCount(0);
  await page.goto(terminalePath('tle-maths'));
  await expect(page.getByTestId('bilan-workbench')).toBeVisible();
  await page.getByLabel('Une autre notion ou une trace').fill('Les mathématiques restent autorisées.');
  await waitSaved(page);
  const preserved = await prisma.espaceWork.findUniqueOrThrow({ where: { id: work.id } });
  expect(preserved.revision).toBe(work.revision);
  expect(preserved.content).toEqual(work.content);
});
