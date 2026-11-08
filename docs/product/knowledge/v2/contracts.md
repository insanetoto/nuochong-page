# 知识库 v2：数据模型、命令与权限契约

2026-11-02 · 设计稿 v1 · **planned**。本文给出 v2 的权威数据表、命令面、权限、状态与错误约定，供后续实现与评审使用。所有命令都是候选契约：**未实现前不得注册为 ready**；`docs/product/knowledge/commands.json` 中的旧规划信封不自动生效，实施时以评审后的完整 JSON Schema/OpenAPI 为准。

## 1. 数据模型

### 1.1 现有表（保持兼容）

| 表 | 角色 | v2 变化 |
| --- | --- | --- |
| `knowledge_spaces` | 知识空间 | 增加 `code`、`domain_type`、`settings`、`status`（增量迁移） |
| `knowledge_documents` | 逻辑来源 | 保持；`policy_code` 唯一性按空间 |
| `knowledge_sources` | 不可变来源修订 | 增加 `media_type`、`extractor_version`（可空） |
| `knowledge_pages` | 条目身份 | 语义映射为 `KnowledgeEntry`；增加 `entry_type` |
| `knowledge_revisions` | 条目修订 | 保持；引用逐步从行号迁移到片段 ID |
| `knowledge_evidence` | 修订证据 | 增加可空 `fragment_id`；旧数据保留 |
| `knowledge_reviews` | 审校记录 | 保持；补充条目/片段目标类型 |
| `knowledge_publications` | 条目发布记录 | 保持每条目发布；补充 effective/approval 字段（planned） |
| `knowledge_publication_snapshots` | 空间当前能力快照 | 新表；manifest、current 指针、validityEpoch |
| `knowledge_objects` | 对象元数据 | 媒体文件字节走对象存储适配器，表仍存 hash/引用 |
| `product_jobs` / `product_job_events` | 持久任务 | 新增 kind `knowledge.import.parse` |

### 1.2 新增表（planned）

**`knowledge_fragments`**

| 列 | 类型 | 约束 |
| --- | --- | --- |
| id | text PK | 稳定 ID |
| space_id | text FK | 与来源修订一致 |
| source_revision_id | text FK | 不可变来源 |
| locator_type | text | line/page/paragraph/timecode/frame/manual |
| locator | jsonb | 结构见导入设计；同修订内唯一 |
| excerpt | text | 限长；原文摘录，不改写 |
| text_hash | text | sha256；去重/漂移 |
| language | text | BCP-47 |
| confidence | numeric | 0–1；人工为 null |
| extractor | jsonb | kind/name/version/paramsHash |
| status | text | pending/accepted/rejected/merged/superseded |
| entry_id | text FK nullable | 归属条目 |
| created_by / created_at | text/timestamptz | 审计 |

**`knowledge_import_batches`**：id、space_id、created_by、status、file_count、success_count、failure_count、created_at、idempotency_key。

**`knowledge_import_files`**：id、batch_id、filename、media_type、size_bytes、object_hash、status、failure_code、fragment_count、entry_id、started_at、finished_at。

**`knowledge_concepts`**：稳定概念身份 id、space_id；标签、层级等内容进入 `knowledge_concept_revisions`（id、concept_id、revision、pref_label、alt_labels、parent_concept_revision_id、scheme、content_hash），封存修订不可更新。

**`knowledge_space_publication_policies`**：space_id、allow_self_publish（默认 false）、policy_revision、space_class、approval_ref、reason、updated_by；追加不可变策略历史。治理规则见来源管理 §2.4，不能通过普通 settings 写入。

**`knowledge_entry_concepts`**：稳定分配身份；新增不可变 `knowledge_entry_concept_revisions`（id、assignment_id、entry_revision_id、concept_revision_id、confidence、assigned_by、content_hash）。草稿修改创建新修订，发布绑定确切分配修订，不按最新概念内容替换历史。

**`knowledge_relations`**：稳定条目关系身份 id、space_id（所属发起空间）、from_entry_id、to_entry_id、type；仅接收 relatedTo/conflictsWith 等条目关系；两端 entryId 相同则拒绝，同类型同方向去重。跨空间写需发起空间 edit 且双方可读，不授予目标空间编辑权。

