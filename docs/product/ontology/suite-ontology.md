# 产品套件本体：类、关系与现有模型映射

2026-11-02 · 设计稿 v1 · **planned**。本文是 [本体方法论](README.md) 的类与关系清单，覆盖三产品共享层，并把知识库 v2 映射到现有 PostgreSQL 模型。AI 工具与培训只登记类/关系草案，具体功能后续独立设计；本文不授权实现。

## 1. 命名空间

| 命名空间 | 归属 | 首期状态 | 说明 |
| --- | --- | --- | --- |
| `nc:` | 平台 | 设计 | 上层类，跨产品最小共识 |
| `nc.org:` | organization 插件 | 已实现（数据） | 部门、成员、最小人员目录 |
| `nc.access:` | access-management 插件 | 已实现（数据） | 角色、绑定、范围、审批 |
| `nc.kb:` | knowledge 插件 | 部分实现 + v2 扩展 | 空间、来源、条目、片段、关系、发布 |
| `nc.tool:` | enterprise-tools 插件 | 仅草案 | 工具、版本、运行、产物 |
| `nc.learn:` | learning 插件 | 仅草案 | 课程、题目、考试、成绩 |
| `nc.ext:` | 租户扩展 | 后续 | 企业自定义分类/标签，不改安全语义 |

命名空间一旦发布不可复用；产品 manifest 必须声明 `ontology.namespace`、`ontology.version`、`apiMajor`，加载器拒绝未登记命名空间、重复类 ID 与不兼容 major。

## 2. 上层类（`nc:`）

| 类 | 定义 | 关键属性 | 关键关系 | 现有落地 |
| --- | --- | --- | --- | --- |
| `Organization` | 公司主体（单公司部署） | id、name、status | owns Department / Resource | 部署配置；未建组织主表（planned） |
| `Department` | 部门树节点 | id、name、parentId、active、revision | memberOf、parentOf | `product_departments` |
| `Person` | 公司人员最小目录 | personId、displayName、status | memberOf Department、holds Role | `principals` + `product_members` |
| `Principal` | 可认证主体（人/服务） | principalId、kind、status、epoch | actsAs Person、holds Credential | `principals`、`credentials` |
| `Role` | 权限模板 | roleId、productId、permissions、revision | grantedBy Grant | `product_roles` |
| `Grant` | 角色在范围内的授予 | grantId、subject、roleId、scopeId、validity、approvalRef | scopedTo Resource、approvedBy Approval | `product_bindings` |
| `Resource` | 可授权/可引用对象 | id、type、owner、aclRef、revision | partOf Space、derivedFrom Source | 各产品表 + `knowledge_*` |
| `ResourceScope` | 授权范围 | scopeId、type、ref | contains Resource | `product_bindings.scope_id`（`*` 或空间 ID） |
| `Activity` | 可追踪活动 | id、kind、status、actor、idempotencyKey | produces Artifact、consumes Resource | `product_jobs`、`runs` |
| `Job` | 持久任务 | jobId、kind、state、attempt、lease | partOf Activity、emits Event | `product_jobs`、`product_job_events` |
| `Artifact` | 不可变产物 | id、hash、mediaType、objectKey、revision | derivedFrom Resource | `knowledge_objects`、对象存储 |
| `Evidence` | 可核验依据 | evidenceId、locator、excerptHash、sourceRef | supports Claim/EntryRevision | `knowledge_evidence`、`knowledge_fragments`（v2） |
| `Approval` | 显式审批 | approvalId、commandId、targetHash、scope、approver、expiresAt | approves Activity | `product_approvals` |
| `Publication` | 条目的发布记录 | publicationId、entryId、revisionId、effectiveAt、approvalHash | publishes Revision | `knowledge_publications` |
| `PublicationSnapshot` | 空间能力快照 | snapshotId、spaceId、entryRevisionRefs、sourceRefs、effectiveAt、validityEpoch | snapshots Publication、exposes Capability | `knowledge_publication_snapshots`（v2） |
| `Capability` | 对外能力 | capabilityId、version、status、contractRef | exposedBy Snapshot、consumedBy Consumer | `knowledge_capabilities`（v2） |
| `Event` | 领域事件 | eventId、type、resourceRef、revision | emittedBy Activity | `product_outbox` |
| `AuditRecord` | 审计记录 | actor、action、resource、result、time | — | `audit` |

## 3. 共享关系

