# 发布与知识能力输出

2026-11-02 · 设计稿 v1 · **planned**。本文定义“知识发布”：把人工审核后的条目版本发布为不可变快照，并显式输出可被搜索、问答、图谱、API/CLI/MCP、导出和培训使用的**知识能力**。发布不是“上传成功”或“模型生成完成”，而是审批、证据校验、快照切换与能力登记的组合。

## 1. 目标

- 审校人能在同一工作台完成片段核验、条目组装、引用校验和提交审校。
- 发布人能看到目标版本、生效时间、可见范围、受影响能力和不可逆影响，再明确批准。
- 发布快照不可变；每个条目只有一个当前发布修订，空间维护一个当前能力快照；并发发布只有一个成功。
- 能力输出可见、可控、可撤销：谁知道、谁在用、契约是什么、配额多少、如何测试。
- 撤回/权限收紧/来源过期立即阻断所有能力，不等待后台重编译。

## 2. 非目标

- 不自动发布模型生成内容；默认不允许审校人自批发布，单人/演示空间可显式开启豁免并留审计。
- 不把知识发布当作工具执行授权或考试成绩发布。
- 不做跨空间合并发布、对外任意 Webhook 订阅（首期仅受控集成）。
- 不承诺外部系统 exactly-once；只保证本地事务与事件至少一次 + 幂等键。

## 3. 审校工作台

### 3.1 入口与队列

- 待审队列：按空间/责任人/阻塞项筛选，显示片段数、草稿版本、来源有效期、最后活动。
- 条目页三栏：结构（章节）｜正文与引用｜依据/概念/关系/ACL/影响。
- 支持键盘操作、批量接受同一条目的片段（逐条校验）、退回并说明原因。

### 3.2 片段与正文

- 片段卡片：摘录、locator（行/页/时间码）、来源版本、抽取器/置信度、状态。
- 接受片段 → 可插入正文并生成引用角标；编辑摘录不改变原文，只改展示（需审计）。
- AI 建议：生成段落/摘要/关系/概念，全部标记 `suggested`，需人工采纳；不得直接写入已审修订。
- 引用校验：逐字匹配片段范围；行号/页码/时间码必须可定位；缺引用或引用漂移阻断。
- 组装：从片段新建条目或补充现有条目；跨来源证据必须同空间；跨空间证据引用拒绝；跨空间条目关系不进入正文，不改变发布 ACL。

### 3.3 阻塞检查（发布前）

| 检查 | 阻断 | 说明 |
| --- | --- | --- |
| 引用可定位且逐字匹配 | 是 | `EVIDENCE_REQUIRED` / `CITATION_MISMATCH` |
| 来源 active、未过期、当前版本 | 是 | `EVIDENCE_CHANGED` |
| 空间可见范围与来源 ACL 交集可计算 | 是 | 交集为空不可发布 |
| 跨空间证据引用 | 是 | `CROSS_SPACE_REFERENCE` |
| 冲突未处理 | 是 | `CONFLICT_UNRESOLVED` |
| 概念层级/关系自指/重复 | 是 | `INVALID_RELATION` |
| 审校人 ≠ 发布人（默认） | 默认阻断；空间显式豁免时放行并审计 | `APPROVAL_REQUIRED` |
| 质量建议（孤立、长期未复核） | 否（提示） | 记录但不阻断 |

## 4. 审批与发布

### 4.1 审批

- 复用 `access.approvals.create.v1` + `product_approvals`：审批绑定 commandId、目标 hash、范围、审批人、凭据与有效期。
- 目标 hash 覆盖正文、引用片段、来源版本、可见范围、确切关系/概念/分配修订及 graphHash、publicationPolicyRevision；任一变化使审批失效。策略豁免的管理权限、资格与独立审批见 [来源管理 §2.4](source-management.md)，发布人不能自行解除双人约束。
- 审校人提交审校（`knowledge.changes.review.v1` 或 v2 等价命令）；默认由另一发布人审批；单人/演示空间可显式豁免自批，仍记录 approvalId 与审计。
- `--yes`、dry-run、UI 二次确认都不能替代服务端审批；拒绝请求无副作用。

### 4.2 发布

