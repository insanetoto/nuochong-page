> 2026-11-25最新：#144 BAT-01—04技术验收通过并关闭；PR147合入refactor/integration（9bdb689f16a8365e702b580549161c7239291b6f），[最终复审](https://github.com/insanetoto/nuochong-page/pull/147#pullrequestreview-6052468920)。#142/#143/#144均已完成，不再领取这些任务。#107 已在隔离测试站通过负责人验收并关闭。见[人工验收记录](https://github.com/insanetoto/nuochong-page/issues/107#issuecomment-7154857586)和[发布记录](https://github.com/insanetoto/nuochong-page/actions/runs/45560106168)。下方Ready/Blocked及领取指令仅为历史。

> 2026-11-20最新：#143 SUB-01—04技术验收通过，PR #146 已合入 refactor/integration（`96ae5b62bd398f00d2a7100bceba522b1a31a603`）；固定审核head `de072e5e7b38d62a9301c088348c600a14bcceab`，[逐项复审](https://github.com/insanetoto/nuochong-page/pull/146#pullrequestreview-5989101222)、[精确head的PR CI](https://github.com/insanetoto/nuochong-page/actions/runs/44453542767)。本独立任务关闭；#144共享文件顺序已解锁。未代签人工产品验收，未部署，#107保留Tracking。

> 2026-11-20最新：Ready，可领取#144。#142已验收关闭，#143已验收合并关闭，共享文件占用已交接；基础为含`96ae5b62bd398f00d2a7100bceba522b1a31a603`的最新origin/refactor/integration。领取前先提交BAT-01—04→输入/屏障/期望/真实API浏览器测试路径映射，由ChatGPT预检可执行性；已有预检通过的方案可引用，不重复等待同一方案批准。只实现批次跟随/详情/恢复/分页，不重写已验收向导和后端状态机，不从旧PR141整体stack。记录执行者DeepSeek、基础SHA和允许文件；旧PR141仅复用来源。一个结果PR关联#144，全部AC与有效CI通过后自动合并关闭；#107保持Tracking，人工体验和发布另行确认。

> 2026-11-15当前协作规则：[设计到独立任务交付规范](delivery-contract.md)优先于下方历史流程。禁止在同一开发Issue内临时拆A/B/C；#107改为Tracking，后续执行正式任务142/143/144，见[迁移与独立任务](import-independent-tasks.md)。技术审核及有效CI通过后按负责人授权自动合并关闭已完成独立任务，人工验收与发布另记。

# 当前产品协作入口

2026-11-10当前交接：#105已验收并部署隔离测试；#106/#107已解锁，按[R3范围与文件责任](../product/knowledge/v2/w0/r3-management-admission-2026-11-10.md)先03后04领取。旧R1/R2快照不阻塞本次新任务。

2026-11-09当前交接：#94已验收并合并，DeepSeek下一项明确领取#105（Ready，PLAN-03:R2隔离数据准入），见[R2范围/验收/固定基线](../product/knowledge/v2/w0/r2-data-admission-2026-11-09.md)。其他FULL/生产门槛独立；下方为历史阶段快照。

2026-11-08发布更新：KBV2-01已验收并合入integration，官网测试/生产与知识库隔离测试发布成功；见[发布记录](../product/knowledge/v2/release-2026-11-08.md)。下方开工状态为早期快照，后续任务仍需完整准入。

W0最新交接：[决策、完整契约与KBV2-01有限准入确认单](../product/knowledge/v2/w0/README.md)。#104的R1准入已通过、Ready，完整运行准入仍未完成；本轮只记录合并与开工授权。

2026-11-08接续：v0人工验收与v2原型评审已确认；执行计划更新为[20项任务](../product/knowledge/v2/next-work.md)，见[负责人路线图](../product/knowledge/v2/execution-roadmap.md)。20项Issues已登记（[入口](../product/knowledge/v2/issue-registration.md)）；PLAN-01/02设计已Accepted，PLAN-03仅R1通过，v2运行代码未开工，#94独立调查。