**`knowledge_relation_revisions`**：id、relation_id、revision、from_entry_revision_id、to_entry_revision_id、weight、reason、evidence_fragment_ids、content_hash、created_by、created_at。提交审校时封存，之后不可更新；修改生成新候选。跨空间关系由发起空间审批发布，目标必须是其空间当前有效发布修订；双方可见且目标修订仍有效才投影，目标换版后隐藏旧边并提示维护者复核，不自动重新绑定。

**`knowledge_revision_supersessions`**：id、space_id、new_revision_id、old_revision_id、publication_id；两端引用 knowledge_revisions，必须是同一条目的不同修订，禁止 new_revision_id=old_revision_id，禁止逆序与成环。由经过审批的发布事务派生，只读暴露，不接受 relations.upsert 手工写入；回滚使用新发布记录，不能反转 supersedes 边或改写历史。

**`knowledge_fragment_reviews`**：id、fragment_id、decision（accept/reject/merge/split/edit）、reason、reviewer_id、created_at。

**`knowledge_publication_snapshots`**：id、space_id、publication_ids（text[]）、entry_revision_refs（jsonb）、source_revision_refs（text[]）、relation_revision_refs（text[]）、concept_revision_refs（text[]）、assignment_revision_refs（text[]）、supersession_refs（text[]）、graph_hash、manifest（jsonb）、effective_at、validity_epoch、current（每空间仅一条 true）、created_at。

**`knowledge_capabilities`**：id（如 `knowledge.search@1`）、version、status、contract_ref、owner、description。

**`knowledge_capability_bindings`**：snapshot_id、capability_id、scope、status、consumer_ref、quota、last_seen_at。

消费者不设产品级白名单或数量上限（2026-11-08 确认）；但仍需注册、受限凭据、审计与撤销。`quota` 可空表示默认不限。

**索引建议**：fragments(space_id, source_revision_id, status)；relations(space_id, from_entry_id, type)；entry_concept_revisions(concept_revision_id)；import_files(batch_id, status)；publications(page_id, created_at)；publication_snapshots(space_id, current) 部分唯一索引。

### 1.3 迁移顺序（planned）

1. 新增可空列/新表（不锁旧路径）。
2. 回填空间 code（`SPACE-<8位>`）与默认 domain_type。
3. 按段落回填片段（已确认）：将 v0 来源文本按段落切分，行号映射到段落片段；旧引用保留行号兼容，回填幂等。
4. 回填条目类型（默认 `policy`）。
5. 双读验证：Web/CLI 读旧数据正常；新发布要求片段证据。
6. 不重命名、不删除旧列；回滚只需停用新写入路径。

## 2. 命令面

### 2.1 读命令

| commandId | 说明 | 权限 | 关键输入 | 输出 |
| --- | --- | --- | --- | --- |
| `knowledge.graph.query.v1` | 图谱节点/边/统计；支持多空间与跨空间关系 | `knowledge:read`；draft/管理层需 `knowledge:edit`/`review`/`publish` | spaceIds、types、relations、focusId、depth、asOf、limit | nodes、edges、stats、truncated、graphVersion |
| `knowledge.entries.list.v1` | 待审/管理/已发布条目 | `knowledge:read`（published）；`knowledge:edit`/`review`/`publish`（manage） | spaceId、view、status、after | items、nextCursor |
| `knowledge.entries.get.v1` | 条目 + 片段 + 草稿 | `knowledge:read`（published）；`knowledge:edit`/`review`/`publish`（manage） | spaceId、entryId、view | entry、revision、fragments、relations、citations |
| `knowledge.fragments.list.v1` | 待审/来源片段 | `knowledge:edit`/`review`（pending）；`knowledge:read`（已发布引用） | spaceId、status、sourceId、after | items、nextCursor |
| `knowledge.imports.list.v1` | 导入批次 | `knowledge:edit` | spaceId、status、after | items、nextCursor |
| `knowledge.imports.get.v1` | 批次 + 文件状态 | `knowledge:edit` | spaceId、batchId | batch、files |
| `knowledge.capabilities.list.v1` | 能力目录 | `knowledge:read`；管理视图需 `knowledge:publish` | spaceId、publicationId | items |
| `knowledge.spaces.get.v1` | 空间详情 | `knowledge:read`（统计只计可见集合） | spaceId | space、stats |

