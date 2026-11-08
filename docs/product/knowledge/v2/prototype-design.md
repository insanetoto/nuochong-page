# 知识库 v2 页面原型与交互设计

2026-11-08 · 原型版本 0.1 · **负责人原型评审通过（Accepted），产品能力仍 planned**。

设计执行者：ChatGPT / Codex。基于 PR #99 的 `6197d4e` 设计，遵循 ADR-011/012（Proposed）、官网主题规范及 P1/P2 分期建议。负责人已明确确认原型评审通过，见[确认记录](prototype-acceptance-2026-11-08.md)。本次接续更新任务计划，代码实施与发布按准入另记。

## 1. 打开与评审

[打开独立交互原型](../../prototypes/knowledge-v2.html)。文件可以直接在浏览器打开，无需安装依赖；下载仓库时保留相对目录，以加载 `public/logo-mark.svg`。也可在仓库根目录运行 `python3 -m http.server 4179 --bind 127.0.0.1`，访问 `http://127.0.0.1:4179/docs/product/prototypes/knowledge-v2.html`，评审后停止服务。

原型使用合成资料，**没有业务接口、上传、模型调用、数据库写入或身份认证**。角色/状态切换器仅供评审，不属于正式产品授权入口。上传控件仅读取文件名，不读取或发送文件内容；解析、审校和发布结果必须由评审人显式选择查看，不假装执行成功。原型不进入官网构建、产品路由或 ready 能力注册表。

建议评审顺序：

1. 以员工身份查看「知识全景」，切换空间、主题/来源层，搜索节点，缩放/复位，点击节点及聚焦 1 跳邻居；打开列表替代视图。
2. 搜索「年假」，阅读条目，打开引用抽屉核验来源版本、页码/段落和片段。尝试无结果；浏览器前进/后退恢复搜索词。
3. 进入问答，预览进度、有依据、无依据、冲突；区分停止跟随、取消请求与取消终态；预览依据失效。
4. 切换编辑者，进入「来源管理 → 知识空间」查看创建与设置，再进入「知识导入」，使用合成 PDF 示例，填写元数据并进入待审区。
5. 切换审校人，在审校台采纳片段、审校通过；切换发布人，检查发布确认及独立审批样例，再看事务完成态。全程没有实际发布。
6. 返回编辑角色，预览保存新修订；确认原审批失效、发布阻断。查看并发冲突、来源失败恢复、发布撤回影响。
7. 使用顶部状态切换器逐页检查空数据、服务异常、撤权；以 390px 宽度检查导航、表单、引用与管理动作。

## 2. 页面和交互范围

正式路由为设计目标；原型 hash 只是离线页面定位，不是业务 URL。

| 页面 / 原型 hash | 正式路由（planned） | 页面结构与关键交互 | 实现任务 |
| --- | --- | --- | --- |
| 知识全景 `#graph` | `/knowledge` | 条目/概念图谱，来源层默认关；空间过滤、定位、缩放、1跳聚焦、列表、节点详情；首页无建空间表单 | KBV2-08/09 |
| 搜索 `#search?q=年假` | `/knowledge/search?q=` | 明确搜索动作，不隐式调用模型；结果摘要/来源/版本/生效状态；空结果不泄漏隐藏资源 | KBV2-14，复用 v0 |
| 阅读 `#read` | `/knowledge/pages/:id` | 现行版本、AI整理提示、引用、来源定位抽屉、关联与反馈 | KBV2-14 |
| 问答 `#ask` | `/knowledge/ask` | 问题保留、进度、引用、无依据、冲突、停止跟随/取消、来源失效 | KBV2-14，复用 v0 |
| 空间 `#spaces` | `/knowledge/manage/spaces` | 列表、创建审批表单、设置、归档影响；编码只读，独立策略治理无普通开关 | KBV2-03 |
| 导入 `#imports` | `/knowledge/manage/import` | 批次及逐文件状态；三步向导：选择→元数据→检查；失败恢复与待审入口 | KBV2-04 |
| 审校 `#review` | `/knowledge/manage/publish/:entryId` | 三栏：片段、正文与引用、依据/影响/检查；采纳/退回、修订失效、版本冲突、角色分离 | KBV2-06 |
| 发布 `#publish` | `/knowledge/manage/publish` | 待审/发布、能力展示、质量检查；确认版本/范围/快照、有效审批、CAS失败保持原发布 | KBV2-07 |
| 任务 `#tasks` | `/knowledge/jobs`（路由待冻结） | 进度、错误码、requestId、恢复跟随、取消请求及终态 | KBV2-15 |
| 共享权限 `#access` | 共享管理入口（沿用共享设计） | 说明统一目录与资源角色，不重建人员主库或原生 owner 面板 | KBV2-03/15，关联共享IAM |

