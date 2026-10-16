# 诺崇科技官网

## 架构与环境

- `app/HomePage.tsx`：中英文营销首页，共用于两种构建。
- `app/app/`：业务后台，使用客户端模拟登录和员工数据，尚未接入真实认证或数据库。
- `worker/index.ts`、`vite.config.ts`：vinext React 服务端渲染、API 与 Cloudflare Worker 构建。
- `static-src/`、`vite.static.config.ts`：仅渲染营销首页的静态构建，不包含业务后台和服务端 API。
- `.openai/hosting.json`：当前 D1、R2 绑定均未启用。

| 分支 | 用途 | 部署目标 |
| --- | --- | --- |
| `dev` | 开发 | 不自动部署 |
| `test` | 测试 | Cloudflare Worker：`https://nuochong-company-homepage-test.76gzwtk9sb.workers.dev/` |
| `main` | 生产 | 腾讯云 Nginx：`https://www.nuochong.net/` |

测试分支包含独立的业务功能更新，发布时需审查差异，不应直接以 `main` 覆盖 `test`。

## 持续集成与部署

- `ci.yml`：分开构建 Worker 和静态站点；Worker 构建后运行服务端渲染测试。非 PR 运行同时检查现有测试、生产环境，健康检查失败与构建失败分别展示。
- `e2e.yml`：验证模拟登录、员工管理及匿名访问重定向。支持 `dev`、`test`、`main`、`ci/**` 分支推送和手动运行。
- `deploy-test.yml`：`test` 推送或手动运行后部署 Worker，再检查测试首页与资源。
- `deploy.yml`：`main` 推送或手动运行后将 `dist-static/` 同步至生产 Nginx，再检查生产首页与资源。

部署所需 GitHub Actions Secrets：测试环境需要 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`；生产环境需要 `DEPLOY_SSH_KEY`、`DEPLOY_HOST`。Git 的 SSH 凭据与这些部署凭据、GitHub Actions API 的授权相互独立。

本地验证：

```bash
npm ci
npm test
npm run build:static
npx playwright install chromium
npm run test:e2e
node scripts/check-environment.mjs test
node scripts/check-environment.mjs production
```

环境检查验证 HTTP 200、首页品牌、同源 JS/CSS、Logo 和生产主域名跳转；不等同于完整浏览器交互测试。检查有超时与重试，本机网络超时仍需结合远程 Runner 的结果判断。

## 原始框架说明

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

Signed-in visitors receive both `oai-authenticated-user-id` and `oai-authenticated-user-email`. Private Sites require every visitor to sign in; public Sites may also have anonymous visitors, for whom neither header is present.

The user ID is stable for the same user on the same Site and different across Sites. Email and name are intended for display or contact purposes.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const userId = requestHeaders.get("oai-authenticated-user-id");
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
