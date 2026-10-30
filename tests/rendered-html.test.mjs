import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(new URL(path, "http://localhost"), { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the English homepage by default", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Nuochong Technology/);
  assert.match(html, /Enterprise Knowledge &amp; Intelligent Training Platform/);
  assert.match(html, /Request Access/);
  assert.match(html, /Enterprise Knowledge Base/);
  assert.match(html, /Yunnan Nuochong Technology Co\., Ltd\./);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
  assert.doesNotMatch(html, /进入业务系统|bs-entry-fab|mock-token/);
});

test("retired business routes return 404 instead of restoring demo login or employee pages", async () => {
    for (const path of ["/app", "/app/login", "/app/dashboard", "/app/users", "/app/training", "/app/notifications", "/app/workorders", "/app/help", "/app/users/profile", "/app/users/security"]) {
    const response = await render(path);
    assert.equal(response.status, 404, path);
    assert.doesNotMatch(await response.text(), /ng-alain\.com|mock-token|员工账号/);
  }
});

test("OA entry is explicit when unavailable and only redirects to a configured token-free origin", async () => {
  const previous = process.env.NUOCHONG_OA_URL;
  try {
    delete process.env.NUOCHONG_OA_URL;
    assert.equal((await render("/oa")).status, 503);
    process.env.NUOCHONG_OA_URL = "http://127.0.0.1:3080/";
    const response = await render("/oa?token=untrusted&return_to=https://attacker.invalid");
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("location"), "http://127.0.0.1:3080/");
    for (const value of ["http://remote.invalid/", "https://oa.example/?token=private", "https://user:password@oa.example/"]) {
      process.env.NUOCHONG_OA_URL = value;
      assert.equal((await render("/oa")).status, 503);
    }
  } finally {
    if (previous === undefined) delete process.env.NUOCHONG_OA_URL;
    else process.env.NUOCHONG_OA_URL = previous;
  }
});

test("supports English and Chinese with the current Material brand assets", async () => {
  const [page, homePage, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/HomePage.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(homePage, /\/logo-mark\.svg/);
  assert.match(homePage, /nuochong-language/);
  assert.match(homePage, /企业知识与智能培训平台/);
  assert.match(homePage, /Enterprise Knowledge & Intelligent Training Platform/);
  assert.match(page, /Enterprise Knowledge & Intelligent Training Platform/);
  assert.match(layout, /lang="en"/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
});
