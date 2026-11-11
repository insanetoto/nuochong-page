# 知识库 v2 执行计划与任务卡（2026-11-08 · r5（R1已批准））

2026-11-11当前状态：#106已合并部署隔离测试（a6d9a5e）；#107 Ready并顺序接管共享文件，见[开工卡](task-107-kickoff.md)。原20项与6项发布质量任务统一台账为26项，发布设计仍与运行实现分别验收；完整V2未上线。见[发布记录](release-2026-11-11.md)与[复盘改进](retrospective-2026-11-11.md)。下方旧状态为历史快照。

2026-11-10最新：#105已验收、合并并更新知识库隔离测试，见[发布记录](release-2026-11-10.md)。#106/#107为Ready，消费[PLAN-03:R3](w0/r3-management-admission-2026-11-10.md)，先空间管理再导入串行领取；整体V2/FULL和后续发布仍独立。下方历史阶段快照不能覆盖本条。

**2026-11-09最新：#94已验收关闭，PR #132已合入integration（4fce492）；#105 / KBV2-02为Ready，明确消费PLAN-03:R2，只允许隔离合成数据开发，不等待#103父Issue关闭。整体FULL及其他任务/部署不自动解锁。见[R2交接](w0/r2-data-admission-2026-11-09.md)。**


**2026-11-08 发布更新：KBV2-01 已由负责人验收，PR #123 已合入 integration；官网测试/生产及知识库隔离测试发布成功。知识库 v2 页面与后续业务能力仍 planned，#94 / 完整运行准入保持独立。详见[验收与发布记录](release-2026-11-08.md)。**


负责人已确认 **v0人工验收和v2原型评审通过**。本次把原型逐页映射为交付任务：共20项（18项知识库工作、2项其他产品设计），其中PLAN-01/02已Accepted，PLAN-03完整准入进行中、R1已通过，KBV2-01 Released（隔离测试），其余16项Planned。仅KBV2-01离线模块已实现，已创建20项Issues，具体成员尚未分配；具体成员与日历排期未虚构。

- [原型确认记录](prototype-acceptance-2026-11-08.md)：批准版本 `5a172f5`；HTML和截图保持原批准内容。
- [任务JSON](execution-plan.json)：本文件表格/任务卡与之对应；[负责人路线图](execution-roadmap.md)提供快速查看入口。
- ChatGPT负责设计规划、页面原型、交互设计、契约和预审；DeepSeek只负责按确认设计实现代码、迁移及自动化测试；负责人确认设计/人工验收/发布。

本轮W0已补齐[决策、契约与有限准入确认单](w0/README.md)。负责人已批准并完成R1准入，#104 Released（隔离测试）；其依赖为#103的R1子出口，完整运行准入仍未完成；新v2命令/允许目录变化见契约候选，不把旧草稿字段直接用于实现。

## 1. 本次调整

1. 解除“等待v0验收/等待原型确认”两项历史条件，不将其继续列为待办。
2. 保留PLAN-01未完成的业务/技术决定、PLAN-02完整契约和PLAN-03执行准入；原型通过不自动接受ADR或授权生产迁移。
3. 新增KBV2-14：员工搜索、阅读、原文核验与引用问答，避免只重构图谱而漏掉员工主流程。
4. 新增KBV2-15：产品壳、导航、旧链接兼容与持久任务页面。03/04/06/07分别交付各自管理页面，09仅负责图谱，避免UI范围重叠。
5. 修正07验收中夹带P2消费者/培训的矛盾：P1只立即发布、撤回、必要回退及已有读能力；后置建议在PLAN-01确认。05/12媒体不阻塞P1。
6. #94仍Open且无新增调查证据，沿用原Issue，不另建重复任务；PLAN-03要求调查结论或负责人明确风险决定。

## 2. 实施波次和出口