原型仅有固定合成布局与 1 跳聚焦；正式版的画布拖动、2 跳展开、规模截断/聚合、逐文件多选上传、分页、完整关系编辑和可视化差异按既有设计实施，不由原型固定样例缩减任务范围。原型多个节点共用阅读版式，正式版必须按真实资源 ID 加载，不得复用假正文。

## 3. 视觉与响应式规范

- 品牌：沿用官网标识和主题。主色 `#0b57d0`、辅助 `#00bcd4`、正文 `#17233b`、底色 `#f5f8fc`、分隔 `#dbe4f0`，不改官网源码、URL或SEO。
- 桌面：220px 白色侧栏，顶部面包屑和空间范围，主区图谱与辅助信息分栏；审校用三栏，正文宽度优先。
- 1100px以下：辅助区下移；审校两栏后接依据区。760px以下：单列和可收起导航，引用抽屉全宽，操作换行，表格在独立容器滚动。
- 主操作触达高度至少44px；正文15–16px、舒适行高；颜色配合文字，不以颜色单独表达状态。
- 图谱节点可键盘选择；提供列表替代。对话框采用原生 dialog；引用抽屉屏蔽背景交互、限制焦点、Escape关闭并恢复焦点；支持减少动画偏好。
- 图谱强调已发布知识和可核验关系，不通过装饰动画暗示实时推理。

## 4. 角色与状态设计

| 场景 | 呈现与操作 | 不变量 |
| --- | --- | --- |
| 员工访问管理区 | 通用无管理权限提示，可返回全景 | 真实授权在服务端，隐藏菜单不能代替拒绝 |
| 空数据 | 不显示合成数量；员工等待发布，维护者去空间管理 | 首页不承载创建表单 |
| 服务异常 | 保留输入、显示稳定错误码/requestId及重试 | 无个人模型 Key 引导，不伪装正常结果 |
| 权限撤销 | 关闭引用与对话框，清除当前正文展示 | 标题、片段、计数和旧缓存不得泄漏；原型仅示范UI |
| 导入失败 | 保留文件/元数据，提示恢复条件 | 未知远端结果先核对，不盲目重复写 |
| 审校内容变化 | 旧审批失效，重新提交并核验 | 正文/证据/关系/范围/策略版本绑定审批摘要 |
| 发布确认 | 显示修订、快照、影响和独立审批 | 二次确认不代替审批；默认不同审校/发布主体 |
| 并发冲突 | 保留本地草稿，重新加载对比与审校 | 不 last-write-wins，不改变原现行知识 |
| 取消任务 | 先显示取消请求，终态从服务端读取 | 停止跟随不等于取消；重复事件幂等 |
| 来源撤回 | 不再展示旧依据，提示重新检索 | 搜索/问答/图谱/下载都实时验权与有效性校验 |

原型角色是分开的评审视角，不能证明服务端同人自批被拒绝。正式权限负例、撤权时序、审批绑定、幂等与唯一终态由 DeepSeek 自动化验证，ChatGPT预审。

## 5. 页面动作与 API/CLI 交接