- 单个条目：`knowledge.publications.publish.v1`（扩展为条目版本语义，保持兼容）。
- 批量/排期：`knowledge.publications.publish-batch.v1`、`knowledge.publications.schedule.v1`。
- 发布事务：校验审批 hash、来源有效性、ACL、baseSnapshot → 同一事务更新条目发布指针并 CAS 切换空间当前快照 → 写 manifest → 写 outbox → 返回 publicationId/snapshotId。
- 生效时间：立即或未来；未来版本不提前成为现行依据；到期自动生效需 Worker 任务与审计。
- 失败保留原现行版本；半发布不允许；冲突返回 `VERSION_CONFLICT`，不 last-write-wins。
- 幂等：同 actor + 同 key + 同输入返回同一 publication；异输入 `IDEMPOTENCY_CONFLICT`。

### 4.3 发布快照 manifest

```json
{
  "snapshotId": "snap-01J...",
  "spaceId": "space-hr",
  "publications": [
    {"publicationId": "pub-1", "entryId": "entry-annual-leave", "entryRevisionId": "rev-4"},
    {"publicationId": "pub-2", "entryId": "entry-expense", "entryRevisionId": "rev-9"}
  ],
  "sourceRevisions": ["src-rev-7", "src-rev-8"],
  "relationRevisionRefs": ["rel-rev-3"],
  "conceptRevisionRefs": ["concept-rev-2"],
  "assignmentRevisionRefs": ["assignment-rev-4"],
  "supersessionRefs": ["supersession-1"],
  "graphHash": "sha256:...",
  "publicationPolicyRevision": 2,
  "effectiveAt": "2026-11-05T00:00:00+08:00",
  "approvalHash": "sha256:...",
  "aclEpoch": 42,
  "validityEpoch": 17,
  "capabilities": ["search@1", "answer@1", "graph@1"],
  "publishedBy": "principal-...",
  "createdAt": "2026-11-02T01:00:00Z"
}
```

manifest 不可变；回滚创建新快照与新发布记录并重新校验，不直接复用旧指针。

### 4.4 图谱数据的封存与投影

发布前封存关系、概念和条目概念分配的确切修订，形成 graphHash；内容审批绑定该摘要和 baseSnapshot。发布事务验证这些引用未变化后 CAS 切换快照。员工图谱仅从快照 refs 读取不可变内容，不能 JOIN 最新可变关系/概念表作为现行内容；维护者草稿视图独立鉴权，不复用员工缓存。

修改关系原因、证据、权重、概念标签或分配只生成候选修订，不能立即改变当前图谱；发布新快照后才切换。关系删除也先生成删除候选，审批发布后才从当前投影移除。supersedes 使用独立修订替代记录，发布事务按同条目修订派生，不允许条目自环。

跨空间边由发起空间快照封存，目标修订必须是目标空间当前有效发布版本；权限收紧/来源撤回/目标换版时即时裁剪，不自动把旧边改绑到新修订。历史快照仍可重建原始关系与标签，但对用户返回时叠加当前权限/有效性过滤；历史查询也不能恢复已失效访问权。

新增验收：发布后编辑关系/概念不改变现行图谱；修改后旧审批失效；新发布原子切换图内容及 graphHash；旧快照可重建但不能绕过撤权；跨空间目标换版后旧边隐藏、复核重发后才出现。

## 5. 知识能力输出

“输出知识能力”是把已发布快照登记为可被其他入口/产品使用的受控能力，而不是再复制一份内容。

### 5.1 能力目录

| 能力 | ID（示例） | 类型 | 首期 | 消费者 | 说明 |
| --- | --- | --- | --- | --- | --- |
| 检索 | `knowledge.search@1` | 读 | P1 | Web/CLI/API | 关键词 + 过滤；只读发布快照 |
| 有依据问答 | `knowledge.answer@1` | 读 + 模型 | P1 | Web/CLI/API/MCP | 引用片段；`EVIDENCE_CHANGED` |
| 图谱 | `knowledge.graph@1` | 读 | P1 | Web/API | 权限过滤的节点/边 |
| REST API | `knowledge.api@1` | 契约 | P1 | 外部系统 | OpenAPI/JSON Schema |
| CLI | `knowledge.cli@1` | 客户端 | P1 | 运维/外部 AI | 与 API 同权 |
| 受限 MCP | `knowledge.mcp@1` | 适配 | P1/P2 | 外部 AI | 只公开白名单能力 |
| 受控导出 | `knowledge.export@1` | 读 | P2 | 备份/迁移 | Markdown + manifest；再验权 |
| 培训快照 | `training.snapshot@1` | 跨产品 | P2 | 培训考试 | 只引用发布快照；撤回标记待复核 |
| 事件订阅 | `knowledge.events@1` | 推送 | P2 | 集成 | 最小事件、签名、不含全文 |

每个能力有：版本、状态（`planned/draft/active/degraded/revoked`）、契约链接、消费者、配额、最近使用、负责人。

