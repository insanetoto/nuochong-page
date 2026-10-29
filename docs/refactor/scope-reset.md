# OA范围调整与本次验证

2026-10-29；当前增量Issue #31。实现/人工验收/集成/发布分别记录，当前等待负责人验收，不自动部署main/test或启动OA-01—06。

## 清理与保留

删除app/app下的模拟登录、控制台、员工管理及辅助组件；删除business.css、未使用chatgpt-auth.ts、examples/d1中的演示notes/schema和旧模拟登录测试。原/app、/app/login、/app/dashboard、/app/users均404，不恢复旧token登录。

官网HomePage、globals.css、static-src、public素材、根锁文件与A-02全部受保护hash一致；原4个像素截图/DOM基线未更新。layout移除旧业务浮动入口与样式。国家/语言API和构建托管保留；db空脚手架不是OA持久化功能。

原A阶段实验作为SDK、持久任务、权限和部署技术证据保留；不将其企业夹具/API当当前业务系统。旧路线完整归档，B未执行Issues按not_planned撤销，A已验收记录不变。

## 当前可验证交付

- apps/oa独立锁定官方dsh0.2.1-rc.2，Node24.21.0启动web Profile，默认回环地址、隔离状态/工作目录。真实官方UI，不改上游核心。
- Worker /oa由服务端配置跳转，不接受访客覆盖或含token的配置；未配置503。此路由不代替正式公司认证，静态托管需独立服务/代理。
- nuochong无第三方依赖，可独立安装，提供能力/schema发现、本地预检及运行HTTP/SSE客户端。正式OA控制API、公司身份、MCP和真实外部AI接入仍待OA任务，不等同已交付。

## 本机证据

平台darwin-arm64，Node24.21.0，Chrome156.0.8078.48：

| 检查 | 结果 | 边界 |
| --- | --- | --- |
| npm test | 4/4通过 | Worker构建、首页SSR、退役路由404、/oa配置边界及官网双语源 |
| 官网原像素/DOM测试 | 5/5通过 | macOS静态官网，不冒充Linux视觉验证 |
| Playwright E2E | 2/2通过 | Worker官网语言、入口移除、带旧token访问404 |
| CLI子进程/HTTP/SSE | 18/18通过 | 合成回环服务，非正式OA API联调 |
| CLI离线打包与安装 | 通过 | 仓库外执行安装包，未修改全局安装 |
| 官方Harness Web浏览器 | 通过 | 全新隔离状态，认证cookie交换后URL去token，根组件/按钮渲染，无页面异常，0次模型调用 |
| 官网与原基线hash | 全部一致 | 包含受保护源码、素材、根锁文件、4套截图/DOM |

原生页面报告见[darwin-home.json](../../apps/oa/results/darwin-home.json)；页面截图作为本机outputs和远程CI产物供审阅，不提交任何状态/私有启动URL。Linux由新增oa-home/product-cli工作流和原Build/E2E执行，具体结果见PR检查；本机结果不替代远程结果。

## 新规划

[六项任务](tasks.md)、[依赖与进度](oa-tracking.md)、[路线图](roadmap.md)。当前0/6完成；本次验收后仅OA-01 Ready。普通员工权限、正式服务部署、真实模型/CLI/MCP贯通和稳定性验收属于后续任务，具体OA业务暂不排期。