本原型不增加业务能力、不更改运行契约。下表引用当前候选命令；完整输入/输出 JSON Schema 继续在 PLAN-02 冻结，不能把这些摘要当作可执行接口。

| 页面动作 | commandId（现有或planned） | 关键输入 → 输出摘要 | CLI映射 / 状态 |
| --- | --- | --- | --- |
| 图谱过滤/聚焦 | `knowledge.graph.query.v1` | spaceIds/types/focusId/depth/limit → nodes/edges/stats/truncated/graphVersion/requestId | `nuochong knowledge graph query --input - --json` / planned |
| 空间查看 | `knowledge.spaces.get.v1` | spaceId → space/stats/requestId | `nuochong knowledge spaces get --input - --json` / 候选扩展 |
| 创建空间 | `knowledge.spaces.create.v1` | 名称/编码/业务域/approvalId/idempotencyKey → space/operationId/requestId | `nuochong knowledge spaces create --input - --json` / 候选扩展 |
| 导入及恢复 | `knowledge.imports.create.v1`、`get.v1`、`retry.v1` | spaceId/文件引用/元数据/幂等键 → batch/files/jobId/requestId | `nuochong knowledge imports create|get|retry --input - --json` / planned |
| 核验片段 | `knowledge.fragments.review.v1` | spaceId/fragmentId/decision/expectedRevision/idempotencyKey → fragment/operationId/requestId | `nuochong knowledge fragments review --input - --json` / planned |
| 草稿/提交 | `knowledge.entries.draft.v1`、`submit.v1` | spaceId/entryId/expectedRevision/幂等键；draft含正文与证据 → revision/state/requestId | `nuochong knowledge entries draft|submit --input - --json` / planned |
| 审校条目 | `knowledge.changes.review.v1` | 现有审批目标与决定/修订/幂等键 → review/state/requestId | 复用当前 CLI；扩展语义在PLAN-02核对兼容 |
| 发布/撤回 | `knowledge.publications.publish.v1`、`withdraw.v1` | 目标修订/baseSnapshot/approvalId/幂等键 → publicationId/snapshotId/requestId | `nuochong knowledge publications publish|withdraw --input - --json` / 候选扩展 |
| 能力展示 | `knowledge.capabilities.list.v1` | spaceId/publicationId → items/requestId | `nuochong knowledge capabilities list --input - --json` / planned |
| 跟随/取消任务 | `knowledge.jobs.get.v1`、`events.v1`、`cancel.v1` | 既有job标识/事件游标；取消含幂等键 → 持久任务/事件/真实终态 | 复用现有 jobs CLI / 已有基座契约 |

搜索、阅读、原文核验和问答复用 v0 命令，实施前从真实能力清单提取准确输入/输出，不另造第二套接口。自批治理命令 `knowledge.spaces.publication-policy.set.v1` 只在受控治理入口使用，普通空间设置不能调用。所有新/变更功能随任务交付版本化 schema、CLI及 API/CLI 同权负例；MCP仅暴露受限白名单，不自动开放写操作。

## 6. 本轮设计检查与待确认

原型交付检查（不是产品人工验收）：

- [x] 全景首页、三来源模块、引用阅读与问答形成可浏览结构。
- [x] 原型明确标识合成数据，P2不可提交，无业务网络调用或持久化。
- [x] 独立审批、审批失效、并发冲突与服务失败均有可预览路径。
- [x] 空数据、撤权、390px、键盘/引用抽屉列入验证。
- [x] 负责人确认原型评审通过，页面/交互基线固定为5a172f5（见确认记录）。
- [ ] PLAN-01冻结业务未决项；PLAN-02完整Schema冻结；PLAN-03解锁实施。

负责人已分别确认v0人工验收和v2原型评审通过；后端设计/ADR和运行能力验收继续分别记录，#94仍开放。原型检查记录见 [验证记录](prototype-validation.md)。后续由ChatGPT维护页面原型与交互规范，DeepSeek按确认版本实现运行代码、迁移和自动化测试，不能自行变更产品交互或权限语义。
