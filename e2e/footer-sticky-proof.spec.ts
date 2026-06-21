import { test, expect } from '@playwright/test';

test('footer mobile 375px — newsletter button not occluded by sticky bar', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto('/', { waitUntil: 'networkidle' });

  // Scroll to bottom
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);

  // Screenshot viewport (not full-page) at bottom
  await page.screenshot({ path: 'e2e/screenshots/zones/footer-mobile-viewport-bottom.png' });

  // Get bounding rects
  const result = await page.evaluate(() => {
    // Find the newsletter submit button
    const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
    const newsletterBtn = buttons.find(b => b.textContent?.includes('Recevoir les conseils'));

    // Find the MobileStickyBar (fixed element at bottom)
    const allFixed = Array.from(document.querySelectorAll('*')).filter(el => {
      const style = window.getComputedStyle(el);
      return style.position === 'fixed' && parseInt(style.bottom || '999') < 50;
    });
    // Pick the largest fixed-bottom element (the sticky bar)
    const stickyBar = allFixed.sort((a, b) =>
      b.getBoundingClientRect().width - a.getBoundingClientRect().width
    )[0];

    if (!newsletterBtn || !stickyBar) {
      return {
        found: false,
        newsletterBtn: !!newsletterBtn,
        stickyBar: !!stickyBar,
      };
    }

    const btnRect = newsletterBtn.getBoundingClientRect();
    const barRect = stickyBar.getBoundingClientRect();

    // elementFromPoint at center of button
    const centerX = btnRect.left + btnRect.width / 2;
    const centerY = btnRect.top + btnRect.height / 2;
    const elementAtCenter = document.elementFromPoint(centerX, centerY);
    const btnAccessible = newsletterBtn.contains(elementAtCenter) || elementAtCenter === newsletterBtn;

    return {
      found: true,
      btnRect: { top: btnRect.top, bottom: btnRect.bottom, left: btnRect.left, right: btnRect.right },
      barRect: { top: barRect.top, bottom: barRect.bottom, left: barRect.left, right: barRect.right },
      btnBottomAboveBarTop: btnRect.bottom <= barRect.top,
      btnAccessible,
      elementAtCenterTag: elementAtCenter?.tagName,
      elementAtCenterText: elementAtCenter?.textContent?.slice(0, 50),
    };
  });

  console.log('Footer sticky proof result:', JSON.stringify(result, null, 2));

  expect(result.found, 'Both elements found').toBe(true);
  if (result.found) {
    // Either the button is above the bar OR the button is clickable through
    const cleared = result.btnBottomAboveBarTop || result.btnAccessible;
    expect(cleared, `Button must be accessible. btnBottom=${(result as any).btnRect?.bottom} barTop=${(result as any).barRect?.top} accessible=${result.btnAccessible}`).toBe(true);
  }

  await ctx.close();
});
