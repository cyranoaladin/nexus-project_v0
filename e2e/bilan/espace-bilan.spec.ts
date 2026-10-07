import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
const creds = JSON.parse(readFileSync(process.env.BILAN_TEST_CREDENTIALS!, 'utf8')) as Record<string,{username:string;secret:string}>;
async function login(page:Page,key:string){
 await page.goto('/espace/connexion');
 await page.getByTestId('input-username').fill(creds[key]!.username);
 await page.getByTestId('input-secret').fill(creds[key]!.secret);
 await page.getByTestId('btn-connexion').click();
 await page.waitForURL(/\/espace\/(eleve|enseignant)/);
}
async function saved(page:Page){await expect(page.getByTestId('save-indicator')).toHaveAttribute('data-state','saved',{timeout:20000});}
test('troisième : parcours, reprise, transmission et lecture seule',async({page})=>{
 await login(page,'third');
 await page.goto('/espace/bilan/3e');
 await expect(page.getByRole('heading',{name:'Mon bilan du premier mois'})).toBeVisible();
 await expect(page.locator('a[href*="chatgpt"]')).toHaveCount(0);
 await page.getByRole('group',{name:'Divisibilité, nombres premiers et division',exact:true}).getByLabel('Oui, travaillé en séance').check();
 await saved(page);
 await page.reload();
 await expect(page.getByRole('group',{name:'Divisibilité, nombres premiers et division',exact:true}).getByLabel('Oui, travaillé en séance')).toBeChecked();
 await page.screenshot({path:'test-results/bilan/third-desktop.png',fullPage:true});
 await page.getByLabel('Étape',{exact:false}).selectOption('1');
 await expect(page.getByRole('heading',{name:'Où j’en suis',exact:true})).toBeVisible();
 await expect(page.getByRole('group').filter({hasText:'Je vérifie le quotient'})).toBeVisible();
 await page.getByLabel('Étape',{exact:false}).selectOption('3');
 await page.getByRole('group').first().getByLabel('Je ne souhaite pas répondre').check();
 await saved(page);
 await page.getByLabel('Étape',{exact:false}).selectOption('7');
 await page.getByLabel('J’ai relu mes réponses').check();
 await saved(page);
 await page.getByRole('button',{name:'Transmettre mon bilan',exact:true}).click();
 await page.getByRole('button',{name:'Transmettre',exact:true}).click();
 await expect(page.getByText('Ton bilan a été transmis.',{exact:false})).toBeVisible();
 await page.reload();
 await expect(page.getByText('Ton bilan a été transmis.',{exact:false})).toBeVisible();
});
test('seconde : mobile et frontière de niveau',async({page})=>{
 await page.setViewportSize({width:390,height:844}); await login(page,'second');
 await page.goto('/espace/bilan/2nde');
 await expect(page.getByRole('heading',{name:'Mon bilan du premier mois'})).toBeVisible();
 await expect(page.getByRole('group',{name:'Racines carrées',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'test-results/bilan/second-mobile.png',fullPage:true});
 await page.goto('/espace/bilan/3e');
 await expect(page.getByTestId('bilan-workbench')).toHaveCount(0);
});
test('un élève sans affectation ne peut ouvrir aucun bilan',async({page})=>{
 await login(page,'unassigned');
 for(const level of ['3e','2nde']){
  await page.goto(`/espace/bilan/${level}`);
  await expect(page.getByTestId('bilan-workbench')).toHaveCount(0);
 }
});
test('enseignant : aperçu non enregistré et accès à la relecture',async({page})=>{
 await login(page,'teacher');
 await page.goto('/espace/enseignant/bilans?niveau=3e');
 await expect(page.getByText('Aperçu enseignant :',{exact:false})).toBeVisible();
 await page.screenshot({path:'test-results/bilan/teacher-preview.png',fullPage:true});
 const response=await page.request.get('/api/espace/teacher/overview?activity=maths-bilan-septembre-2026-3e');
 expect(response.ok()).toBe(true);
 const overview=await response.json();
 const workId=overview.rows.find((r:{workId?:string})=>r.workId)?.workId;
 expect(workId).toBeTruthy();
 await page.goto(`/espace/enseignant/corriger/${workId}`);
 await expect(page.getByText('Je ne souhaite pas répondre',{exact:false}).first()).toBeVisible();
 await page.goto(`/espace/enseignant/bilans/${workId}`);
 await expect(page.getByRole('heading',{name:'Bilan individuel du premier mois'})).toBeVisible();
 await expect(page.getByText('Projet de bilan :',{exact:false})).toBeVisible();
 for(const heading of await page.locator('#bilan-family-report h1, #bilan-family-report h2, #bilan-family-report h3').all()){
  await expect(heading).toHaveCSS('color','rgb(15, 23, 42)');
 }
 await page.emulateMedia({media:'print'});
 for(const heading of await page.locator('#bilan-family-report h1, #bilan-family-report h2, #bilan-family-report h3').all()){
  await expect(heading).toHaveCSS('color','rgb(15, 23, 42)');
 }
 await page.pdf({path:'test-results/bilan/rapport-famille.pdf',format:'A4',printBackground:true});
 await page.screenshot({path:'test-results/bilan/teacher-report.png',fullPage:true});
});
