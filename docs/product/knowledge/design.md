# 企业知识库：产品与技术详细设计

2026-11-01 · v1 · planned，方案建议；默认值均可在下一轮调整。

## 1. 目标、范围和成功标准

让全体员工在有权限的范围内找到、理解并核验当前制度，让内容负责人可持续维护知识，并向 AI 工具、培训和外部系统提供可追溯的知识服务。首期聚焦规章制度，不做通用网盘、全自动制度裁决、自动审批或开放互联网采集。

首期闭环：提交来源 → 安全解析 → LLM 编译知识变更集 → 人工审校 → 定时/立即发布 → 员工浏览/检索/引用问答 → 纠错和维护 → 修订/撤回。演示可用合成制度，真实资料导入单独留痕。

建议试点目标：100 份来源、300 个知识页、5 并发问答；50 道人工标注问题中可回答问题检索 Recall@5 ≥ 90%，正确且有充分依据的答案 ≥ 90%，引用版本/位置可定位率 100%；20 道无依据/冲突问题全部给出不确定说明或冲突提示。跨权限泄漏 0；接口负例必须全部通过。搜索 P95 ≤ 2 秒、首个答案事件 P95 ≤ 8 秒是待实测的目标，不是既有性能保证；模型/网络失败分开报告，不用低延时替代正确性。

## 2. 用户、角色和权限

| 角色 | 可做 | 默认不可做 |
| --- | --- | --- |
| 员工 reader | 浏览/搜索授权的当前发布知识、查看来源、问答、提交纠错 | 草稿、他人私有问答、发布、密钥/插件管理 |
| 内容维护 editor | 管理指定空间来源、触发编译、编辑候选变更、处理反馈 | 自动取得发布权或扩大来源可见范围 |
| 审核 reviewer | 审查指定空间内容、引用、冲突与差异 | 通过未获授权的来源扩大 ACL |
| 发布 publisher | 对通过审核的快照发布/排期/撤回 | 绕过版本 CAS 和审批、把 AI 解读变成原始制度 |
| 系统管理员 | 身份、配置、插件、运行保障和备份 | 默认读取所有内容或代行制度发布 |
| 集成身份 | 以受限空间/命令/有效期执行导入或读取 | 继承调用者以外的身份、通用数据库或 dsh owner 访问 |

身份来自服务端；空间授权再与单资源权限取交集。初期允许“全员可见空间”，但不能把所有文件默认设为全员公开。内容发布与可见性放宽是两个独立审批动作。角色可以由负责人明确分配给同一人，但系统不能自批；审核针对不可变变更集 hash，修改后需重审。当前共享管理员演示账号只用于合成数据体验，不能用于真实员工权限验收。

### 共享组织与权限的复用

上述角色是知识库的产品角色模板，不在知识库内另建部门、人员和授权系统。人员与部门来自 `organization`，公司主体来自 `identity-company`，角色和范围绑定由 `access-management` 管理；知识库只维护空间/来源 ACL、发布约束和来源权限交集。公共目录选择器及“组织与权限”入口来自共享插件，详见 [统一设计](../shared-access/design.md)。IAM-03 负责公共授权，KB-03 负责知识资源策略，两者职责不重复。

## 3. LLM Wiki 的企业适配

[原始 LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)提供持续维护知识的思想：原始来源不变，模型编译互链 Wiki，通过 ingest/query/lint 积累知识。以下是本项目设计，不宣称为外部项目现成能力。

```text
knowledge-workspace/                 # 按任务和授权快照临时生成，不共享裸目录
  schema/knowledge-schema.md         # 受信任的页面约定、引用格式与编译规则
  raw/<sourceId>/<revisionId>/        # 只读来源和规范化片段
  wiki/index.md                     # 当前授权快照的目录，不是全公司目录
  wiki/policies/<pageId>.md          # 制度解读
  wiki/topics/<pageId>.md            # 请假/报销/信息安全等主题
  wiki/faqs/<pageId>.md              # 审校后的常见问题
  wiki/entities/<pageId>.md          # 术语/组织职责；非 HR 人员档案
  wiki/log.md                       # 脱敏变更摘要；不可代替权威审计
  changes/<changeSetId>/             # 编译候选输出及引用/影响清单
```