| 波次 | 任务与顺序 | 出口 |
| --- | --- | --- |
| W0 决策与契约 | PLAN-01 → PLAN-02 → PLAN-03；#94独立调查 | P1范围/ADR决定、完整schema/兼容、批准的设计合入、实施授权及集成SHA明确 |
| W1 数据基础 | 01 → 02 | 本体加载、真实PG增量迁移、v0段落回填与兼容通过 |
| W2 来源与工作区 | 03、04逻辑并行；04 → 06；03+04 → 15 | 空间、导入、三栏审校、任务与产品壳真实可用 |
| W3 发布与消费 | 03+06 → 07 → 08；08+15 → 09；07+15 → 14；10按后端依赖做联合验证 | 不可变发布/图谱、员工搜索阅读问答、API/CLI/MCP一致 |
| W4 P1验收 | 11等待全部P1交付，包括09/10/14/15 | 迁移恢复/Linux/权限回归和人工产品验收；试点/发布单独授权 |
| 后续P2 | 11 → 05 → 12；11 → 13设计 | 媒体供应/真实评测、能力运营与跨产品范围分别批准 |
| 其他产品设计 | PLAN-01 → TOOL-01、LEARN-01 | ChatGPT分别输出方案/原型/任务，不启动两产品运行代码 |

P1范围建议：Markdown/TXT、文本层PDF、DOCX → 片段审校与条目组装 → 审批发布 → 图谱/搜索/引用问答；保留v0命令与行号引用。音视频/扫描件、排期、消费者管理、培训快照、向量集群和跨空间证据引用不进入本轮P1实现建议。该范围已随W0确认单获批；设计确认不自动扩大R1开工范围。

共享文件（`product.mjs`、`plugins/knowledge/service.mjs`、`apps/product-web/plugins/knowledge.mjs`、CLI注册、迁移序号、npm锁文件）先在PLAN-03确定唯一修改人；逻辑可并行不等于可同时改同一文件。允许目录是任务边界，新增文件名和迁移编号实施前登记。官网/上游核心/生产配置不在任务允许范围。

## 3. 任务总览

