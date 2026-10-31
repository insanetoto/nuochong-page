import { expect, test } from "@playwright/test";

test("website remains bilingual without a business-system entry", async ({ page }) => {
  await page.goto("/?lang=en", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toHaveAttribute("data-language", "en");
  await expect(page.getByRole("button", { name: "进入业务系统" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Request Access", exact: true }).first()).toBeVisible();
  await page.goto("/?lang=zh", { waitUntil: "networkidle" });
  await expect(page.locator("main")).toHaveAttribute("data-language", "zh");
  await expect(page.getByRole("button", { name: "进入业务系统" })).toHaveCount(0);
});

test("retired business pages stay unavailable even with a previous demo token", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nuochong-business-token", "mock-token"));
  for (const path of ["/app", "/app/login", "/app/dashboard", "/app/users", "/app/training", "/app/notifications", "/app/workorders", "/app/help", "/app/users/profile", "/app/users/security"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.locator(".bs-login-card, .bs-table, .bs-stat-card")).toHaveCount(0);
  }
});

test.describe("homepage navigation and OA links", () => {
  test.use({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test(`navigation moves down in display order at ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto("/?lang=zh", { waitUntil: "networkidle" });
      const nav = page.getByRole("navigation", { name: "主要导航" });
      const targets = [["主页", "top"], ["产品能力", "product"], ["核心价值", "value"], ["应用场景", "scenes"], ["关于我们", "about"]] as const;
      let previous = -1;
      let previousScroll = -1;
      for (const [name, id] of targets) {
        await nav.getByRole("link", { name, exact: true }).click();
        await expect(page).toHaveURL(new RegExp(`#${id}$`));
        const top = await page.locator(`#${id}`).evaluate(element => element.getBoundingClientRect().top + window.scrollY);
        expect(top).toBeGreaterThan(previous); previous = top;
        await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(previousScroll);
        previousScroll = await page.evaluate(() => window.scrollY);
        if (id !== "top") {
          await expect.poll(async () => page.locator(`#${id}`).evaluate(element => element.getBoundingClientRect().top)).toBeGreaterThanOrEqual(60);
        }
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    });
  }
  test("all product footer links open the OA login page", async ({ page }) => {
    for (const lang of ["zh", "en"]) {
      const names = lang === "zh" ? ["企业知识库", "培训与考试", "企业 AI 助手"] : ["Enterprise Knowledge Base", "Training & Assessments", "Enterprise AI Assistant"];
      for (const name of names) {
        await page.goto(`/?lang=${lang}`, { waitUntil: "networkidle" });
        const link = page.locator("footer").getByRole("link", { name, exact: true });
        await expect(link).toHaveAttribute("href", "/oa-login.html");
        await link.click();
        await expect(page).toHaveURL(/\/oa-login\.html$/);
        await expect(page.getByRole("heading", { name: "登录 OA 管理员页面" })).toBeVisible();
      }
    }
  });
});


test("OA login validates a private launch link and forwards only to the native endpoint", async ({ page }) => {
  await page.goto("/oa-login.html");
  const input = page.getByLabel("启动链接或凭据");
  await input.fill("https://example.com/oa-test/?token=synthetic_token_123456789012345");
  await page.getByRole("button", { name: "登录 OA" }).click();
  await expect(page.getByRole("alert")).toContainText("有效");
  await expect(page).toHaveURL(/\/oa-login\.html$/);
  await page.route("https://www.nuochong.net/oa-test/**", route => route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Synthetic native OA</h1>" }));
  await input.fill("https://www.nuochong.net/oa-test/?token=synthetic_token_123456789012345");
  await page.getByRole("button", { name: "登录 OA" }).click();
  await expect(page).toHaveURL("https://www.nuochong.net/oa-test/?token=synthetic_token_123456789012345");
  await expect(page.getByRole("heading", { name: "Synthetic native OA" })).toBeVisible();
});