### 2.2 写命令（全部需幂等键；审批/版本按表）

| commandId | 说明 | 权限 | 副作用 | 幂等 | 审批 |
| --- | --- | --- | --- | --- | --- |
| `knowledge.spaces.create.v1` | 创建空间（扩展输入） | `knowledge:publish`（全局） | 创建空间/角色/审计 | 必须 | 是 |
| `knowledge.spaces.update.v1` | 修改显示名/范围/配额（编码不可改；禁止修改自批策略） | 空间负责人 + `knowledge:publish` | 更新 + outbox | 必须 | 范围放宽时 |
| `knowledge.spaces.publication-policy.set.v1` | 独立修改自批豁免，planned | 平台管理员 + 全局共享 `access:manage`，不赋予内容发布权 | 策略版本、失效旧审批、审计 | 必须 | 是；策略申请人不得自批 |
| `knowledge.spaces.archive.v1` | 归档空间 | 同上 | 状态 + 审计 | 必须 | 是 |
| `knowledge.imports.create.v1` | 创建导入批次 | `knowledge:edit` | 批次 + 任务 | 必须 | 否（导入不等于发布） |
| `knowledge.imports.cancel.v1` | 取消未完成文件 | `knowledge:edit` | 取消请求 | 必须 | 否 |
| `knowledge.imports.retry.v1` | 重试失败项 | `knowledge:edit` | 新任务/attempt | 必须 | 否 |
| `knowledge.fragments.review.v1` | 接受/退回/合并/拆分 | `knowledge:review` | 片段状态 + 审校记录 | 必须 | 否（计入审校） |
| `knowledge.entries.draft.v1` | 创建/更新条目草稿 | `knowledge:edit` | 修订草稿 | 必须 | 否 |
| `knowledge.entries.submit.v1` | 提交审校 | `knowledge:edit` | 状态 + hash | 必须 | 否 |
| `knowledge.changes.review.v1` | 审校决定（现有） | `knowledge:review` | 审校记录 | 必须 | 否 |
| `knowledge.publications.publish.v1` | 单条发布（现有扩展） | `knowledge:publish` | 条目发布 + 快照更新 + 能力 | 必须 | **是** |
| `knowledge.publications.publish-batch.v1` | 同空间批量发布 | `knowledge:publish` | 多条发布 + 一个空间快照 | 必须 | **是** |
| `knowledge.publications.schedule.v1` | 排期发布 | `knowledge:publish` | 计划任务 | 必须 | **是** |
| `knowledge.publications.withdraw.v1` | 撤回（现有） | `knowledge:publish` | 指针 + 失效 | 必须 | **是** |
| `knowledge.publications.rollback.v1` | 回滚为新发布 | `knowledge:publish` | 新快照 | 必须 | **是** |
| `knowledge.relations.upsert.v1` | 条目关系候选（不接收 supersedes） | 发起空间 `knowledge:edit`，双方可读 | 新候选关系修订，不改变现行图谱 | 必须 | 写候选不审批；纳入快照前审校/审批 |
| `knowledge.capabilities.set.v1` | 能力启停 | `knowledge:publish` + 平台管理员 | 能力状态 | 必须 | **是** |

治理命令输入 schema 草案（全部 planned，实施任务补齐完整 JSON Schema）：spaceId:string、allowSelfPublish:boolean、reason:string、expectedPolicyRevision:integer、idempotencyKey:string、approvalId:string，均必填且 additionalProperties:false；输出 spaceId、allowSelfPublish、policyRevision、requestId。身份从服务端上下文解析。CLI 映射为 `nuochong knowledge spaces publication-policy set --input - --json`，失败码包含 FORBIDDEN、APPROVAL_REQUIRED/APPROVAL_EXPIRED、VERSION_CONFLICT、IDEMPOTENCY_CONFLICT、INVALID_INPUT；拒绝无副作用。所有已登记为合格空间的启停均需独立审批，不能靠 --yes/dry-run 绕过。

