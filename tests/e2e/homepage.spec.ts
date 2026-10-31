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