| 关系 | 从 → 到 | 基数 | 语义与约束 | 证据要求 |
| --- | --- | --- | --- | --- |
| `memberOf` | Person → Department | N:M | 支持多部门；调岗同事务替换有效期；停用不删历史 | 组织变更审计 |
| `parentOf` | Department → Department | 1:N | 禁止环；默认不继承子树授权 | 组织审计 |
| `holdsRole` | Person/Principal → Grant | 1:N | 绑定必须有 scope；跨产品逐产品授予 | 审批/审计 |
| `scopedTo` | Grant → ResourceScope | N:1 | 范围必须存在且有效；部门范围默认固定 ID 列表 | 授权审计 |
| `produces` | Activity → Artifact | 1:N | 产物不可变；hash 校验 | 任务记录 |
| `derivedFrom` | Artifact → Resource | N:1 | 必须能回溯到来源修订 | 来源定位 |
| `supports` | Evidence → EntryRevision | N:M | 发布时至少一条有效证据；撤回传播 | 片段/引用 |
| `publishes` | Publication → EntryRevision | 1:N | 每个条目仅一个当前发布修订；CAS 切换 | 审批 hash |
| `snapshots` | PublicationSnapshot → Publication | N:M | 快照不可变；空间仅一个当前快照；重建/回滚创建新快照 | 发布 manifest |
| `exposes` | PublicationSnapshot → Capability | 1:N | 能力只读当前快照；不绕过 ACL | 发布 manifest |
| `emittedBy` | Event → Activity | N:1 | 事件幂等；不含全文/凭据 | 事件 ID |

## 4. 知识库扩展（`nc.kb:`）

### 4.1 类

| 类 | 定义 | 关键属性 | 生命周期 |
| --- | --- | --- | --- |
| `KnowledgeSpace` | 业务知识域容器 | id、code、title、domainType、departmentIds、settings、status | active → archived；有发布内容不可硬删 |
| `SourceDocument` | 逻辑来源（一份制度/文件） | id、spaceId、policyCode、currentRevisionId | 持续存在；修订递增 |
| `SourceRevision` | 不可变来源版本 | id、documentId、version、mediaType、objectHash、validFrom/Until、issuer、aclRef | active → superseded/withdrawn |
| `SourceFragment` | 可定位的来源片段 | id、revisionId、locatorType、locator、textHash、excerptRef、confidence、extractor | extracted → pending → accepted/rejected/superseded |
| `KnowledgeEntry` | 稳定知识条目身份 | id、spaceId、entryType（policy/topic/faq/entity）、title、conceptIds | draft → pending_review → reviewed → published → withdrawn/superseded |
| `EntryRevision` | 条目不可变版本 | id、entryId、revision、bodyHash、sourceRefs、generatorVersion | draft（可变）→ reviewed（不可变）→ published |
| `Concept` | 主题/术语/分类节点 | id、spaceId、prefLabel、altLabels、parentId、scheme | active → deprecated |
| `EntryRelation` | 条目间具名关系 | id、spaceId、fromEntryId、toEntryId、type、weight、reason、evidenceIds、status | draft → reviewed → published；可失效 |
| `ReviewDecision` | 审校结论 | id、targetRevisionId、decision、reason、reviewer、revision | 不可变 |
| `ImportBatch` | 一次导入作业 | id、spaceId、source、status、counts、createdBy | created → parsing → completed/partial/failed/cancelled |
| `ImportFile` | 批次内文件 | id、batchId、filename、mediaType、size、hash、status、failureCode | uploaded → validated → parsing → parsed/failed/quarantined |
| `CapabilityBinding` | 快照暴露的能力 | snapshotId、capabilityId、scope、status | enabled → disabled/revoked |

### 4.2 关系

| 关系 | 从 → 到 | 基数 | 语义与约束 |
| --- | --- | --- | --- |
| `belongsToSpace` | SourceDocument / KnowledgeEntry / Concept → KnowledgeSpace | N:1 | 首期禁止跨空间证据引用；跨空间条目关系允许（双方可见），无需新 ADR |
| `hasRevision` | SourceDocument → SourceRevision、KnowledgeEntry → EntryRevision | 1:N | 修订不可变；版本号单调 |
| `extractedFrom` | SourceFragment → SourceRevision | N:1 | 必须有 locator；无 locator 的片段只能人工创建并标记 |
| `cites` | EntryRevision → SourceFragment | N:M | 发布前逐条重新验权/有效期；引用必须逐字匹配片段范围 |
| `about` | KnowledgeEntry → Concept | N:M | 至少一个概念才进入“主题”视图；概念层级无环 |
| `relatedTo` | KnowledgeEntry ↔ KnowledgeEntry | N:M | 必须带 reason 与 weight；允许跨空间，展示时按双方权限过滤 |
| `supersedes` | EntryRevision → EntryRevision | 1:N | 仅同一条目；不得跨空间 |
| `conflictsWith` | KnowledgeEntry ↔ KnowledgeEntry | N:M | 必须有证据片段；不能由模型自动裁定优先级 |
| `reviewedBy` | EntryRevision → ReviewDecision | 1:N | 审批 hash 绑定正文+引用+范围 |
| `publishedAs` | EntryRevision → Publication | N:M | 发布快照不可变；回滚创建新发布记录 |
| `exposesCapability` | Publication → CapabilityBinding | 1:N | 只有已发布快照可暴露能力 |