### 5.2 能力页面

```text
知识发布 / 能力输出
┌──────────────────────────────────────────────────────────────────────────┐
│ 空间：人力资源制度     快照：pub-2026-11-01     有效：2026-11-01 起       │
│ 能力            状态     版本   消费者        配额        操作            │
│ 检索            active   1      Web/CLI       可配置      [契约] [测试]   │
│ 有依据问答      active   1      Web/MCP       可配置       [契约] [测试]   │
│ 图谱            active   1      Web           —           [契约] [测试]   │
│ 培训快照        planned  1      培训考试      —           [说明]          │
└──────────────────────────────────────────────────────────────────────────┘
```

- 只读“测试”控制台：输入问题/查询，显示结果与引用，不产生副作用；不绕过权限。
- 消费者不设产品级白名单或数量上限（设计）；但必须注册消费者、使用受限凭据、可审计、可撤销；配额可配置，默认不限；不显示 secret。
- 能力启停：`knowledge.capabilities.set.v1`（planned；首期由平台管理员 + 发布权限）；停用立即生效，不等于删除历史。

### 5.3 能力失效

- 来源撤回/过期、ACL 收紧、发布撤回 → 同一事务更新 `validityEpoch`，能力读路径实时过滤。
- 已发出的答案无法追回；流式输出优先“整段返回 + 进度”，避免逐 token 泄漏失效内容。
- 外部消费者收到 `knowledge.publication.withdrawn.v1` / `knowledge.capability.changed.v1`，必须重新拉取；事件不携带全文。

## 6. 撤回、回滚与替代

| 动作 | 语义 | 约束 |
| --- | --- | --- |
| 撤回发布 | 当前快照立即不可读/不可引用 | 审批 + 审计；历史保留；能力同步失效 |
| 回滚 | 以旧版本创建新发布记录 | 重新校验来源有效期/ACL；不恢复已失效依据 |
| 替代 | 新版本 `supersedes` 旧版本 | 同一条目；旧版本保留历史 |
| 来源撤回 | 依赖条目/能力失效 | 不等待重编译；维护者看到影响清单 |
| 空间归档 | 停止新发布，历史可读 | 不删除审计与发布记录 |

## 7. 并发、幂等与错误

- 发布使用 `expectedRevision` + 条目发布指针 + 空间当前快照 CAS；并发仅一个成功。
- 审批一次性使用；失败不消耗审批（或按服务端语义明确），重试需重新校验。
- 稳定错误码：`EVIDENCE_REQUIRED`、`EVIDENCE_CHANGED`、`CITATION_MISMATCH`、`CROSS_SPACE_REFERENCE`、`CONFLICT_UNRESOLVED`、`APPROVAL_REQUIRED`、`APPROVAL_EXPIRED`、`VERSION_CONFLICT`、`IDEMPOTENCY_CONFLICT`、`CAPABILITY_UNAVAILABLE`、`FORBIDDEN`。
- 错误只返回 code/requestId，不透传数据库/模型诊断；404 不确认敏感资源存在。

## 8. 审计与可观测

- 记录：审校决定、发布/撤回/回滚、能力启停、消费者变更、失败码；不记录正文/全文问题。
- 指标：待审时长、发布成功率、阻塞原因分布、能力调用量/错误率/延迟、撤回影响条目数。
- 每次发布生成快照摘要（条目数、来源数、片段数、能力列表），供运营与备份核对。

## 9. 验收标准

1. 无有效片段/引用缺失/来源过期/跨空间证据引用时发布被拒绝，且原现行版本不变。
2. 默认禁止自批发布；显式豁免空间仍记录审批与审计；审批 hash 在正文/引用/范围变化后失效。
3. 并发发布仅一个成功；重复提交同幂等键返回同一 publication。
4. 发布后能力目录显示 active 与契约；CLI/API 返回同一快照与引用。
5. 撤回后搜索/问答/图谱/培训快照全部失效，外部消费者收到事件；恢复需重新发布。
6. 排期发布不提前生效；到期生效有审计；回滚重新校验有效性。
7. 能力测试控制台只读、按权限裁剪；不出现个人 Key 或 owner 入口。

## 10. 待确认

- 双人复核是否启用（自批已确认可通过空间豁免；默认仍分离）。
- 批量发布的范围（同空间多条目）与失败原子性（全成功/逐条）。
- 消费者注册与凭据流程（不设白名单；默认不限额）。
- 培训快照的首期范围与撤回后的课程复核规则。
- 外部事件是否需要签名 Webhook 与重放（P2）。
