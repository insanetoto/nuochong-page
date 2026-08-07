import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
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
