const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { chromium } = require("playwright");

const BASE_URL = "https://nexusreussite.academy";
const OUT_DIR = path.resolve(process.cwd(), "audit-captures-nexus-premium-final");
const WHATSAPP_NUMBER = "21699192829";

const pages = [
  { name: "homepage", path: "/" },
  { name: "catalogue", path: "/catalogue-nexus-reussite-2026-2027.html" },
  { name: "selecteur", path: "/nexus_selecteur.html" },
  { name: "mentions", path: "/mentions-legales.html" },
  { name: "confidentialite", path: "/confidentialite.html" },
];

const expectedHomepage = [
  "Offres & tarifs",
  "Trouver ma formule",
  "Préparer 2026/2027 dès maintenant",
  "Quel parcours pour votre enfant ?",
  "Repères tarifaires 2026/2027",
  "Forfaits courts et accompagnements ciblés",
  "Forfait Complet 16 h",
  "Ces forfaits répondent à des besoins ponctuels. Pour un parcours annuel complet, consultez les offres 2026/2027.",
  "Les stages sont positionnés sur les grandes périodes du calendrier scolaire : prérentrée, Toussaint, hiver/février, printemps et sprint final.",
  "Une équipe d’enseignants certifiés et agrégés",
  "Les progressions mentionnées correspondent à des parcours individuels et ne constituent pas une garantie de résultat.",
];

const expectedByPage = {
  catalogue: [
    "Enseignants certifiés et agrégés de l’enseignement français à l’étranger",
    "des places disponibles",
    "Une fois un groupe complet",
    "Stages positionnés sur les périodes de vacances scolaires selon le calendrier de l’établissement.",
    "Toussaint, hiver/février, printemps selon calendrier AEFE rythme nord.",
    "Calendrier adapté au statut candidat libre et aux échéances d’examen.",
  ],
  selecteur: [
    "Enseignants certifiés et agrégés de l’enseignement français à l’étranger",
    "des places disponibles",
    "Une fois un groupe complet",
    "Périodes de stages selon calendrier",
    "prérentrée, Toussaint, hiver/février, printemps et sprint final",
    "dates précises communiquées avec la recommandation",
  ],
};

const forbidden = [
  "100 % réussite",
  "réussite garantie",
  "à confirmer par la direction",
  "a confirmer par la direction",
  "indicatif dans le détail",
  "les 2 h",
  "Forfait Excellence",
  "date limite",
  "période de réservation prioritaire",
];

function urlFor(pagePath) {
  const sep = pagePath.includes("?") ? "&" : "?";
  return `${BASE_URL}${pagePath}${sep}audit=${Date.now()}`;
}

function md5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

async function goto(page, pagePath) {
  await page.goto(urlFor(pagePath), { waitUntil: "networkidle", timeout: 45000 });
}

async function screenshot(locator, fileName) {
  await locator.scrollIntoViewIfNeeded();
  await locator.screenshot({ path: path.join(OUT_DIR, fileName), animations: "disabled" });
}