2026-11-08协作分工：ChatGPT负责设计规划、契约、页面原型、交互设计与预审，DeepSeek只负责按确认设计进行代码实现；负责人确认设计、人工验收与发布。当前PR #99预审修订与实现负例见 [设计交接清单](../product/knowledge/v2/review-handoff.md)，全部v2能力仍planned。

2026-11-01：公司明确企业知识库、企业 AI 工具、培训和考试三产品体系，共用 DeepSeek Harness，通过插件扩展。**先读 [本轮规划成果](../product/README.md)、[当前路线图](roadmap.md)和[新任务计划](../product/tasks.md)。** 知识库初版已实施并部署隔离测试，见 [v0 实际交付](../product/v0/README.md)；完整方案与人工产品验收仍单列。

当前原生管理员演示已发布账号登录，控制 API 与普通员工 Web/SSO 的发布状态不得混淆。下文保留历史范围快照，以当前路线图为准。

# 公司OA与DeepSeek Harness基座：当前协作入口

2026-10-29用户调整范围：以DeepSeek Harness为基座建设公司OA，先用官方原生页面作为OA首页；删除旧业务演示，具体OA业务需求以后再规划。旧企业知识/培训/工单B—E路线停止执行。

1. [当前产品路线图](roadmap.md)：产品定位、当前可用范围、六个基座任务与阶段出口。
2. [任务范围/验收](tasks.md)：OA-01—OA-06的依赖、交付和估算。
3. [OA执行跟踪](oa-tracking.md)：负责人查看实际状态和Issue入口。
4. [原生首页运行说明](../../apps/oa/README.md)：启动官方页面、模型配置及入口边界。
5. [产品CLI规范](cli-native.md)与[可执行客户端](../../tools/nuochong-cli/README.md)。
6. [范围决策ADR-010](../adr/ADR-010-oa-harness-product-scope.md)、[CLI决策ADR-009](../adr/ADR-009-cli-native-capabilities.md)、[产品插件ADR-011](../adr/ADR-011-product-plugins-llm-wiki.md)（P1方向Accepted）、[产品本体ADR-012](../adr/ADR-012-product-ontology-and-knowledge-graph.md)（P1方向Accepted）。
7. [团队协作](collaboration.md)、[个人开发指南](developer-onboarding.md)。

官网保持独立。原生管理员测试首页、正式控制API/Worker、公司身份和基座/产品CLI契约（59项已注册能力）已交付；MCP与外部AI集成按OA-03推进，业务模块仍未规划。新控制API尚未公网发布，main未发布。

A阶段10项已完成的验证与Go保留为历史技术证据；其旧业务范围和人日估算不再约束当前产品。[旧路线归档](archive/business-plan-2026-10-29/roadmap.md)、[历史A阶段评审](phase-a-review.md)可供复用技术结论，不作为继续迁入旧业务页面的授权。

## 2026-10-30执行状态

本段为早期审计快照：原生管理员测试环境已上线并通过公网登录/WS验证；当时OA-01尚待整体验收。当前OA-01已验收，OA-02/OA-04已整体验收，状态见下方最新实施记录。请以[完成情况审计](progress-2026-10-30.md)与[最新路线](roadmap.md)为准。此前“仅本机预览/本次不部署test”描述的是基础增量范围，后续用户已单独授权测试发布；main未发布。

## OA-02 / OA-04当前实施

[控制API与访问基础](../../apps/control-api/README.md)、[核心验收](oa-02-acceptance.md)、[访问验收](oa-04-acceptance.md)已形成。OA-01至OA-06均已验收，当前6/6完成；用户批准有限Go，进入知识库设计。历史“仅本机预览”或早期完成率以最新跟踪表为准，新控制API尚未新增公网发布。