| ID | Issue | 工作 | 波次 | 依赖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PLAN-01 | [#101](https://github.com/insanetoto/nuochong-page/issues/101) | 知识库交接、存量缺口与设计决定冻结 | W0 | 无 | Accepted |
| PLAN-02 | [#102](https://github.com/insanetoto/nuochong-page/issues/102) | P1命令与数据契约实现前冻结 | W0 | PLAN-01 | Accepted |
| PLAN-03 | [#103](https://github.com/insanetoto/nuochong-page/issues/103) | 实现准入与执行任务登记 | W0 | PLAN-01, PLAN-02 | In progress |
| KBV2-01 | [#104](https://github.com/insanetoto/nuochong-page/issues/104) | 本体注册表与版本治理 | W1 | PLAN-03:R1 | Released（隔离测试） |
| KBV2-02 | [#105](https://github.com/insanetoto/nuochong-page/issues/105) | 数据模型扩展与迁移 | W1 | KBV2-01, PLAN-03:R2 | Released（隔离测试） |
| KBV2-03 | [#106](https://github.com/insanetoto/nuochong-page/issues/106) | 知识空间管理 | W2 | KBV2-02, PLAN-03:R3 | Released（隔离测试） |
| KBV2-04 | [#107](https://github.com/insanetoto/nuochong-page/issues/107) | 文本/PDF/DOCX 导入与片段任务 | W2 | KBV2-02, PLAN-03:R3 | Ready |
| KBV2-15 | [#108](https://github.com/insanetoto/nuochong-page/issues/108) | 产品壳、导航兼容与持久任务页面 | W2 | KBV2-03, KBV2-04 | Planned |
| KBV2-06 | [#109](https://github.com/insanetoto/nuochong-page/issues/109) | 片段待审与条目组装 | W2 | KBV2-04 | Planned |
| KBV2-07 | [#110](https://github.com/insanetoto/nuochong-page/issues/110) | 发布与能力输出 | W3 | KBV2-03, KBV2-06 | Planned |
| KBV2-08 | [#111](https://github.com/insanetoto/nuochong-page/issues/111) | 图谱查询 API | W3 | KBV2-07 | Planned |
| KBV2-09 | [#112](https://github.com/insanetoto/nuochong-page/issues/112) | 知识全景前端 | W3 | KBV2-08, KBV2-15 | Planned |
| KBV2-14 | [#113](https://github.com/insanetoto/nuochong-page/issues/113) | 员工搜索、阅读、原文核验与引用问答页面 | W3 | KBV2-07, KBV2-15 | Planned |
| KBV2-10 | [#114](https://github.com/insanetoto/nuochong-page/issues/114) | 契约、CLI 与 MCP | W3 | KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08 | Planned |
| KBV2-11 | [#115](https://github.com/insanetoto/nuochong-page/issues/115) | P1迁移、评测与试点 | W4 | KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08, KBV2-09, KBV2-10, KBV2-14, KBV2-15 | Planned |
| KBV2-05 | [#116](https://github.com/insanetoto/nuochong-page/issues/116) | 音视频/OCR 导入（P2） | P2 | KBV2-11 | Planned |
| KBV2-12 | [#117](https://github.com/insanetoto/nuochong-page/issues/117) | P2媒体专项评测与试点 | P2 | KBV2-05, KBV2-11 | Planned |
| KBV2-13 | [#118](https://github.com/insanetoto/nuochong-page/issues/118) | 能力运营、排期与跨产品知识快照设计 | P2 | KBV2-11 | Planned |
| TOOL-01 | [#119](https://github.com/insanetoto/nuochong-page/issues/119) | 首个企业AI工具产品方案 | Parallel design | PLAN-01 | Planned |
| LEARN-01 | [#120](https://github.com/insanetoto/nuochong-page/issues/120) | 培训考试首期产品方案 | Parallel design | PLAN-01 | Planned |

## 4. 已登记Issue的任务卡

以下是角色主责，不代表已分配实际成员。commandId为现有/候选命令引用，完整schema在PLAN-02冻结；空清单的内部/迁移/验收任务不强行新增产品能力。全部实现任务随功能交付CLI，10负责联合收尾。

### PLAN-01 知识库交接、存量缺口与设计决定冻结

- 主责：ChatGPT；负责人确认；优先级：P0；波次：W0。
- 状态：Accepted；依赖：无；Issue：[#101](https://github.com/insanetoto/nuochong-page/issues/101)。
- 范围：复用已验收v0和已通过原型，核对实际schema/权限差异；冻结P1范围、关系与审校规则、性能/文件额度及ADR决定。
- 不做：不代替#85人工验收，不改运行代码，不合并或发布。
- 允许目录/文件：`docs/product/`、`docs/refactor/`、`docs/adr/`。
- 交付：设计/契约/决定/任务证据；不提交运行代码。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。
- 已有证据：v0人工验收：#85已关闭；v2原型评审通过：prototype-acceptance-2026-11-08.md。

验收标准：

- [ ] 输出来源SHA/部署版本/实际实现/未交付/关联任务五列映射，不重复恢复旧B—E任务。
- [ ] 片段审校单位、首期关系类型、图谱上限、发布原子性及豁免治理有明确决定与批准证据；批准前不得标Accepted。
- [ ] 核验v0固定角色是否满足P1，列出共享IAM最小缺口及独立任务；不得把完整IAM-03默认为已验收。
- [ ] 复用已通过原型5a172f5，不重复请求页面方向批准；未决技术/范围决定逐项记录，不推定ADR已Accepted。

### PLAN-02 P1命令与数据契约实现前冻结

- 主责：ChatGPT；DeepSeek评估可实现性；优先级：P0；波次：W0。
- 状态：Accepted；依赖：PLAN-01；Issue：[#102](https://github.com/insanetoto/nuochong-page/issues/102)。
- 范围：按contracts.md逐命令确定字段、版本、权限、审批、幂等、错误及CLI映射，提前冻结公共schema。 以原型逐页核对命令，冻结旧v1兼容方案、错误/响应及发布hash规范；原型字段名不直接作为运行时契约。
- 不做：不等到KBV2-10才决定接口，不修改实际能力注册。
- 允许目录/文件：`docs/product/`、`docs/refactor/`、`docs/adr/`。
- 交付：设计/契约/决定/任务证据；不提交运行代码。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 新增/扩展命令逐项对照v0能力，破坏性变化使用新版本，列出兼容窗口。
- [ ] 定义graphHash规范化、关系/概念/分配修订、policyRevision与发布审批摘要字段；输入输出schema可验证。
- [ ] 实现任务的命令清单和负例一一关联；planned不注册在线成功，数据迁移有expand/contract边界。

### PLAN-03 实现准入与执行任务登记

- 主责：ChatGPT；负责人批准；优先级：P0；波次：W0。
- 状态：In progress；依赖：PLAN-01, PLAN-02；Issue：[#103](https://github.com/insanetoto/nuochong-page/issues/103)。
- 范围：核对#99/#100的合并与批准证据、PLAN-01/02及#94，固定refactor/integration真实SHA，准备可分配任务及文件责任。
- 不做：不直接推main/test，不批准生产迁移，不共享同一可写目录。
- 允许目录/文件：`docs/product/`、`docs/refactor/`、`docs/adr/`。
- 交付：设计/契约/决定/任务证据；不提交运行代码。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 记录批准的设计提交及ADR决定；PR合并或CI绿色不自动充当设计批准。
- [ ] #94调查结论有复现/时序/无披露/唯一终态证据，或负责人记录明确风险决定；任务依赖解除可追踪。
- [ ] 本轮已获负责人明确授权创建20项Issues；核对任务/Issue一一对应，继续登记实际执行者、预审、负责人、目录和集成SHA；登记完成不等于领取或实现验收。
- [ ] 记录实施授权、命名责任人、已合入设计的集成SHA及共享文件负责人；只靠原型通过不能将代码任务标Ready。

### KBV2-01 本体注册表与版本治理

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W1。
- 状态：Released（隔离测试）；依赖：PLAN-03:R1（分项已验收，父任务仍Open）；Issue：[#104](https://github.com/insanetoto/nuochong-page/issues/104)。
- 范围：类/关系/约束注册、manifest 片段、版本兼容、只读加载、审计；不建推理机
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`packages/platform/`、`plugins/knowledge/`、`apps/control-api/test/`。
- 交付：注册/加载校验与兼容测试；只读内部模块不强行新增业务命令。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 不兼容/重复 ID/未登记命名空间拒绝；版本升级/回退有迁移记录；三产品可声明片段
- [ ] 复用v0现有插件组合，先做差异清单；命名空间、重复ID、兼容major、缺依赖均拒绝；不得关闭可信授权。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。

### KBV2-02 数据模型扩展与迁移

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W1。
- 状态：Released（隔离测试）；依赖：KBV2-01、PLAN-03:R2；Issue：[#105](https://github.com/insanetoto/nuochong-page/issues/105)。
- 范围：空间 code/type、片段、概念、关系、导入批次/文件、能力表；v0 按段落回填与双读
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`apps/control-api/src/migrations/`、`plugins/knowledge/`、`apps/control-api/test/`。
- 交付：增量迁移、幂等回填、旧数据双读与恢复演练证据。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 真 PostgreSQL 迁移/回滚；回填幂等；旧条目可读；跨空间关系按双方可见裁剪、证据引用拒绝
- [ ] 新关系/概念/分配修订与supersedes模型落库；同条目不同修订合法，同修订自指/跨条目/逆序拒绝。
- [ ] 合成v0数据按段落回填可重跑，旧行号仍可定位；先验证新旧读路径，再批准切换；应用回退和数据恢复分别演练。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。

### KBV2-03 知识空间管理

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W2。
- 状态：Ready；依赖：KBV2-02、PLAN-03:R3；Issue：[#106](https://github.com/insanetoto/nuochong-page/issues/106)。
- 范围：列表、创建向导、设置、改名、归档、角色/部门范围、审计；从首页移除创建
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：`knowledge.spaces.get.v1`、`knowledge.spaces.create.v2`、`knowledge.spaces.update.v1`、`knowledge.spaces.archive.v1`、`knowledge.spaces.publication-policy.set.v1`、`access.approval-requests.create.v1`、`access.approvals.create.v2`。

验收标准：

- [ ] 编码唯一/部门停用/无权限/未豁免自批负例；改名后旧链接稳定；390px/键盘；CLI 同权
- [ ] 只读展示自批策略；普通create/update夹带allowSelfPublish拒绝；新治理命令必须合格空间、独立治理审批、policyRevision、幂等与审计。
- [ ] 策略变化使旧内容审批失效；无第二治理批准人保持关闭；API/CLI和受限MCP负例一致。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-04 文本/PDF/DOCX 导入与片段任务

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W2。
- 状态：Ready；依赖：KBV2-02、PLAN-03:R3；Issue：[#107](https://github.com/insanetoto/nuochong-page/issues/107)。
- 范围：批次/文件/校验/解析/片段/任务/重试/取消；locator 与 hash；交付批次列表/详情、三步导入表单及逐文件结果UI，PDF文本层检测须由服务端执行。
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：`knowledge.objects.upload.v1`、`knowledge.imports.create.v1`、`knowledge.imports.list.v1`、`knowledge.imports.get.v1`、`knowledge.imports.cancel.v1`、`knowledge.imports.retry.v1`。

验收标准：

- [ ] Markdown、TXT、文本层PDF、DOCX分别验证；空/加密/超限/伪装拒绝，输入保留且不得伪造解析成功。
- [ ] Markdown/TXT、文本层PDF、DOCX分别提供定位夹具；扫描/加密/伪装/超限明确失败，无半成功。
- [ ] 任务强杀/重试/撤权不重复写；原文/模型建议分离；无媒体供应商也可完成本任务。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-15 产品壳、导航兼容与持久任务页面

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W2。
- 状态：Planned；依赖：KBV2-03, KBV2-04；Issue：[#108](https://github.com/insanetoto/nuochong-page/issues/108)。
- 范围：产品壳与响应式导航、可信会话/角色驱动菜单、空间范围、我的任务、共享组织入口与旧链接兼容；提供其他页面共用的加载/错误/引用组件。
- 不做：不创建人员角色主库，不把原型角色/状态切换器或原生owner入口带入正式页面；不实现AI工具/培训业务。
- 允许目录/文件：`apps/product-web/`、`apps/control-api/src/product-web.mjs`、`apps/control-api/test/product-web.browser.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：真实UI与共享API集成、适用契约/CLI、浏览器/负例证据及PR。
- 命令引用：`knowledge.jobs.get.v2`、`knowledge.jobs.list.v2`、`knowledge.jobs.events.v2`、`knowledge.jobs.cancel.v2`。

验收标准：

- [ ] 侧栏含全景/搜索/问答、来源三模块和共享管理入口；空库引导去知识空间，首页没有新建空间表单。
- [ ] 身份/权限由可信会话返回，跨空间切换清理旧数据；无权请求由API拒绝而非仅隐藏按钮。
- [ ] 我的任务使用真实jobs列表/事件游标/持久终态；导入/编译/问答均可恢复跟随，停止跟随不取消远端。
- [ ] 取消请求保持pending直到服务端终态；失败有稳定错误码/requestId和可用恢复动作，不盲目重复未知结果。
- [ ] 旧sources/changes及现有v0书签有明确兼容映射，保留参数、代理前缀和登录cookie边界；任务路由在PLAN-02冻结，不凭原型hash另开未授权路由。
- [ ] 桌面和390px导航/表单可操作；键盘焦点与弹层关闭可恢复；共享目录复用现有插件，未交付产品明确规划中。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-06 片段待审与条目组装

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W2。
- 状态：Planned；依赖：KBV2-04；Issue：[#109](https://github.com/insanetoto/nuochong-page/issues/109)。
- 范围：待审区、片段接受/拒绝/合并/拆分、条目草稿、引用校验、冲突提示；按批准原型实现三栏审校、概念/关系候选及正文差异、引用抽屉与冲突恢复。
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：`knowledge.fragments.list.v1`、`knowledge.fragments.review.v1`、`knowledge.concepts.list.v1`、`knowledge.concepts.upsert.v1`、`knowledge.entries.list.v1`、`knowledge.entries.get.v1`、`knowledge.entries.draft.v1`、`knowledge.entries.submit.v1`、`knowledge.entries.review.v1`、`knowledge.relations.upsert.v1`。

验收标准：

- [ ] 片段不能直接发布；引用漂移阻断；并发保留草稿；审校 hash
- [ ] 逐片段核验与条目组装采用已冻结审校粒度；草稿保留expectedRevision，引用hash漂移阻断。
- [ ] 来源输入不能提权或写发布指针；真实模型与合成失败证据分开。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 接受/拒绝/合并/拆分保留原始来源修订与定位；模型建议标suggested，关系/概念修改形成新修订并使旧审批失效。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-07 发布与能力输出

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W3。
- 状态：Planned；依赖：KBV2-03, KBV2-06；Issue：[#110](https://github.com/insanetoto/nuochong-page/issues/110)。
- 范围：P1立即发布、撤回、必要回退、快照与现有知识能力绑定；排期、消费者管理和培训快照归KBV2-13。 包含批准原型的确认、阻断与失败恢复页面；不将事务完成态样例当真实结果。
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：`knowledge.publications.publish.v2`、`knowledge.publications.withdraw.v2`、`knowledge.publications.rollback.v1`、`knowledge.capabilities.list.v1`。

验收标准：

- [ ] 发布中心/能力展示/质量检查接真实API；有效独立审批、CAS、幂等及实时失效通过；无审批/已失效/自批未获治理批准时不得写发布指针。
- [ ] 封存关系/概念/分配与graphHash，审批/CAS同事务；修改候选不改变S1，S2批准后原子切换。
- [ ] 跨空间目标换版隐藏旧边；历史重建叠加当前权限/有效性；新旧发布命令兼容。
- [ ] P1只做立即发布、撤回、必要的版本回退和现有读能力；新增排期/消费者管理/培训快照转后续任务，按PLAN-01确认。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-08 图谱查询 API

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W3。
- 状态：Planned；依赖：KBV2-07；Issue：[#111](https://github.com/insanetoto/nuochong-page/issues/111)。
- 范围：可见集合、节点/边、跨空间关系、概念/关系、聚合/截断、graphVersion、缓存键
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：`knowledge.graph.query.v1`。

验收标准：

- [ ] 权限裁剪无泄漏；跨空间仅双方可见；300/2k 节点性能；撤回后边消失；CLI 同权
- [ ] 员工图只读发布refs；维护草稿视图独立权限/缓存；两端不可见则边/标题/计数不返回。
- [ ] 300/2000节点与截断/聚合按冻结环境实测；撤回/撤权立即过滤；旧快照不恢复权限。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-09 知识全景前端

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W3。
- 状态：Planned；依赖：KBV2-08, KBV2-15；Issue：[#112](https://github.com/insanetoto/nuochong-page/issues/112)。
- 范围：力导向图、筛选、局部图、抽屉、列表兜底、移动端、无障碍；仅负责图谱页面，搜索/阅读/问答归14，公共壳与任务归15。
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`apps/product-web/`、`apps/control-api/src/product-web.mjs`、`apps/control-api/test/product-web.browser.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：真实UI与共享API集成、适用契约/CLI、浏览器/负例证据及PR。
- 命令引用：`knowledge.graph.query.v1`、`knowledge.entries.get.v1`。

验收标准：

- [ ] 交互/键盘/390px；空/错/截断状态；reduced motion；性能降级
- [ ] 真实API完成聚焦/筛选/列表兜底/390px/键盘/reduced-motion；不将静态原型当真实产品。
- [ ] 官网截图/正文/SEO无回归；默认不把修订替代折叠成条目自环。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 按批准全景原型接真实节点/边，支持1–2跳、拖动/缩放、URL筛选恢复和截断提示；点击不同节点加载对应条目，不能复用样例正文。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-14 员工搜索、阅读、原文核验与引用问答页面

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W3。
- 状态：Planned；依赖：KBV2-07, KBV2-15；Issue：[#113](https://github.com/insanetoto/nuochong-page/issues/113)。
- 范围：按批准原型交付搜索结果、条目正文、定位抽屉、有依据问答及异常状态，复用现有服务并适配v2片段/快照。
- 不做：不另造检索/授权/任务状态机，不重复建设语义检索或向量数据库，不改官网。
- 允许目录/文件：`apps/product-web/`、`apps/control-api/src/product-web.mjs`、`apps/control-api/test/product-web.browser.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：真实UI与共享API集成、适用契约/CLI、浏览器/负例证据及PR。
- 命令引用：`knowledge.search.v2`、`knowledge.sources.get.v2`、`knowledge.answers.ask.v2`。

验收标准：

- [ ] 搜索/阅读使用真实资源ID和现行快照；结果范围由服务端过滤，URL前进后退恢复关键词与空间，不隐式调用模型。
- [ ] 引用抽屉展示真实来源修订与行/段/页定位；打开/下载重新验权；兼容v0行号引用。
- [ ] 问答接持久任务，有依据/无依据/冲突/失败状态明确；答案引用可跳转原文，来源失效或撤权后停止输出并清除旧内容。
- [ ] 停止跟随、请求取消与已取消终态分别显示；保留问题但不继续呈现失效答案。
- [ ] 390px、键盘、焦点恢复和安全文本渲染通过；不将原型角色切换器带入产品。
- [ ] 复用knowledge.search.v1、pages.get/list、sources.get、answers.ask及jobs契约；扩展schema保留兼容，API/CLI与Web同权且无权负例无泄漏。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-10 契约、CLI 与 MCP

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W3。
- 状态：Planned；依赖：KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08；Issue：[#114](https://github.com/insanetoto/nuochong-page/issues/114)。
- 范围：基于各功能已交付schema/CLI，完成API/CLI/受限MCP联合验证、兼容与包安装收尾；不在本任务才首次定义契约。
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] API/CLI/MCP 同权；planned 不注册；审批/幂等不可绕过；独立安装
- [ ] 本任务做跨入口联合收尾，不替代各实现任务随功能交付schema/CLI和负例。
- [ ] 独立CLI包安装、API/CLI/MCP同权、审批幂等不可绕过；未实现命令不进入ready；不默认开放治理写命令。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-11 P1迁移、评测与试点

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P1；波次：W4。
- 状态：Planned；依赖：KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08, KBV2-09, KBV2-10, KBV2-14, KBV2-15；Issue：[#115](https://github.com/insanetoto/nuochong-page/issues/115)。
- 范围：v0 迁移演练、按段落片段回填校验、检索/图谱质量、恢复、容量、合成数据
- 不做：不恢复旧演示，不改官网，不扩权，不将planned注册为成功。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 迁移/回滚演练；权限/撤回/强杀/并发；Linux 检查；不冒充生产容量
- [ ] #85人工基线记录完成；#94结论及回归通过，或有明确风险接受；v0迁移/回退、任务强杀、发布竞争、图谱无泄漏有Linux证据。
- [ ] 负责人完成P1产品验收、真实资料授权及试点范围决定；部署另行授权，不能以工程结项替代Accepted。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 批准原型10个视图逐一对照真实页面与资源ID，覆盖正常/空/错/撤权/过期/冲突；390px和键盘可用，官网Linux基线按适用流程检查。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-05 音视频/OCR 导入（P2）

- 主责：DeepSeek；ChatGPT预审；负责人验收；优先级：P2；波次：P2。
- 状态：Planned；依赖：KBV2-11；Issue：[#116](https://github.com/insanetoto/nuochong-page/issues/116)。
- 范围：外部大模型 ASR/OCR 适配、音视频抽取、时间码片段、置信度、失败码、数据边界
- 不做：不阻塞P1，不未经批准调用外部媒体服务。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：`knowledge.imports.create.v1`、`knowledge.imports.get.v1`。

验收标准：

- [ ] 文本类测试通过；外部适配器未配置明确失败；开关/审计/成本记录；不宣称 DeepSeek 可转写
- [ ] P2须另外确认供应商、区域、数据保留、预算及真实媒体验收授权；文本/未配置失败不能算媒体成功。
- [ ] 提交实际SHA、测试证据及未运行项；先自查/CI，再设计一致性预审，人工验收另记。
- [ ] 新增/变更能力随本任务交付版本化输入输出schema、CLI映射及API/CLI同权负例；纯布局不新增业务命令，未实现保持planned。

### KBV2-12 P2媒体专项评测与试点

- 主责：DeepSeek；负责人验收；优先级：P2；波次：P2。
- 状态：Planned；依赖：KBV2-05, KBV2-11；Issue：[#117](https://github.com/insanetoto/nuochong-page/issues/117)。
- 范围：独立验证真实转写/OCR、定位、权限、撤权、取消、成本和数据保留。
- 不做：不包含P1文本闭环，不购买服务或生产发布。
- 允许目录/文件：`plugins/knowledge/`、`apps/product-web/plugins/knowledge.mjs`、`apps/control-api/src/product.mjs`、`tools/nuochong-cli/src/`、`tools/nuochong-cli/test/`、`apps/control-api/test/`。
- 交付：代码/迁移/接口与CLI/自动化测试/PR；人工验收及发布单列。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 真实合成音视频/扫描夹具通过供应商集成，时间码/页框可核验；无凭据则Blocked。
- [ ] 外部写结果不确定不得盲目重试；费用未知明确unknown；恢复、清理和外部数据边界有证据。
- [ ] P2负责人批准才进入试点；不复用P1验收冒充媒体已交付。

### KBV2-13 能力运营、排期与跨产品知识快照设计

- 主责：ChatGPT；负责人确认；优先级：P2；波次：P2。
- 状态：Planned；依赖：KBV2-11；Issue：[#118](https://github.com/insanetoto/nuochong-page/issues/118)。
- 范围：细化排期执行复核、消费者注册/撤销/配额、导出事件和培训快照，复用公共权限。
- 不做：不默认开发连接器或培训模块，不改变消费者不限产品级白名单的已确认方向。
- 允许目录/文件：`docs/product/`、`docs/refactor/`、`docs/adr/`。
- 交付：设计/契约/决定/任务证据；不提交运行代码。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 版本化命令/schema/CLI、权限/审批/幂等与取消错误矩阵齐全。
- [ ] 排期时与执行时分别验权；消费者注册不等于授权；撤回通知和读路径实时失效分别规定。
- [ ] 培训复核不无声改变历史成绩；形成单独实现任务，不将本设计算上线。

### TOOL-01 首个企业AI工具产品方案

- 主责：ChatGPT；负责人确认；优先级：P1；波次：Parallel design。
- 状态：Planned；依赖：PLAN-01；Issue：[#119](https://github.com/insanetoto/nuochong-page/issues/119)。
- 范围：选择一个首发办公痛点，定义工具输入输出、权限、副作用、审批与产物。
- 不做：不写工具产品代码，不开放任意shell，不提前授权外部写入。
- 允许目录/文件：`docs/product/`、`docs/refactor/`、`docs/adr/`。
- 交付：设计/契约/决定/任务证据；不提交运行代码。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 使用者/输入样例/成功指标/非目标清楚，限定一个MVP。
- [ ] 形成版本化工具/运行/产物契约与失败恢复；公共身份/任务/模型能力不重复建设。
- [ ] 列实现子任务、依赖和验收；仅使用知识时依赖已发布知识契约，不等待全知识库完成。

### LEARN-01 培训考试首期产品方案

- 主责：ChatGPT；负责人确认；优先级：P1；波次：Parallel design。
- 状态：Planned；依赖：PLAN-01；Issue：[#120](https://github.com/insanetoto/nuochong-page/issues/120)。
- 范围：冻结课程/题库/学习/考试/成绩流程和知识引用边界。
- 不做：不编写培训运行代码，不恢复旧培训演示。
- 允许目录/文件：`docs/product/`、`docs/refactor/`、`docs/adr/`。
- 交付：设计/契约/决定/任务证据；不提交运行代码。
- 命令引用：内部/设计/联合验收，无独立新增命令；具体服务引用随契约表。

验收标准：

- [ ] 确定性客观评分、主观人工确认、服务端计时、交卷幂等与成绩权限规则完整。
- [ ] 课程引用批准的知识快照；撤回触发复核但不自动篡改历史成绩。
- [ ] 给出领域数据/版本化命令/CLI/页面设计与实现子任务，不重复人员主库。

## 5. 领取、提交与状态

负责人已授权本轮批量登记，20项Issues均已创建，见[登记与核对记录](issue-registration.md)。创建不再等待PLAN-03，也不等于实施Ready。PLAN-03继续补齐实际成员、预审、负责人、设计版本、集成SHA、共享文件责任、依赖验收及实施授权，然后逐项领取；无需再次审批同一登记动作。

DeepSeek领取后用独立分支/目录实现；发现设计缺口先交ChatGPT修订，不自行改变页面/交互/权限语义。提交提供“批准设计→实现→schema/CLI→成功/负例→CI→预审”矩阵，真实模型和合成故障、Linux和macOS证据分别记录。

状态为Planned → Ready（批准与依赖齐）→ In progress → In review → Implemented → Accepted（负责人确认）→ Released（独立发布记录）。设计原型Accepted与实现任务Accepted分开；工程合并不能冒充产品验收。PR目标refactor/integration，main/test无发布授权不得推送。

原47–75工程人日含历史范围，未涵盖本次全部UI/治理调整，不再用于新版排期。PLAN-01/02后由DeepSeek按最终范围评估，负责人配置人员，再制定日历计划。当前不承诺虚构完成日期。

R1最新准入以[验收与固定基线](w0/r1-acceptance-2026-11-08.md)为准；#104只依赖#103的R1子出口，不等待父Issue关闭。其余任务不据此跳过完整前置。