async function captureHomepage(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto(page, "/");
  await screenshot(page.locator(".hero").first(), "homepage-hero-desktop.png");
  await screenshot(page.locator("#preparer-2026-2027"), "homepage-preparer-2026-2027.png");
  await screenshot(page.locator("#parcours-enfant"), "homepage-parcours-enfant.png");
  await screenshot(page.locator("#reperes-tarifaires"), "homepage-reperes-tarifaires.png");
  await screenshot(page.locator("#offres"), "homepage-forfaits-courts.png");
  await screenshot(page.locator("#comparaison"), "homepage-temoignages-prudence.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, "/");
  await page.locator(".hero").first().screenshot({
    path: path.join(OUT_DIR, "homepage-hero-mobile.png"),
    animations: "disabled",
  });
}

async function captureCatalogue(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto(page, "/catalogue-nexus-reussite-2026-2027.html");
  await screenshot(page.locator(".hero").first(), "catalogue-hero-desktop.png");
  await screenshot(page.locator(".recommendation-band"), "catalogue-recommandation.png");
  await screenshot(page.locator("#candidats-libres"), "catalogue-candidats-libres.png");
  await screenshot(page.locator("#scolarises"), "catalogue-scolarises.png");
  await screenshot(
    page.locator("article.offer.featured").filter({ hasText: "Première Libre Accompagnée" }).first(),
    "catalogue-carte-recommandee.png",
  );
  await page.locator("article.offer.featured").filter({ hasText: "Première Libre Accompagnée" }).first().locator("details").evaluate((details) => {
    details.open = true;
  });
  await screenshot(
    page.locator("article.offer.featured").filter({ hasText: "Première Libre Accompagnée" }).first(),
    "catalogue-accordeon-ouvert.png",
  );
  await screenshot(page.locator("#plateforme"), "catalogue-plateforme.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, "/catalogue-nexus-reussite-2026-2027.html");
  await page.locator(".hero").first().screenshot({
    path: path.join(OUT_DIR, "catalogue-hero-mobile.png"),
    animations: "disabled",
  });
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.waitForTimeout(700);
  await page.screenshot({
    path: path.join(OUT_DIR, "catalogue-sticky-cta-mobile.png"),
    animations: "disabled",
  });
}

async function choose(page, name) {
  await page.getByRole("button", { name }).click();
  await page.waitForTimeout(250);
}

async function captureSelecteur(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto(page, "/nexus_selecteur.html");
  await screenshot(page.locator(".wrap").first(), "selecteur-initial.png");
  await choose(page, /Élève scolarisé/);
  await choose(page, "Terminale");
  await screenshot(page.locator(".wrap").first(), "selecteur-etape-intermediaire.png");
  await choose(page, /Duo Terminale Nexus/);
  await choose(page, /Maths \+ Physique/);
  await screenshot(page.locator("#result"), "selecteur-resultat-final.png");
  await screenshot(page.locator(".result-actions"), "selecteur-cta-whatsapp.png");

  await page.setViewportSize({ width: 390, height: 844 });
  await goto(page, "/nexus_selecteur.html");
  await choose(page, /Élève scolarisé/);
  await choose(page, "Terminale");
  await choose(page, /Duo Terminale Nexus/);
  await choose(page, /Maths \+ Physique/);
  await page.locator("#result").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: path.join(OUT_DIR, "selecteur-resultat-mobile.png"),
    animations: "disabled",
  });
}

