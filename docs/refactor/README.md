# 公司OA与DeepSeek Harness基座：当前协作入口

2026-10-29用户调整范围：以DeepSeek Harness为基座建设公司OA，先用官方原生页面作为OA首页；删除旧业务演示，具体OA业务需求以后再规划。旧企业知识/培训/工单B—E路线停止执行。

1. [当前产品路线图](roadmap.md)：产品定位、当前可用范围、六个基座任务与阶段出口。
2. [任务范围/验收](tasks.md)：OA-01—OA-06的依赖、交付和估算。
3. [OA执行跟踪](oa-tracking.md)：负责人查看实际状态和Issue入口。
4. [原生首页运行说明](../../apps/oa/README.md)：启动官方页面、模型配置及入口边界。
5. [产品CLI规范](cli-native.md)与[可执行客户端](../../tools/nuochong-cli/README.md)。
6. [范围决策ADR-010](../adr/ADR-010-oa-harness-product-scope.md)、[CLI决策ADR-009](../adr/ADR-009-cli-native-capabilities.md)。
7. [团队协作](collaboration.md)、[个人开发指南](developer-onboarding.md)。

官网保持独立。当前只交付源码清理、原生页面本机预览与客户端基础，正式公司身份/API/CLI/MCP联调按新任务执行；不宣称业务OA已经上线。本次不部署main/test或覆盖旧线上环境。

A阶段10项已完成的验证与Go保留为历史技术证据；其旧业务范围和人日估算不再约束当前产品。[旧路线归档](archive/business-plan-2026-10-29/roadmap.md)、[历史A阶段评审](phase-a-review.md)可供复用技术结论，不作为继续迁入旧业务页面的授权。

## 2026-10-30执行状态

本段为早期审计快照：原生管理员测试环境已上线并通过公网登录/WS验证；当时OA-01尚待整体验收。当前OA-01已验收，OA-02/OA-04技术完成，状态见下方最新实施记录。请以[完成情况审计](progress-2026-10-30.md)与[最新路线](roadmap.md)为准。此前“仅本机预览/本次不部署test”描述的是基础增量范围，后续用户已单独授权测试发布；main未发布。

## OA-02 / OA-04当前实施

[控制API与访问基础](../../apps/control-api/README.md)、[核心验收](oa-02-acceptance.md)、[访问验收](oa-04-acceptance.md)已形成。OA-01已验收，OA-02/OA-04待整体人工确认；其余三项未启动。历史“仅本机预览”或早期完成率以最新跟踪表为准，新控制API尚未新增公网发布。