### 2.3 任务命令（复用现有 jobs）

| commandId | 说明 |
| --- | --- |
| `knowledge.jobs.get.v1` / `list.v1` / `cancel.v1` / `events.v1` | 现有；导入任务复用同一状态机 |
| `knowledge.jobs.retry.v1`（planned） | 仅未产生副作用的失败任务可重试；未知结果需人工核对 |

### 2.4 通用约定

- 输入/输出 `additionalProperties:false`；身份来自认证上下文，客户端不能提交 userId/roles/ACL。
- 写命令必须 `idempotencyKey`；版本写必须 `expectedRevision`；审批使用服务端 `approvalId`，目标 hash 排除 `idempotencyKey` / `approvalId`。
- 分页 cursor 稳定；默认 100，最大 200；图谱单次最多 2,000 节点/5,000 边。
- 读命令返回 `requestId`；写命令返回 `operationId/state` 或资源。
- 禁止自动重试写请求；未知远端结果进入待核对。
- 未实现命令不进入 `capabilities` ready 清单；MCP 只暴露白名单。

## 3. CLI 映射

```bash
# 图谱
nuochong knowledge graph query --input '{"spaceIds":["space-hr"],"depth":1}' --json

# 导入
nuochong knowledge imports create --input - --json
nuochong knowledge imports get --input '{"spaceId":"space-hr","batchId":"b-1"}' --json
nuochong knowledge imports retry --input '{"spaceId":"space-hr","batchId":"b-1","fileIds":["f-2"]}' --json

# 片段审校
nuochong knowledge fragments review --input '{"spaceId":"space-hr","fragmentId":"frag-1","decision":"accept","expectedRevision":3}' --json

# 条目草稿/提交
nuochong knowledge entries draft --input - --json
nuochong knowledge entries submit --input '{"spaceId":"space-hr","entryId":"e-1","expectedRevision":5}' --json

# 发布/撤回/能力
nuochong knowledge publications publish --input - --json
nuochong knowledge publications withdraw --input - --json
nuochong knowledge capabilities list --input '{"spaceId":"space-hr"}' --json
nuochong knowledge capabilities set --input - --json
```

- 输入走 JSON/stdin，密钥/正文不放 argv；流式任务用 NDJSON。
- `--dry-run` 只做本地 schema 预检，不联系服务端、不检查真实权限。
- 不提供 `--yes`/`--force` 绕过审批；审批必须由服务端验证。

## 4. 权限与角色

| 角色（现有模板） | 权限 | v2 使用 |
| --- | --- | --- |
| knowledge-reader | `knowledge:read`、`knowledge:ask` | 首页图谱、搜索、问答、阅读 |
| knowledge-editor | + `knowledge:edit` | 空间内导入、片段草稿、条目组装 |
| knowledge-reviewer | + `knowledge:review` | 片段/条目审校 |
| knowledge-publisher | + `knowledge:publish` | 发布、撤回、能力启停、创建空间（全局） |

**权限收敛原则**：v2 不新增运行时权限字符串；若后续拆分 `knowledge:space:create`、`knowledge:capability:manage`，必须单独迁移、评审、更新 CLI/MCP，并保留旧角色兼容。`commands.json` 中出现的 `knowledge:space:read` 等仅作规划参考，不是当前授权名。

**自批策略**：知识角色不能变更豁免；共享 access:manage 与平台管理员身份的组合仅管理策略，不自动获得内容发布权。治理审批与内容审批分别验证，策略变化使旧内容审批失效。

**范围**：角色绑定 `scope_id` 为空间 ID 或 `*`；读取时空间可见范围与来源 ACL 取交集；管理员不自动获得内容发布权；默认审校人 ≠ 发布人，单人/演示空间可显式豁免并审计。

## 5. 状态机

