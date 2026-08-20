import { expect, test } from "@playwright/test";

test("business entry login flow", async ({ page }) => {
  await page.goto("/", { waitUntil: "networkidle" });

  const fab = page.getByRole("button", { name: "进入业务系统" });
  await expect(fab).toBeVisible();
  await expect(fab).toContainText("业务系统");

  await fab.click();

  const dialog = page.getByRole("dialog", { name: "业务系统登录" });
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("用户名").fill("admin");
  await dialog.getByLabel("密码").fill("wrong");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();

  await expect(dialog.getByRole("alert")).toContainText("用户名或密码错误");

  await dialog.getByLabel("密码").fill("ng-alain.com");
  await dialog.getByRole("button", { name: "登录", exact: true }).click();

  await page.waitForURL("**/app/dashboard");
  await expect(page.getByRole("heading", { name: "控制台" })).toBeVisible();

  const token = await page.evaluate(() =>
    localStorage.getItem("nuochong-business-token"),
  );
  expect(token).toBe("mock-token");

  await expect(
    page.locator(".bs-stat-card").filter({ hasText: "员工总数" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "用户与员工" }).click();
  await page.waitForURL("**/app/users");

  const table = page.locator(".bs-table");
  await expect(table).toBeVisible();
  await expect(table.locator("tbody tr")).toHaveCount(8);

  const search = page.getByPlaceholder("按姓名、邮箱或部门搜索");
  await search.fill("张伟");
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await search.fill("");

  await page.getByRole("button", { name: "新增员工" }).click();

  const editDialog = page.getByRole("dialog", { name: "新增员工" });
  await expect(editDialog).toBeVisible();

  await editDialog.getByLabel("姓名").fill("测试员工");
  await editDialog.getByLabel("邮箱").fill("test@nuochong.work");
  await editDialog.getByLabel("部门").fill("质量部");
  await editDialog.getByLabel("角色").fill("测试工程师");
  await editDialog.getByLabel("电话").fill("13900000000");
  await editDialog.getByLabel("状态").selectOption("active");
  await editDialog.getByRole("button", { name: "保存" }).click();

  await expect(
    table.locator("tbody tr").filter({ hasText: "测试员工" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /诺崇管理员/ }).click();
  await page.getByRole("menuitem", { name: "退出登录" }).click();

  await page.waitForURL("**/app/login");
  const tokenAfter = await page.evaluate(() =>
    localStorage.getItem("nuochong-business-token"),
  );
  expect(tokenAfter).toBeNull();
});

test("anonymous direct access to console redirects to login", async ({ page }) => {
  await page.goto("/app/dashboard");
  await page.waitForURL("**/app/login");
  await expect(page.locator(".bs-login-card")).toBeVisible();
});
