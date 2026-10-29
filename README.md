# 诺崇官网与公司OA（DeepSeek Harness基座）

当前方向：保留官网，以DeepSeek Harness建设公司OA，临时直接使用官方原生Web页面作OA首页。旧模拟登录、员工管理、业务浮动入口及/app路由已移除；具体OA业务以后再规划，不继续旧知识/培训/工单路线。

- [当前产品路线图](docs/refactor/roadmap.md)
- [OA任务与验收](docs/refactor/tasks.md)
- [OA执行跟踪](docs/refactor/oa-tracking.md)
- [原生OA首页运行说明](apps/oa/README.md)
- [产品CLI基础](tools/nuochong-cli/README.md)

## 两个独立入口

官网使用app/HomePage.tsx与static-src；文案、素材、语言和SEO保持原基线。Worker还提供官网国家/语言辅助API及可配置的/oa跳转，静态官网不内嵌服务端能力。

OA首页由apps/oa中的独立启动器运行官方 `dsh --profile web`，保留原生会话、模型、工具和配置页面。不是重新制作的业务控制台；目前是本机管理员预览，员工级身份/权限按新路线实现。

```sh
# 官网开发与构建：Node >=22.13
npm ci
npm run dev
npm test
npm run build:static

# 原生OA页面：已验证 Node24.21.0、Harness0.2.1-rc.2
npm ci --prefix apps/oa --ignore-scripts --no-audit --no-fund
npm run oa:start
# 在终端打开官方打印的私有启动URL；也可加 -- --open
```

OA默认仅监听127.0.0.1:3080。NUOCHONG_OA_HOME可指定隔离状态目录；模型凭据由管理员在原生设置或服务端环境配置，启动/页面测试不调用模型。

需要从Worker官网 `/oa` 进入时，由管理员为官网服务配置不含token的 `NUOCHONG_OA_URL`（例如本机http://127.0.0.1:3080/）；首次认证仍使用原生启动流程。未配置返回503。静态生产站的/oa路由需实际Web服务/反向代理发布后才可用，不能仅靠静态构建获得。

## CLI与自动化

```sh
node tools/nuochong-cli/bin/nuochong.mjs capabilities --json
node tools/nuochong-cli/bin/nuochong.mjs schema runs.create --json
node tools/nuochong-cli/bin/nuochong.mjs runs get --run-id example --dry-run
npm run test:cli
```

当前CLI可离线发现/预检，任务HTTP客户端需后续OA控制API；不能把原生页面端口直接当作已实现的控制API。未来新增产品功能都须有CLI和版本化schema，MCP复用相同规则。

## 验证与发布边界

- ci.yml：Worker/静态构建、SSR/退役路由检查及现有线上健康观察。
- e2e.yml：官网语言、业务入口移除和旧路由404；不再测试演示口令登录。
- product-cli.yml：真实子进程/合成HTTP/SSE、Node兼容和离线安装包。
- oa-home.yml：真实官方Web页面、认证cookie交换及浏览器渲染，无模型调用。
- 官网macOS原像素基线继续保留；A阶段Harness实验在experiments/phase-a中作为历史技术证据，不是已交付OA业务。

重构集成目标为refactor/integration。main/test仍对应旧发布流程；本次源码清理不自动删除线上服务，不直接覆盖test分支独立历史。正式公司入口和生产发布按新路线另行验收、批准。
