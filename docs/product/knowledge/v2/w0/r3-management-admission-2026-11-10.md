# PLAN-03 R3：空间管理与导入任务开发交接

2026-11-10 · ChatGPT / Codex。负责人明确要求「合并代码并部署，后续任务解锁」。本次接受#105的技术交付并批准其现有知识库隔离测试更新；按现有依赖，只解锁直接后继#106 / KBV2-03和#107 / KBV2-04的开发。其他任务仍按依赖验收推进，整版FULL、真实资料、独立生产环境与后续部署没有批量放行。

## 已满足前置

- #104已验收；#94调查已验收并合并。
- #105 / PR #134验收head：`380b80d778565a99d6054f4bbbfdeacdd2ebe006`；代码merge SHA：`84464eede3f9c820389e661554d75d3f506d1ad3`。
- #105部署结果与范围以[本次发布记录](../release-2026-11-10.md)为准；部署不等于完整v2页面交付。
- D01—D14、ADR-011/012 P1方向、35项版本化契约和原型5a172f5继续有效，新增设计缺口由ChatGPT处理，不交DeepSeek自行决策。

## 领取顺序、角色与文件责任

#106、#107状态为Ready，requiredAdmissionExit / requiredDependencyExit为PLAN-03:R3，不要求#103父Issue关闭。执行DeepSeek、设计及预审ChatGPT、人工验收负责人。因共享`plugins/knowledge/service.mjs`、产品插件页面、product路由与CLI注册，**先#106，再#107串行领取**；不能同时修改同一共享文件。每任务独立codex分支/工作目录，从含本交接的最新integration记录实际基础SHA，不从main/test或#131设计分支开展运行实现。

已发布迁移005不可再改写。后续确需增量字段时登记006及之后的新迁移，唯一修改人随领取记录；需要改共享锁文件/新增依赖先做设计预审。后续任务不是自动获准连接现有测试/生产库执行迁移。

## #106 知识空间管理

按原任务实现列表、创建向导、设置/改名/归档、编码不可变、角色/部门范围及审计；创建空间从知识首页移入来源管理。普通设置不能授予自批资格；资格来自可信部署配置/受控初始化，治理须当前合格空间、另一治理人独立审批、proposal/approval目标绑定、policyRevision、幂等及审计，旧非治理审批限制保持。

交付knowledge.spaces.get.v1/create.v2/update.v1/archive.v1/publication-policy.set.v1与access.approval-requests.create.v1、access.approvals.create.v2对应的冻结schema/CLI和同权负例；未实现仍planned，不给旧v1静默改字段。共享AccessKernel仅允许D05所需的窄扩展，允许文件增加`plugins/access-management/service.mjs`及相应增量迁移/测试，不能扩成全套IAM或下放owner。

沿用批准原型#spaces的布局与交互；当前产品壳集成入口固定为`/product/#spaces`（隔离测试外部前缀为`/oa-test/product/#spaces`），旧首页创建入口转到该页，旧来源/员工消费保持兼容。正式`/knowledge/manage/spaces`与完整历史路由映射由#108后续统一接入，不能自行发明新的交互。测试同时验证菜单进入、直接链接、刷新/后退、权限与390px/键盘。

## #107 文本导入与片段任务

#106集成后领取共享文件，再按原任务交付MD/TXT、文本层PDF、DOCX四类解析、三步导入向导、批次/逐文件进度、片段定位、取消/失败重试和审计。空/加密/伪装/超限/扫描件及未支持音视频明确拒绝，不mock成功；采用批准的大小/文件/页数/展开体积/超时/并发限制。来源原文、片段和模型建议分离，未知外部写先核对，强杀/重试/撤权不得重复副作用。

交付knowledge.objects.upload.v1及knowledge.imports.create/list/get/cancel/retry.v1的版本化schema/CLI与同权负例。只允许知识产品导入任务的窄实现及冻结jobs DTO适配，不修改#94涉及的原生运行租约/身份语义。批准原型#imports是三步导入与状态交互基线；当前集成入口为`/product/#imports`（外部测试前缀`/oa-test/product/#imports`），正式路由后续由#108统一，不添加生产测试provider开关。可复用workKnowledgeOnce的executorFactory在隔离测试中注入合成结果；真实公司模型验证独立记录，不用拦截业务API伪造成功。

## 两项任务共同验收与范围

- 每项在独立本地/CI PostgreSQL schema与合成对象目录验证，不使用真实客户资料；UI与CLI复用业务API/授权，所有新/改能力有schema/CLI/正反例，--yes/dry-run不能绕审批。
- 页面按已批准原型逐项给出实际截图/交互、正常/空/错误/撤权状态；旧v0 E2E仅作兼容回归，不替代新页面验收。Linux真实截图与macOS证据分别标记，首次视觉基线确认另记。
- PR目标integration，包含基础/head SHA、实际修改文件/迁移编号、设计/命令/页面映射、测试与未运行项；DeepSeek不自行合并/验收/部署，不提前启动#108/#109等依赖尚未验收的任务。
- #125与#131整版发布规则评审继续，图谱首页、共享壳、审校、发布和员工消费依其任务交付；不因本次两项准入宣称完整V2已实现。
