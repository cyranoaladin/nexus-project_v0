import { test, expect, login } from './fixtures';

test('JavaScript retardé : aucune connexion native ni secret dans une URL',async({page,cohort})=>{
  const unsafeUrls:string[]=[];
  page.on('request',request=>{
    const url=new URL(request.url());
    if(['secret','username','credential-current','credential-next'].some(key=>url.searchParams.has(key))) unsafeUrls.push(url.pathname);
  });
  let releaseScripts!:()=>void;
  const scriptsReady=new Promise<void>(resolve=>{releaseScripts=resolve;});
  await page.route('**/*',async route=>{
    if(route.request().resourceType()==='script') await scriptsReady;
    await route.continue();
  });
  try {
    // Hold the downloads rather than aborting them: WebKit retains failed preload entries across navigations.
    await page.goto('/espace/connexion',{waitUntil:'commit'});
    await expect(page.locator('form')).toHaveAttribute('method','post');
    await expect(page.getByTestId('btn-connexion')).toBeDisabled();
    await expect(page.getByTestId('input-username')).toBeDisabled();
    await expect(page.getByTestId('input-secret')).toBeDisabled();
    await expect(page).toHaveURL(/\/espace\/connexion$/);
    expect(unsafeUrls).toEqual([]);
    releaseScripts();
    await expect(page.getByTestId('input-username')).toBeEnabled();
    await page.getByTestId('input-username').fill(cohort.third.username);
    await page.getByTestId('input-secret').fill(cohort.third.secret);
    await page.getByTestId('btn-connexion').click();
    await page.waitForURL(/\/espace\/eleve(?:\/|\?|$)/);
    expect(unsafeUrls).toEqual([]);
  }finally{releaseScripts();await page.unroute('**/*');}
});

test('sans JavaScript : changement du code et mot de passe désactivé, méthode POST',async({browser,cohort})=>{
  for(const account of [cohort.third,cohort.teacher]) {
    const normal=await browser.newContext();const page=await normal.newPage();
    try {
      await login(page,account);
      const noJs=await browser.newContext({javaScriptEnabled:false,storageState:await normal.storageState()});
      try {
        const disabled=await noJs.newPage();
        await disabled.goto(account===cohort.teacher?'/espace/enseignant/compte':'/espace/eleve/compte');
        await expect(disabled.getByTestId('btn-credential')).toBeDisabled();
        await expect(disabled.locator('form')).toHaveAttribute('method','post');
        await expect(disabled.getByTestId('input-current')).toBeDisabled();
        await expect(disabled.getByTestId('input-next')).toBeDisabled();
        await expect(disabled.getByTestId('input-confirm')).toBeDisabled();
        expect(new URL(disabled.url()).search).toBe('');
      }finally{await noJs.close();}
    }finally{await normal.close();}
  }
});