导出的 Markdown 包含稳定 ID、pageType、title、revision、sourceRefs、关联链接和生成来源标记，不包含可直接信任的授权声明或密钥。导入 Markdown 的 ACL 以服务端导入身份重新计算，不能信任 frontmatter 自报的权限。

### 三个核心操作

- **Ingest**：固定来源修订/hash 和编译器/规则/模型版本，解析为带定位片段；生成来源摘要、主题/制度/术语页候选 diff、引用边和影响范围。校验 schema、来源引用、ACL 和死链；生成变更集供人工审校。只影响依赖图上的页面，不能静默重写整个库。
- **Query**：先构造授权且当前有效的发布快照，按目录/元数据/中文检索读取 Wiki 和必要原文；返回答案与逐项引用。不直接持久化为正式知识；“沉淀为知识”创建独立待审变更。普通员工可提交建议，无 editor 权限不能直接编译或写入。
- **Lint**：确定性检查死链、来源缺失、版本和过期；LLM 提示语义冲突/重复/知识空白。报告含严重性和证据，自动阻止缺引用/失效依据发布；语义告警由归口人处理，模型不能自行裁定两份制度谁优先。

### 多来源权限和失效

同一页组合来源 A/B 时，可见者为 page ACL ∩ A ACL ∩ B ACL，而非并集；若同页不同段需要不同权限，首期拆页，避免页面标题、链接计数、摘要或目录泄漏。引用和附件下载再验权。来源撤回、权限收紧或当前版本变化时，同一事务更新 validityEpoch 和依赖失效标记；读路径实时过滤旧依据，不等待后台重编译。缓存绑定 actor/授权版本/发布快照/validityEpoch；搜索片段、事件、引用和导出均复查。

查询固定 `asOf` 与发布快照，但发送给用户前重新验证来源和授权 epoch；期间发生撤回/撤权则丢弃未发送答案并返回 `EVIDENCE_CHANGED`。已流出的文字无法追回，优先使用进度 SSE + 最终整段答案；若后续启用逐 token 输出，须专项评审此限制。状态不得把失效答案记为成功可引用。

## 4. 功能清单

| 模块 | MVP | 后续 |
| --- | --- | --- |
| 空间与目录 | 空间、分类、主题/制度/FAQ、权限摘要、负责人 | 多语言、个性推荐、跨知识域 |
| 来源管理 | 文本 PDF、DOCX、MD/TXT 上传；编号、归口、版本、有效期、原文预览/下载、hash 去重 | OCR、图片/扫描件、多媒体、真实厂商同步 |
| 导入编译 | 异步解析、预览、重试/取消、增量编译、可审校 diff、引用校验 | 更多解析器与布局恢复插件 |
| 审校发布 | 候选/待审/退回/已审、发布快照、预约生效、撤回、受控回滚 | 业务指定的多级审核 |
| 浏览搜索 | 中文查询、分类/有效期/类型筛选、来源定位、关联页和版本 | 通过评测后再加向量/重排索引插件 |
| AI 问答 | 私有问答历史、依据不足/冲突提示、引用卡片、停止跟随与明确取消、纠错 | 批准的问答沉淀、跨系统业务解释 |
| 质量维护 | 死链/过期/冲突队列、来源更新影响图、处理记录 | 自动建议补充来源，不自动网搜发布 |
| 集成运营 | REST、CLI、受限 MCP、签名 Webhook、同步台账、审计、任务重试/补偿 | 首个选定厂商连接器、SSO/SCIM |

