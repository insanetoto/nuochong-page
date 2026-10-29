import { expect, test } from "@playwright/test";

for (const [size, viewport] of Object.entries({
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
})) {
  for (const lang of ["en", "zh"] as const) {
    test(`${size} ${lang} content, assets, SEO and visual baseline`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const failures: string[] = [];
      page.on("pageerror", (error) => failures.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`);
      });
      await page.goto(`/?lang=${lang}`, { waitUntil: "networkidle" });
      await expect(page.locator("main")).toHaveAttribute("data-language", lang);
      await page.evaluate(async () => {
        await document.fonts.ready;
        await Promise.all(Array.from(document.images, (img) => img.decode()));
      });
      expect(await page.locator("img").evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0))).toBe(true);
      expect(await page.locator("body").evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      const manifest = await page.evaluate(() => ({
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content"),
        favicon: document.querySelector('link[rel="icon"]')?.getAttribute("href"),
        language: document.documentElement.lang,
        text: document.querySelector("main")?.textContent?.replace(/\s+/g, " ").trim(),
        sections: Array.from(document.querySelectorAll("section[id]"), (s) => s.id),
        links: Array.from(document.querySelectorAll("a"), (a) => ({ text: a.textContent?.trim(), href: a.getAttribute("href") })),
        images: Array.from(document.images, (i) => ({ src: i.getAttribute("src"), alt: i.alt })),
      }));
      expect(JSON.stringify(manifest, null, 2)).toMatchSnapshot(`${size}-${lang}-content.json`);
      await expect(page).toHaveScreenshot(`${size}-${lang}.png`, { fullPage: true, animations: "disabled", maxDiffPixels: 0 });
      const brokenAnchors = await page.locator('a[href^="#"]').evaluateAll((anchors) => anchors
        .map((a) => a.getAttribute("href")!)
        .filter((href) => href.length > 1 && !document.getElementById(href.slice(1))));
      expect(brokenAnchors).toEqual([]);
      await expect(page.locator('a[href="https://beian.miit.gov.cn/"]')).toHaveText("滇ICP备2026017420号");
      await expect(page.locator('a[href^="mailto:marketing@nuochong.work"]').first()).toBeVisible();
      await expect(page.locator("main")).toContainText("0871-67200971");
      await page.locator('.hero-actions a[href="#apply"]').click();
      await expect(page).toHaveURL(/#apply$/);
      expect(failures).toEqual([]);
    });
  }
}

test("query > saved preference > browser language; switching persists", async ({ browser }) => {
  const context = await browser.newContext({ locale: "zh-CN" });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator("main")).toHaveAttribute("data-language", "zh");
  await page.getByRole("button", { name: "EN", exact: true }).click();
  await page.reload();
  await expect(page.locator("main")).toHaveAttribute("data-language", "en");
  expect(await page.evaluate(() => localStorage.getItem("nuochong-language"))).toBe("en");
  await page.goto("/?lang=zh");
  await expect(page.locator("main")).toHaveAttribute("data-language", "zh");
  await page.getByRole("button", { name: "中文", exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem("nuochong-language"))).toBe("zh");
  await page.goto("/?lang=en");
  await expect(page.locator("main")).toHaveAttribute("data-language", "en");
  await context.close();
});
