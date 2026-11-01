# 三产品公开入口

2026-11-01，负责人明确批准官网产品链接目标变更（Issue #86），官网文案、布局、视觉及 SEO 不变。

| 产品 | 官网入口 | 当前行为 |
|---|---|---|
| 企业知识库 | https://nuochong.net/product/kb | 固定跳转 https://www.nuochong.net/oa-test/product/，在公司工作台登录，成功后仍停留该工作台 |
| 培训考试 | https://nuochong.net/product/te | 独立品牌页面，明确规划中/尚未上线 |
| 企业 AI 助手 | https://nuochong.net/product/ai-assistant | 独立品牌页面，明确规划中/尚未上线 |

`/oa-login.html` 与 `/oa-test/` 保留为原生管理员演示，不再作为官网三产品链接的目标。知识库使用自己的 HttpOnly 公司会话，不通过 Native `__login`，没有客户端 returnUrl 或 owner 令牌交换。

Worker 由 app/product/[slug]/route.ts 提供固定 307/规划页；生产 Nginx 静态产物通过 scripts/build-product-entries.mjs 生成 product/<slug>/index.html，目录入口可能先规范为尾部斜线，知识库再通过固定 meta refresh 进入工作台（保留无脚本可点击入口）。两种产物复用 lib/product-entries.mjs，未知 Worker 产品返回404。无需修改 root/Nginx 配置。

本次属于用户批准的导航 URL 调整，未新增业务命令或改变登录/API/CLI/MCP 权限契约。培训考试和 AI 助手只配置地址，不宣称业务已实现。完整知识库验证与现有测试账号见 v0/README.md。

本机验证：静态与 Worker 构建通过；渲染 5/5、Chrome E2E 6/6（中英三个入口、两视口导航、原生管理员登录回归）。新增路由/生成器/测试 ESLint 通过；HomePage 全文件检查仍报告原有 useEffect 内同步 setState 规则错误及 img 警告，本次未改该逻辑。未更新 Linux 像素基线。