扫描件或解析失败明确转人工处理，不能生成空正文后假装导入成功。首期不提供任意 URL 抓取；外部导入先用受限机器身份推送。未来拉取连接器必须有目标白名单、大小/时限/重定向限制及 DNS/IP 校验，禁止云元数据和内网越权抓取。

## 5. 数据模型和生命周期

| 实体 | 核心字段/约束 |
| --- | --- |
| KnowledgeSpace | id、名称、ownerGroup、ACL、policyVersion |
| Source / SourceRevision | stableId、externalId、checksum、mediaType、objectKey、issuer、policyCode、version、validFrom/Until、ACL；修订不可变 |
| SourceSegment | revisionId、segmentId、page/heading/paragraph/offset、textHash；引用定位用稳定片段，不仅依赖全文模糊匹配 |
| WikiPage / WikiRevision | id、pageType、slug、标题、bodyObjectKey/hash、schemaVersion、sourceRefs、generatorVersion；修订不可变 |
| EvidenceEdge | wikiRevision/answer → sourceRevision+segment；用于授权交集、失效传播及影响分析 |
| CompileJob | 来源快照、baseRevision、idempotencyKey、attempt、fencingToken、状态、模型/规则版本和用量 |
| ChangeSet / Review | 页面 diff、依赖/ACL 差异、baseSnapshot、hash、reviewer、decision、reason |
| Publication | snapshotId、pageRevisionRefs、sourceRefs、effectiveAt、validityEpoch、approvalHash、状态；CAS 更新发布指针 |
| Answer / Feedback | 私有 actorId、questionRef、snapshot、引用、状态、模型/用量、反馈；原始问题不写普通日志 |
| Connector / SyncCursor / Inbox / Outbox | 受限身份、来源映射、外部版本、投递/去重状态；不存明文密钥在事件 |

来源的“接收/隔离/解析就绪/替代/撤回”与知识页“草稿/待审/已审/排期/已发布/失效/归档”分开。作业状态复用现有持久任务契约：queued/running/cancelling/succeeded/failed/cancelled，不另造前端权威状态。拒绝请求不产生编译写入；202 只表示受理。

发布在一个数据库事务内核验审批 hash、来源有效性和 baseSnapshot，CAS 切换 manifest，并写入 outbox；对象先按内容 hash 上传并校验，未提交对象可延时垃圾回收。并发更新返回 `VERSION_CONFLICT`，不得 last-write-wins。同一幂等键+输入 hash 返回同一任务；相同键不同输入返回 `IDEMPOTENCY_CONFLICT`。Worker 过租约不能提交过期结果。失败留草稿和诊断，不改变现行发布版本。

未来生效制度不提前当成现行依据；缺少优先级依据的冲突进入待处理。回滚创建新发布记录，重新验证来源/ACL/有效期，不把过期版本直接恢复成现行。

## 6. 检索和回答

MVP 采用 PostgreSQL 元数据过滤 + 中文分词/检索索引插件 + Wiki 链接扩展，中文“请假/休假/事假”需用真实分词和同义词评测；不能仅启用 PostgreSQL 默认英文全文配置就宣称中文检索完成。必要时使用 trigram 辅助短语召回，不能保证所有语义命中。未达质量目标时评测 pgvector/重排插件，再决定引入，索引全部可从权威内容重建。

流程：服务端授权 → 当前发布/日期过滤 → 空间内召回 → 证据集校验 → Harness 只读知识工具 → 答案结构校验 → 再验权与有效期 → 返回。模型没有裸目录、数据库和任意 shell；来源中的“忽略指令/调用外部接口”视为数据，不能覆盖可信 schema 或申请权限。编译任务工作区只读来源、写候选区，不包含服务器凭据。

答案 DTO：`answerId/status/text/citations[{pageId,wikiRevision,sourceId,sourceRevision,segmentId,locator,excerpt}]/snapshotId/asOf/warnings/usage`。无依据用 `insufficient_evidence`，冲突用 `conflict`；模型/网络失败用 failed，不编造成功回答。用量或费用不可测则 null/unknown，不记为 0。