`EntryRelation` 的相关/冲突关系以条目为端点，并有不可变关系修订。`supersedes` 独立使用修订级替代记录，两端指向 EntryRevision，不存入禁止条目自指的 knowledge_relations。发布快照封存 relationRevisionRefs、conceptRevisionRefs、assignmentRevisionRefs、supersessionRefs 与 graphHash；当前可变候选不影响现行图谱，历史重建始终叠加当前授权/有效性裁剪。具体表见 [v2契约](../knowledge/v2/contracts.md)。

### 4.3 约束（必须可测试）

| ID | 约束 | 负例 |
| --- | --- | --- |
| KB-C1 | 空间 `code` 在公司内唯一、不可变 | 重复创建返回 `CONFLICT` |
| KB-C2 | 同一空间内 `policyCode + version` 唯一 | 重复导入返回 `SOURCE_VERSION_EXISTS` |
| KB-C3 | 已发布修订至少一个有效片段且引用可定位 | 无证据发布返回 `EVIDENCE_REQUIRED` |
| KB-C4 | 跨空间证据引用拒绝；跨空间条目关系允许，但仅双方空间可见时返回 | 证据引用返回 `CROSS_SPACE_REFERENCE`；关系查询裁剪 |
| KB-C5 | 每个条目仅一个当前发布修订；空间仅一个当前能力快照；CAS 切换 | 并发发布仅一个成功，另一个 `VERSION_CONFLICT` |
| KB-C6 | 来源撤回/过期/ACL 收紧立即失效依赖条目 | 撤回后读取返回 `EVIDENCE_CHANGED` |
| KB-C7 | 概念层级与部门树无环 | 成环写入拒绝 |
| KB-C8 | 条目关系禁止相同entryId自指；supersedes须同条目不同revisionId，禁止同修订自指/逆序/成环 | 拒绝非法端点；同条目新修订替代旧修订允许 |
| KB-C9 | 默认审校人 ≠ 发布人；单人/演示空间可显式豁免并审计 | `APPROVAL_REQUIRED` |
| KB-C10 | 片段 locator 在同一修订内唯一 | 重复解析幂等或拒绝 |

## 5. 工具与培训扩展（仅草案）

| 命名空间 | 类 | 关系 | 状态 |
| --- | --- | --- | --- |
| `nc.tool:` | `Tool`、`ToolVersion`、`ToolInputSchema`、`ToolRun`、`ToolArtifact`、`ToolApproval` | usesVersion、runBy、produces、approvedBy、readsKnowledgeSnapshot | 后续设计 |
| `nc.learn:` | `Course`、`Module`、`Lesson`、`QuestionBank`、`Question`、`Assessment`、`ExamAttempt`、`Score`、`Competency` | contains、drawsFrom（发布知识快照）、assesses、attemptedBy、scoredBy | 后续设计 |

关键约束预先声明，避免后续设计与知识库冲突：

- 培训课程只能引用**已发布知识快照**，不能引用草稿；制度撤回后课程标记待复核，不自动改历史成绩。
- 工具运行可以读取知识快照用于回答，但“读取知识”不等于“获得业务写权限”；外部副作用必须单独审批。
- 题目与成绩属于独立资源，不因知识发布人权限而自动可见。

## 6. 与现有模型的映射

