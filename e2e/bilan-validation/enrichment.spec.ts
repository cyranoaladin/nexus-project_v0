import type { Browser, Page, TestInfo } from '@playwright/test';
import { test as schoolTest, expect, login, goStep, goSkill, waitSaved, type Account } from './fixtures';
import { test as terminaleTest } from './terminale-fixtures';
import { bilanData, getBilanLesson, getBilanSections, type BilanLevel } from '../../lib/espace/bilan-data';
import { BILAN_PROFILES } from '../../lib/espace/bilan-profiles';
import { prisma } from '../../lib/prisma';

/** Only synthetic accounts created by local-only fixtures are used here. */
async function enrichedJourney(page: Page, browser: Browser, level: BilanLevel, student: Account, teacherAccount: Account, info: TestInfo) {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, student);
  await page.goto(`/espace/bilan/${level}`);
  const lesson = getBilanLesson(level);
  const sections = getBilanSections(level);
  const section = (id: string) => sections.find(s => s.id === id)!;
  await expect(page.locator('#bilan-step option')).toHaveCount(lesson.steps.length);

  // The new school tasks really exercise added curricula, not an old task renamed.
  const taskId = level === '3e' ? '3-pdf-thales' : level === '2nde' ? '2-pdf-L1' : level === 'tle-maths' ? 'tm-sum-task' : 'tn-essai-alias';
  const task = bilanData.tasks.find(t => t.id === taskId)!;
  const requiredModules = bilanData.modules[level].filter(m => m.id === task.module || m.skills.some(s => task.skills.includes(s.id)));
  for(const module of requiredModules) await page.getByRole('group', { name: module.label, exact: true }).getByLabel('Oui, travaillé en séance', { exact: true }).check();
  const skill = requiredModules.flatMap(m => m.skills).find(s => task.skills.includes(s.id))!;
  await goSkill(page, skill.id);
  await page.getByRole('group', { name: skill.text, exact: true }).getByLabel(bilanData.mastery.difficulty, { exact: true }).check();
  await waitSaved(page);
  await page.reload();
  await expect(page.getByRole('group', { name: skill.text, exact: true }).getByLabel(bilanData.mastery.difficulty, { exact: true })).toBeChecked();

  await goStep(page, 'journey');
  const journeyQuestion = section('journey').questions.find(q => q.type === 'text')!;
  const journeyAnswer = `Repère fictif ${level} : septembre, classe de test.`;
  await page.getByRole('textbox', { name: journeyQuestion.text }).fill(journeyAnswer);
  await goStep(page, 'habits');
  const frequency = section('habits').questions.find(q => q.type === 'scale')!;
  const frequencyAnswer = frequency.options!.find(o => o === 'Souvent')!;
  await page.getByRole('combobox', { name: frequency.text, exact: true }).selectOption({ label: frequencyAnswer });
  await waitSaved(page);
  await page.reload();
  await expect(page.getByRole('combobox', { name: frequency.text, exact: true })).toHaveValue(frequencyAnswer);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  await goStep(page, 'next');
  const priority = section('next').questions.find(q => q.priorityOf)!;
  const needs = section('next').questions.find(q => q.id === priority.priorityOf)!;
  const choices = needs.options!.filter(o => o !== 'Je ne souhaite pas répondre');
  const needsGroup = page.getByRole('group', { name: needs.text, exact: true });
  const priorityInput = page.getByRole('combobox', { name: priority.text, exact: true });
  for(const value of choices.slice(0, 3)) await needsGroup.getByLabel(value, { exact: true }).check();
  await needsGroup.getByLabel(choices[3], { exact: true }).click();
  await expect(needsGroup.getByLabel(choices[3], { exact: true })).not.toBeChecked();
  await expect(needsGroup.locator('input:checked')).toHaveCount(3);
  await priorityInput.selectOption({ label: choices[0] });
  await needsGroup.getByLabel(choices[0], { exact: true }).uncheck();
  await expect(priorityInput).toHaveValue('');
  await expect(priorityInput.locator('option').filter({ hasText: choices[0] })).toHaveCount(0);
  await priorityInput.selectOption({ label: choices[1] });
  await waitSaved(page);
  await page.reload();
  await expect(priorityInput).toHaveValue(choices[1]);
  await needsGroup.getByLabel('Je ne souhaite pas répondre', { exact: true }).check();
  await expect(needsGroup.locator('input:checked')).toHaveCount(1);
  await expect(priorityInput).toHaveValue('');
  await needsGroup.getByLabel(choices[1], { exact: true }).check();
  await priorityInput.selectOption({ label: choices[1] });

  await goStep(page, 'family');
  const familyQuestion = section('family').questions.find(q => q.type === 'text')!;
  const familyAnswer = `Message familial ${level} : mes essais montrent mes démarches et les aides reçues.`;
  await page.getByRole('textbox', { name: familyQuestion.text }).fill(familyAnswer);
  await goStep(page, 'trial-reflection');
  const before = section('trial-reflection').questions[0];
  if(before.type === 'scale') await page.getByRole('combobox', { name: before.text, exact: true }).selectOption({ label: before.options![0] });
  else await page.getByRole('group', { name: before.text, exact: true }).getByLabel(before.options![0], { exact: true }).check();

  await goStep(page, 'evidence');
  await page.getByRole('group', { name: /Les essais choisis/ }).getByRole('checkbox', { name: task.title, exact: true }).check();
  if(level === '3e') for(const measure of ['AM = 3 cm', 'AB = 6 cm', 'AN = 4 cm', 'BC = 10 cm']) await expect(page.getByRole('article')).toContainText(measure);
  const answer = `Essai enrichi ${level} : ma recherche personnelle reste visible, même incomplète.`;
  await page.getByLabel('Mon premier essai et mon explication').fill(answer);
  await page.getByRole('combobox', { name: 'Aide utilisée', exact: true }).selectOption({ label: 'Un indice' });
  await page.getByRole('combobox', { name: 'Conditions de mon essai (facultatif)', exact: true }).selectOption({ label: 'Avec les outils autorisés par l’énoncé' });
  await page.getByRole('combobox', { name: 'Ma confiance après cet essai (facultatif)', exact: true }).selectOption({ label: 'Moyenne' });
  await waitSaved(page);
  await page.reload();
  await expect(page.getByLabel('Mon premier essai et mon explication')).toHaveValue(answer);
  await expect(page.getByRole('combobox', { name: 'Ma confiance après cet essai (facultatif)', exact: true })).toHaveValue('Moyenne');
  await expect(page.getByRole('combobox', { name: 'Conditions de mon essai (facultatif)', exact: true })).toHaveValue('Avec les outils autorisés par l’énoncé');
  await goStep(page, 'trial-reflection');
  const after = section('trial-reflection').questions.find(q => q.type === 'text')!;
  await page.getByRole('textbox', { name: after.text }).fill(`Après l’essai ${level} : je précise la compétence sans effacer mon premier avis.`);
  await goSkill(page, skill.id);
  await expect(page.getByRole('group', { name: skill.text, exact: true }).getByLabel(bilanData.mastery.difficulty, { exact: true })).toBeChecked();
  await goStep(page, 'review');
  await page.getByLabel('J’ai relu mes réponses').check();
  await waitSaved(page);
  await page.getByRole('button', { name: 'Transmettre mon bilan', exact: true }).click();
  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();
  await expect(page.getByText('Ton bilan a été transmis.', { exact: false })).toBeVisible();

  const work = await prisma.espaceWork.findFirstOrThrow({ where: { studentId: student.id, activity: { slug: BILAN_PROFILES[level].slug } } });
  const context = await browser.newContext();
  try {
    const teacher = await context.newPage();
    await login(teacher, teacherAccount);
    await teacher.goto(`/espace/enseignant/corriger/${work.id}`);
    await expect(teacher.getByText(familyAnswer, { exact: true })).toBeVisible();
    const feedback = `Retour personnalisé ${level} : nous choisirons une reprise précise avec la famille.`;
    await teacher.getByLabel('Commentaire', { exact: true }).fill(feedback);
    await teacher.getByRole('button', { name: 'Corrigé', exact: true }).click();
    await expect(teacher.getByText('Travail marqué corrigé : l’élève voit vos retours.', { exact: true })).toBeVisible();
    const response = await teacher.request.get(`/api/espace/teacher/export?workId=${work.id}`);
    expect(response.status()).toBe(200);
    const exported = await response.json();
    const content = exported.works[0].content.steps;
    expect(content.journey.fields[journeyQuestion.id]).toBe(journeyAnswer);
    expect(content.habits.fields[frequency.id]).toBe(frequencyAnswer);
    expect(content.family.fields[familyQuestion.id]).toBe(familyAnswer);
    expect(content.next.fields[priority.id]).toBe(choices[1]);
    expect(JSON.parse(content.evidence.fields[task.id])).toMatchObject({ answer, confidence: 'Moyenne', conditions: 'Avec les outils autorisés par l’énoncé' });
    expect(JSON.stringify(exported)).not.toContain(student.secret);
    await teacher.goto(`/espace/enseignant/bilans/${work.id}`);
    const report = teacher.locator('#bilan-family-report');
    await expect(report).toContainText(familyAnswer);
    await expect(report).toContainText(answer);
    await expect(report).toContainText(feedback);
    await expect(report).toContainText('Moyenne');
    await expect(report).toContainText('Avec les outils autorisés par l’énoncé');
    await page.reload();
    await expect(page.getByText(feedback, { exact: true })).toBeVisible();
    await goStep(page, 'family');
    await expect(page.getByRole('textbox', { name: familyQuestion.text })).toBeDisabled();
    await expect(page.getByRole('textbox', { name: familyQuestion.text })).toHaveValue(familyAnswer);
    await page.screenshot({ path: info.outputPath(`${level}-enriched-readonly-mobile.png`), fullPage: true });
  } finally { await context.close(); }
}

for(const level of ['3e', '2nde'] as const) {
  schoolTest(`${level} : nouveaux contenus PDF, habitudes, aides prioritaires, famille et restitution`, async ({ page, browser, cohort }, info) => {
    await enrichedJourney(page, browser, level, level === '3e' ? cohort.third : cohort.second, cohort.teacher, info);
  });
}
for(const level of ['tle-maths', 'tle-nsi'] as const) {
  terminaleTest(`${level} : bilan enrichi adapté à la matière et réponses récupérables`, async ({ page, browser, terminale }, info) => {
    await enrichedJourney(page, browser, level, terminale.dual, level === 'tle-maths' ? terminale.mathsTeacher : terminale.nsiTeacher, info);
  });
}