## 7. 外部系统集成

| 接口面 | 约定 | 首期边界 |
| --- | --- | --- |
| REST / OpenAPI | `/api/v1/knowledge`、JSON Schema、cursor 分页、稳定错误码、requestId | 知识导入/查询/任务/发布接口定义先行 |
| CLI | `nuochong knowledge ... --json`，长任务 follow 输出 NDJSON | 与 Web 相同命令/授权/审批 |
| MCP | 从已实现能力白名单生成工具，不把 planned 命令注册成可用 | 读优先，写需调用者作用域与真实审批凭据 |
| Webhook | `knowledge.source.changed.v1`、`publication.published.v1`、`publication.withdrawn.v1`、`job.completed.v1`；eventId/time/schemaVersion/resourceRef | HMAC 签名+时间窗、防重放；事件不带全文，接收方受限拉取 |
| 导入/导出 | 原始文件+manifest；Wiki Markdown+引用/版本 manifest | 异步、受限下载、撤权即拒绝，导出不含凭据 |
| 厂商适配 | 标准 Connector 接口：fetchChanges/readRevision/mapIdentity/checkAcl/commitCursor | 企业微信/飞书/钉钉/SharePoint 等仅候选，首期不承诺已对接 |

外部写入身份绑定 integrationId + spaceId + command scopes；不信任请求里的 userId/roles。OAuth client credentials/OIDC 是后续推荐标准适配，首期可复用已交付可撤销受限服务凭据，不宣称 OAuth 已实现。`Idempotency-Key`、`If-Match` 及外部 stableId/version 贯穿导入；API 版本 major 不兼容时另开版本。

Outbox 至少一次投递，接收方 Inbox 按 eventId 去重，支持指数退避/死信/人工重放。同步顺序按资源版本与 cursor，迟到旧事件不覆盖新版本。上游删除或 ACL 收紧立即使下游依赖失效，后台重编译不得延迟读路径拒绝。未知远端写结果进入“待核对”，不盲目重试。外部推送/双向回写是不同权限；MVP 只导入与知识事件通知，不自动回写源系统正文。

## 8. 版本化能力设计

[命令设计清单](commands.json)是**计划契约**，独立于当前可执行能力清单；不得注册为 ready。ID 示例 `knowledge.sources.import.v1`。每项任务实现时必须交付完整 JSON Schema/OpenAPI、CLI/MCP 映射、错误样例和跨入口负例。下列公共约定属于建议，尚非在线协议。

- 所有请求/响应对象 `additionalProperties:false`，身份在认证上下文；资源 ID 稳定且服务端验权。
- 写命令必需幂等键，版本写必需 expectedRevision；审核/发布另有服务端 approvalId 和 hash 校验。CLI `--yes`/dry-run 不产生审批。
- 写入返回 `operationId/state`，流/轮询复用现有 jobs 契约；读取支持分页和最小字段。拒绝返回403/404按防枚举策略统一。
- 标准错误：`NOT_AUTHORIZED`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`INVALID_SOURCE`、`APPROVAL_REQUIRED`、`EVIDENCE_CHANGED`、`MODEL_UNAVAILABLE`、`QUOTA_EXCEEDED`。

## 9. 运维与验收

分别记录导入耗时、编译队列/失败、lint 阻断、查询质量、模型请求/用量、Webhook 延迟/死信；普通日志只记录操作 ID、状态、hash 与脱敏错误。备份包含数据库+对象 manifest，恢复后重建索引；对象 hash 和引用恢复一致，不仅检查数据库可连接。

测试使用合成制度（含冲突、未来/过期版本、两个密级、恶意提示、非法压缩包/超大文件、失败解析及引用漂移）。覆盖 5 并发查询、重复事件、任务强杀恢复、重放/取消、发布竞争、撤权中查询、源删除和恢复；性能报告注明硬件、样本和分位。产品验收、真实数据导入和生产 Go 分开记录。
