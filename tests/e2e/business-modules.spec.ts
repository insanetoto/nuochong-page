import { expect, test, type Page } from "@playwright/test";

async function seedAuth(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("nuochong-business-token", "mock-token");
    localStorage.setItem(
      "nuochong-business-user",
      JSON.stringify({ name: "诺崇管理员", email: "admin@nuochong.work" }),
    );
  });
}

test.beforeEach(async ({ page }) => {
  await seedAuth(page);
});

test("notification center lists and opens detail", async ({ page }) => {
  await page.goto("/app/notifications/inner/all");

  await expect(page.getByRole("heading", { name: "通知中心" })).toBeVisible();

  const table = page.locator(".bs-table");
  await expect(table.locator("tbody tr")).toHaveCount(5);

  await table.locator("tbody tr").first().locator("a.bs-table-link").click();
  await page.waitForURL("**/app/notifications/detail/**");

  await expect(page.getByRole("heading", { name: "通知详情" })).toBeVisible();
});

test("notification receive and voice settings render", async ({ page }) => {
  await page.goto("/app/notifications/subscribe");
  await expect(page.getByRole("heading", { name: "接收管理" })).toBeVisible();
  await expect(page.getByText("邮件通知")).toBeVisible();

  await page.goto("/app/notifications/tts");
  await expect(page.getByRole("heading", { name: "语音管理" })).toBeVisible();
  await expect(page.getByText("朗读语速")).toBeVisible();
});

test("help center searches and opens an article", async ({ page }) => {
  await page.goto("/app/help");

  await expect(page.getByRole("heading", { name: "帮助中心" })).toBeVisible();
  await page.getByPlaceholder("搜索帮助文章…").fill("登录");

  await page.getByRole("link", { name: "如何登录业务系统" }).click();
  await page.waitForURL("**/app/help/a1");

  await expect(
    page.getByRole("heading", { name: "如何登录业务系统" }),
  ).toBeVisible();
});

test("training list opens the edit dialog", async ({ page }) => {
  await page.goto("/app/training");

  await expect(page.getByRole("heading", { name: "培训与知识库" })).toBeVisible();

  const table = page.locator(".bs-table");
  await expect(table.locator("tbody tr")).toHaveCount(5);

  await table
    .locator("tbody tr")
    .first()
    .getByRole("button", { name: "编辑" })
    .click();

  await expect(page.getByRole("dialog", { name: "编辑课程" })).toBeVisible();
  await page.getByRole("button", { name: "取消" }).click();
});

test("work orders filter by status and open detail", async ({ page }) => {
  await page.goto("/app/workorders");

  await expect(page.getByRole("heading", { name: "工单管理" })).toBeVisible();

  const table = page.locator(".bs-table");
  await expect(table.locator("tbody tr")).toHaveCount(5);

  await page.getByRole("tab", { name: "待处理" }).click();
  await expect(table.locator("tbody tr")).toHaveCount(2);

  await table.locator("tbody tr").first().locator("a.bs-table-link").click();
  await page.waitForURL("**/app/workorders/WO-**");

  await expect(page.getByRole("heading", { name: "工单详情" })).toBeVisible();
});

test("user profile and security forms render", async ({ page }) => {
  await page.goto("/app/users/profile");
  await expect(page.getByRole("heading", { name: "基本资料" })).toBeVisible();
  await expect(page.getByLabel(/姓名/)).toBeVisible();

  await page.goto("/app/users/security");
  await expect(page.getByRole("heading", { name: "安全设置" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "密码" })).toBeVisible();
});