async function runControls(browser) {
  const page = await browser.newPage();
  const control = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    http200: {},
    homepageExpectedText: {},
    forbiddenTextAbsent: {},
    whatsappNumberOk: {},
    expectedText: {},
    noHorizontalOverflow: {},
    navigation: {},
    md5: {},
  };

  for (const entry of pages) {
    const response = await page.request.get(`${BASE_URL}${entry.path}`, {
      headers: { "Cache-Control": "no-cache" },
      timeout: 45000,
    });
    control.http200[entry.name] = response.status() === 200;
    const body = await response.body();
    control.md5[entry.name] = md5(body);
    const html = body.toString("utf8");
    control.forbiddenTextAbsent[entry.name] = forbidden.every((needle) => !html.toLowerCase().includes(needle.toLowerCase()));
    const hrefs = [...html.matchAll(/href="([^"]*wa\.me[^"]*)"/g)].map((match) => match[1]);
    control.whatsappNumberOk[entry.name] = hrefs.every((href) => href.includes(WHATSAPP_NUMBER));
  }

  await goto(page, "/");
  const homepageText = await page.locator("body").innerText();
  for (const text of expectedHomepage) {
    control.homepageExpectedText[text] = homepageText.includes(text);
  }

  for (const [pageName, strings] of Object.entries(expectedByPage)) {
    const entry = pages.find((item) => item.name === pageName);
    await goto(page, entry.path);
    if (pageName === "selecteur") {
      await choose(page, /Élève scolarisé/);
      await choose(page, "Terminale");
      await choose(page, /Duo Terminale Nexus/);
      await choose(page, /Maths \+ Physique/);
    }
    const text = await page.locator(pageName === "selecteur" ? "#result" : "body").innerText();
    control.expectedText[pageName] = {};
    for (const expected of strings) {
      control.expectedText[pageName][expected] = text.includes(expected);
    }
  }

  for (const viewport of [
    { key: "desktop", width: 1440, height: 1000 },
    { key: "mobile", width: 390, height: 844 },
  ]) {
    for (const entry of pages.slice(0, 3)) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await goto(page, entry.path);
      control.noHorizontalOverflow[`${entry.name}-${viewport.key}`] = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    }
  }

  await page.setViewportSize({ width: 1440, height: 1000 });
  await goto(page, "/");
  await page.getByRole("link", { name: /Trouver ma formule/ }).first().click();
  await page.waitForURL("**/nexus_selecteur.html**");
  control.navigation["homepage-selecteur"] = page.url().includes("/nexus_selecteur.html");
  await page.getByRole("button", { name: /Élève scolarisé/ }).click();
  await page.getByRole("button", { name: "Terminale" }).click();
  await page.getByRole("button", { name: /Duo Terminale Nexus/ }).click();
  await page.getByRole("button", { name: /Maths \+ Physique/ }).click();
  control.navigation["selecteur-whatsapp-cta-visible"] = await page.locator("#result").getByRole("link", { name: /Recevoir cette recommandation sur WhatsApp/ }).isVisible();
  await page.locator("#result").getByRole("link", { name: /Voir toutes les offres/ }).click();
  await page.waitForURL("**/catalogue-nexus-reussite-2026-2027.html**");
  control.navigation["selecteur-catalogue"] = page.url().includes("/catalogue-nexus-reussite-2026-2027.html");
  await goto(page, "/nexus_selecteur.html");
  await page.locator("#result").getByRole("link", { name: /Retour à l’accueil/ }).click().catch(async () => {
    await page.getByRole("button", { name: /Élève scolarisé/ }).click();
    await page.getByRole("button", { name: "Terminale" }).click();
    await page.getByRole("button", { name: /Duo Terminale Nexus/ }).click();
    await page.getByRole("button", { name: /Maths \+ Physique/ }).click();
    await page.locator("#result").getByRole("link", { name: /Retour à l’accueil/ }).click();
  });
  await page.waitForURL(`${BASE_URL}/**`);
  control.navigation["selecteur-accueil"] = page.url() === `${BASE_URL}/`;
  await goto(page, "/");
  const homepageCatalogueHref = await page.locator('a[href*="catalogue-nexus-reussite-2026-2027.html"]').first().getAttribute("href");
  control.navigation["homepage-catalogue-link-present"] = Boolean(homepageCatalogueHref);
  await page.goto(new URL(homepageCatalogueHref, BASE_URL).toString(), { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForURL("**/catalogue-nexus-reussite-2026-2027.html**");
  control.navigation["homepage-catalogue"] = page.url().includes("/catalogue-nexus-reussite-2026-2027.html");
  control.navigation["catalogue-whatsapp-cta-visible"] = await page.getByRole("link", { name: /Recevoir l’échéancier|Recevoir la recommandation/ }).first().isVisible();
  control.navigation["catalogue-selecteur"] = await page.getByRole("link", { name: /Trouver ma formule/ }).first().evaluate((link) => link.getAttribute("href") || "").then((href) => href.includes("nexus_selecteur.html"));

  await page.close();
  return control;
}

(async () => {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await captureHomepage(page);
  await captureCatalogue(page);
  await captureSelecteur(page);
  await page.close();

  const control = await runControls(browser);
  fs.writeFileSync(path.join(OUT_DIR, "controle-production.json"), JSON.stringify(control, null, 2));
  await browser.close();

  const files = fs.readdirSync(OUT_DIR).sort();
  console.log(`Captures and control written to ${OUT_DIR}`);
  for (const file of files) console.log(file);
})();