```text
ImportFile: uploaded → validated → parsing → parsed | failed | quarantined | cancelled
Fragment:   pending → accepted | rejected | merged | superseded
Entry:      draft → pending_review → reviewed → published → withdrawn | superseded
Publication:draft_plan → approved → scheduled → published → withdrawn | superseded
Snapshot:   building → current | superseded | invalidated
Capability: planned → draft → active → degraded → revoked
Job:        queued → running → succeeded | failed | cancelled（复用现有）
```

状态转换均写审计；非法转换返回 `CONFLICT`，不静默覆盖。`stale` 是发布后依据失效的派生状态。

## 6. 错误码

| 错误码 | HTTP | 场景 |
| --- | --- | --- |
| `INVALID_INPUT` | 400 | schema/枚举/引用格式错误 |
| `UNAUTHORIZED` | 401 | 未认证/凭据失效 |
| `FORBIDDEN` | 403 | 无权限（不泄漏资源存在） |
| `NOT_FOUND` | 404 | 无权或不存在统一处理 |
| `CONFLICT` / `VERSION_CONFLICT` | 409 | 版本/状态冲突 |
| `IDEMPOTENCY_CONFLICT` | 409 | 同键不同输入 |
| `SOURCE_VERSION_EXISTS` | 409 | 来源版本重复 |
| `EVIDENCE_REQUIRED` | 422 | 无有效片段/引用 |
| `EVIDENCE_CHANGED` | 409 | 来源撤回/过期/ACL 变化 |
| `CITATION_MISMATCH` | 422 | 引用与片段不一致 |
| `CROSS_SPACE_REFERENCE` | 422 | 跨空间证据引用（关系边允许，不报此错） |
| `CONFLICT_UNRESOLVED` | 422 | 冲突未处理 |
| `APPROVAL_REQUIRED` / `APPROVAL_EXPIRED` | 409 | 审批缺失/失效 |
| `QUOTA_EXCEEDED` | 429 | 配额 |
| `DEPENDENCY_UNAVAILABLE` | 503 | 插件/依赖不可用 |
| `PARSER_UNAVAILABLE` | 503 | 解析/外部 ASR/OCR 未配置 |
| `CAPABILITY_UNAVAILABLE` | 503 | 能力停用/降级 |
| `INTERNAL` | 500 | 未分类；只返回 requestId |

## 7. 事件

| 事件 | 载荷（最小） | 消费者 |
| --- | --- | --- |
| `knowledge.import.completed.v1` | batchId、spaceId、counts、fragmentCount | 工作台、通知 |
| `knowledge.fragment.reviewed.v1` | fragmentId、decision、reviewer | 条目待审、审计 |
| `knowledge.publication.published.v1` | publicationId、spaceId、effectiveAt、capabilities | 搜索/问答/图谱/培训 |
| `knowledge.publication.withdrawn.v1` | publicationId、spaceId、reason | 所有消费者 |
| `knowledge.capability.changed.v1` | capabilityId、status、publicationId | 外部集成 |
| `knowledge.relation.changed.v1`（可选） | relationId、type、status | 图谱缓存 |

事件不含正文、转写、摘录或凭据；outbox 至少一次，消费者按 eventId 去重；撤回事件不能替代读路径实时校验。

## 8. 兼容与版本

- 现有 v0 命令保持可用；v2 新增命令独立版本，不修改已发布响应字段的语义。扩展可选字段视为兼容。
- 若必须改必填/语义：新 commandId 或 major 版本，保留旧命令一个迁移周期。
- `ontology.version` 与 `apiMajor` 在 manifest 声明；加载器拒绝不兼容组合。
- 迁移/回填任务可重跑；回滚停用新写入，不删数据。
- 未实现能力在 `capabilities` 中标记 `planned`，MCP/CLI 不注册；不允许 mock 返回成功。

## 9. 待确认

1. 是否新增 `knowledge:space:create` / `knowledge:capability:manage`，以及迁移方案。
2. 批量发布的原子性（全成功 vs 逐条）。
3. 关系手工编辑的权限（editor vs reviewer）。
4. 图谱查询上限与分页/聚合契约。
5. 导出格式与再验权细节。