| 本体 | 现有表/字段 | 状态 | v2 变更 |
| --- | --- | --- | --- |
| KnowledgeSpace | `knowledge_spaces(id,title,department_ids,revision)` | 已实现 | 增加 `code`、`domain_type`、`settings`、`status`（迁移，planned） |
| SourceDocument | `knowledge_documents(id,space_id,policy_code,...)` | 已实现 | 保持；作为逻辑来源 |
| SourceRevision | `knowledge_sources(id,document_id,version,...)` | 已实现 | 增加 `media_type`、`extractor_version`（可选） |
| SourceFragment | — | **planned** | 新表 `knowledge_fragments` |
| KnowledgeEntry | `knowledge_pages(id,space_id,published_revision_id,...)` | 已实现 | 语义映射为条目；增加 `entry_type`；不改表名 |
| EntryRevision | `knowledge_revisions(id,page_id,page_revision,...)` | 已实现 | 保持；引用改为片段 ID（兼容旧行号） |
| Concept | — | **planned** | `knowledge_concepts`、`knowledge_entry_concepts` |
| EntryRelation | — | **planned** | `knowledge_relations` |
| Evidence | `knowledge_evidence(revision_id,source_id)` | 已实现 | v2 增加 `fragment_id`（可空，兼容旧数据） |
| Publication | `knowledge_publications(...)` | 已实现 | 保持条目发布记录；增加 `approval_hash`/effective 语义（planned） |
| PublicationSnapshot | — | **planned** | `knowledge_publication_snapshots`（空间当前能力快照） |
| Capability | — | **planned** | `knowledge_capabilities`、`knowledge_capability_bindings` |
| ImportBatch/File | — | **planned** | `knowledge_import_batches`、`knowledge_import_files` |
| Job | `product_jobs`、`product_job_events` | 已实现 | 新增 kind `knowledge.import.parse`；复用租约/取消 |
| Approval | `product_approvals` | 已实现 | 发布/导入审批复用；不新增旁路 |

**兼容策略**：不重命名 `knowledge_pages` / `knowledge_revisions`，避免破坏 v0 已部署数据；v2 以“条目”作为产品术语，数据库继续使用 page 命名，契约层用 entry 语义并在迁移中提供视图。旧行号引用与 v2 片段引用并存，读取时统一解析为片段定位。

## 7. 端到端示例

### 7.1 一条制度从视频到能力

```text
ImportBatch B1
  └─ ImportFile F1 (video/mp4, hash ...)
       └─ Job J1 (knowledge.import.parse)
            ├─ Extractor ASR@1.0 → transcript
            ├─ SourceRevision R3 (immutable, validFrom 2026-01-01)
            └─ SourceFragment S1 (00:12:30–00:13:10, excerpt)
KnowledgeEntry E1 "年假制度" (policy)
  └─ EntryRevision V4 (body cites S1; reviewed)
       └─ Publication P1 (entry revision v4, effectiveAt 2026-02-01)
            └─ PublicationSnapshot S1 (space current snapshot)
                 ├─ Capability search@1
                 ├─ Capability answer@1
                 └─ Capability graph@1
```

来源 R3 撤回 → P1 失效 → 搜索/问答/图谱返回 `EVIDENCE_CHANGED`，培训课程标记“依据待复核”。

### 7.2 工具与培训的引用边界

```text
ToolRun T1 --readsKnowledgeSnapshot--> P1   （只读，不获得写权限）
Course C1 --drawsFrom--> P1                 （快照，不跟随草稿）
Question Q1 --assesses--> Competency K1
ExamAttempt A1 --scoredBy--> Score         （确定性评分 + 人工评阅）
```

## 8. 版本与迁移

- 本体版本与产品 API 版本独立；知识库 v2 声明 `ontology.version = 1.1.0`（minor，新增片段/概念/关系/能力）。
- v0 → v2 为**增量迁移**：新增表与可空列；旧条目按需回填片段（段落切分）；旧引用保留行号定位，读取时映射到片段。
- 回填任务可重跑、幂等；未回填条目不阻塞读取，但发布新版本要求片段证据。
- 破坏性变更（如强制片段证据）先以“新发布要求”生效，不追溯改写历史修订。

## 9. 已确认与未决

2026-11-08 已确认：ASR/OCR 由外部大模型适配器提供（测试阶段只用 DeepSeek 对文本类来源做识别/结构化）；允许单人/演示空间显式开启自批发布豁免；允许空间显示名改名（编码不可变）；允许跨空间条目关系（证据引用仍限同空间）；能力消费者不设产品级白名单/数量上限；v0 片段按段落回填。

仍未决：
1. 概念体系由谁维护（空间负责人/知识运营/平台），是否需要跨空间共享概念库。
2. 关系抽取是否允许模型自动建议并默认待审；首期建议仅人工+编译建议。
3. 外部大模型供应商、区域、保留期、成本与合规（方向已定）。
4. 是否需要租户自定义分类；若需要，先做非安全语义的受控扩展。
5. 跨空间证据引用何时开放；当前只允许关系边。
