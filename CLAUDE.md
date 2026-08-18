# 诺崇科技官网（nuochong-page）项目上下文

## 项目概述

云南诺崇科技公司官网，单页营销站，双语（中文/英文）展示「企业知识与智能培训平台」。

## 技术栈

- 框架：vinext（Cloudflare 全栈，React 19 + Vite + RSC）
- 语言：TypeScript、React、Tailwind CSS
- 数据库：D1 + Drizzle（当前未启用，`db/schema.ts` 为空）
- 静态构建：Vite（`root=static-src`，输出到 `dist-static`）

## 目录结构

- `app/` — 应用代码
  - `page.tsx` 首页入口（metadata + 渲染 HomePage）
  - `layout.tsx` 根布局（字体、`html lang="en"`）
  - `HomePage.tsx` ★核心页面组件（全部 UI 与双语文案）
  - `globals.css` 全部样式（Tailwind + 手写 CSS）
  - `chatgpt-auth.ts` SIWC 登录辅助（当前未使用）
  - `api/country/route.ts` 返回 `cf-ipcountry` 国家码
- `static-src/` 静态站点构建入口（`index.html` + `main.tsx` 渲染 HomePage）
- `worker/index.ts` Cloudflare Worker 入口（图片优化 + 路由）
- `public/` 静态资源（logo、企业微信二维码等）
- `db/` D1/Drizzle（空 schema）
- `.github/workflows/deploy.yml` 生产部署流水线（`main`）
- `.github/workflows/deploy-test.yml` 测试环境部署流水线（`test` → Cloudflare Workers）
- `scripts/save-project-status.mjs` Stop hook 脚本（生成本状态文件）

## 核心机制

- 双语：`HomePage.tsx` 中 `copy` 对象含 `en`/`zh`；语言优先级：URL `?lang` > localStorage > 浏览器语言
- 联系方式（硬编码于 `HomePage.tsx`）：邮箱 `marketing@nuochong.work`，电话 `0871-67200971`

## 部署

三分支工作流：`dev`（本地开发，不自动部署）→ `test`（自动部署到 Cloudflare Workers 测试环境）→ `main`（自动部署到腾讯云生产）。

- 测试：GitHub Actions `push test` → `npm run build`（产出 Worker）→ `wrangler deploy`
  - Worker 名：`nuochong-company-homepage-test`
  - 访问地址：`https://nuochong-company-homepage-test.<账号子域>.workers.dev`
- 生产：GitHub Actions `push main` → `npm run build:static` → rsync 到 `deploy@$DEPLOY_HOST:/var/www/nuochong/`
- 服务器：腾讯云 Ubuntu（Nginx 托管），SSL 用 Let's Encrypt（覆盖 `nuochong.net` + `www.nuochong.net`）
- 域名：`nuochong.net` / `www.nuochong.net`
- GitHub Secrets：
  - 生产：`DEPLOY_SSH_KEY`、`DEPLOY_HOST`
  - 测试：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`

## 当前状态与已知问题

- ⚠️ 域名尚未完成 ICP 备案，腾讯云按域名拦截：HTTP 返回 302 到 `dnspod.qcloud.com/static/webblock.html`，HTTPS 直接 reset。直连 IP 可正常访问。备案通过后恢复。
- 测试环境使用 Cloudflare `*.workers.dev` 免费域名，不受 ICP 备案影响；图片优化路由 `/_vinext/image` 在免费计划不可用，但当前营销页不触发。

## 常用命令

- `npm run dev` 本地开发
- `npm run build` vinext 构建
- `npm run build:static` 静态构建
- `npm test` 构建并运行冒烟测试
- `npm run lint` ESLint

## 会话状态

每次主代理完成一轮后，`.claude/settings.json` 中的 Stop hook 会把最新项目状态写入 `docs/PROJECT_STATUS.md`。开始新任务前请先阅读该文件与本 `CLAUDE.md`。
