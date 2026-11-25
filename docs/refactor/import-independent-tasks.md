> 2026-11-25最新：#144 BAT-01—04技术验收通过并关闭；PR147合入refactor/integration（9bdb689f16a8365e702b580549161c7239291b6f），[最终复审](https://github.com/insanetoto/nuochong-page/pull/147#pullrequestreview-6052468920)。#142/#143/#144均已完成，不再领取这些任务。#107 已在隔离测试站通过负责人验收并关闭。见[人工验收记录](https://github.com/insanetoto/nuochong-page/issues/107#issuecomment-7154857586)和[发布记录](https://github.com/insanetoto/nuochong-page/actions/runs/45560106168)。下方Ready/Blocked及领取指令仅为历史。

> 2026-11-20最新：#143 SUB-01—04技术验收通过，PR #146 已合入 refactor/integration（`96ae5b62bd398f00d2a7100bceba522b1a31a603`）；固定审核head `de072e5e7b38d62a9301c088348c600a14bcceab`，[逐项复审](https://github.com/insanetoto/nuochong-page/pull/146#pullrequestreview-5989101222)、[精确head的PR CI](https://github.com/insanetoto/nuochong-page/actions/runs/44453542767)。本独立任务关闭；#144共享文件顺序已解锁。未代签人工产品验收，未部署，#107保留Tracking。

> 2026-11-20最新：Ready，可领取#144。#142已验收关闭，#143已验收合并关闭，共享文件占用已交接；基础为含`96ae5b62bd398f00d2a7100bceba522b1a31a603`的最新origin/refactor/integration。领取前先提交BAT-01—04→输入/屏障/期望/真实API浏览器测试路径映射，由ChatGPT预检可执行性；已有预检通过的方案可引用，不重复等待同一方案批准。只实现批次跟随/详情/恢复/分页，不重写已验收向导和后端状态机，不从旧PR141整体stack。记录执行者DeepSeek、基础SHA和允许文件；旧PR141仅复用来源。一个结果PR关联#144，全部AC与有效CI通过后自动合并关闭；#107保持Tracking，人工体验和发布另行确认。

> 2026-11-15最新：142已通过、PR140已合并（e4dcf6c）并关闭；143 Ready；144后端依赖满足，代码文件占用排143后。旧表与旧“待补142”段落保留历史，以本条及GitHub任务顶部为准。下一步使用[next-task-prompt-2026-11-15.md](next-task-prompt-2026-11-15.md)。未部署。

# 旧107迁移为独立结果任务

2026-11-15。#107改为Tracking，仅汇总，不再派发代码，也不继续使用A/B/C作为领取编号。已合并解析器PR139/68ab723作为既有依赖，不重建、不重新实现。当前未合并的实现及测试保留，不删除分支/审查记录。

| 正式Issue | 独立结果 | 业务依赖 | 文件占用/集成顺序 | 当前状态 |
| --- | --- | --- | --- | --- |
| [#142](https://github.com/insanetoto/nuochong-page/issues/142) | 同一导入任务在强杀/取消/撤权/重试后只有一个真实终态和一次副作用 | 解析器68ab723 | 后端/Worker；沿用PR140完成独立审核 | In review，不能据旧head判新head失败 |
| [#143](https://github.com/insanetoto/nuochong-page/issues/143) | 用户确认多文件提交，草稿/空间/会话/未知结果恢复一致 | #142验收合并SHA | 先处理向导和提交状态；从PR141提取相关已有工作到结果PR | Blocked，可先做测试设计，不继续stacked实现 |
| [#144](https://github.com/insanetoto/nuochong-page/issues/144) | 批次详情/跟随、取消重试、分页、失败恢复可操作 | #142真实API | 与143共享knowledge.mjs，安排在143合入后集成；不把文件占用误称业务依赖 | Blocked，可先做测试设计 |

任务完整目的、步骤及RUN/SUB/BAT验收矩阵已写入各正式Issue；仓库副本见[task-cards](task-cards/)。这不是将107-A/B/C换名：历史字母包含的范围不再原样整体领取，现按不同关闭结果分配，解析已完成作为依赖；提交与监控两组交互可分别验证。后续还需拆时必须先建不同编号正式Issue，不能再在142内追加142-A。

## 兼容现有PR及领取约束

- PR140完成后端任务142的既有实现/审查，之后改为关联142；只有142全部AC通过才关闭，不让父107自动关闭。
- PR141保留为历史实现/审查来源；DeepSeek在142合入后，将向导提交和批次监控的已有代码分别纳入143/144的结果PR。不要重新设计原型或重写已验收实现；ChatGPT此轮不代写实现代码。迁移完成前不直接合并原stacked PR141，也不关闭它冒充任务完成。
- 任务“独立”指有明确结果与单独验收，不指三个任务同时改共享文件。143/144的测试计划可先完成，写共享文件按顺序唯一主责。
- 142通过后只解除143/144真实API依赖。143合入后交接共享文件给144。父107等142/143/144全部关闭及预先约定的产品体验验收后才标总目标完成；产品体验不由代理代签，发布另行授权。
- 历史正文中的“Ready领取107-B/C”和旧PR关闭关键字由本条覆盖；任务作者更新PR关联时禁止Closes #107。

## 这三个任务的共同设计基线

需求：维护者导入真实合成MD/TXT/PDF/DOCX；员工不能维护知识；未知写入结果先核对，不产生重复批次或错误范围写入。业务：选择空间→受理原对象→建持久批次→逐文件任务→成功/部分/失败/取消→待审，不自动发布。功能：复用冻结commandId/schema，身份/权限/状态由服务端决定；前端只表达请求和真实结果。

交互基线：批准原型5a172f5的#imports、prototype-design.md，三步多文件、逐文件元数据和检查摘要；普通轮询保留同会话草稿；退出/换人/作用域失效清理；迟到响应不改新操作；响应丢失同输入重发复用同key，输入改变先核对旧操作再显式确认新操作。监控只按真实batch/file ID和cursor读API，取消请求≠已取消。

技术/验证：沿用既有R3、服务端公司凭据、窄Worker适配和合成夹具；每任务的精确输入/动作/副作用见Issue AC。命令/schema未因流程重排改变；产品新语义如有缺口先由ChatGPT给出独立设计决定，不让DeepSeek临时猜测。

## 需求到验收的明确追溯

| 需求 | 业务场景/状态 | 功能/服务契约 | 原型/交互 | 独立任务/验收 |
| --- | --- | --- | --- | --- |
| REQ-IMP-01：导入在中断/撤权后不丢状态、不重复副作用 | BIZ-IMP-01：uploaded→parsing→parsed/failed/cancelled；批次由文件真实终态聚合，重试有新租约、旧进程不得回写 | FUNC-IMP-01：objects.upload；imports create/get/retry/cancel，服务端持久状态、身份/空间授权及原子提交 | 非UI；操作结果由API/CLI/DB核验，不用前端提示当证据 | #142 RUN-01—04 |
| REQ-IMP-02：维护者只向确认的空间/会话提交一次完整文件集 | BIZ-IMP-02：草稿→选择→元数据→确认→提交结果已知/未知；未知先核对；换人和作用域失效使旧操作失效 | FUNC-IMP-02：上传、create；操作键绑定确认输入，原对象和提取文本分别保真 | #imports批准原型；同身份轮询保留草稿，其他身份不可见；迟到成功/失败不改新操作 | #143 SUB-01—04 |
| REQ-IMP-03：维护者能看到真实进展、定位失败并恢复 | BIZ-IMP-03：列表/详情→跟随→终态；retry/cancel是请求，服务端权威状态决定结果 | FUNC-IMP-03：imports list/get/retry/cancel；cursor、fileId、revision及稳定错误 | #imports批次列表/详情，空/错/部分成功，取消/失败恢复/待审入口；窄屏键盘 | #144 BAT-01—04 |

此表是既有已批准导入能力的交接归一，不改变冻结command schema或扩充产品；设计文件有歧义时由ChatGPT提供逐项修订。新产品也必须先建立同结构追溯，不能用本表代替新产品的需求调研和确认。

## 最新调度（2026-11-15）

原PR141 head58839d0新增两个浏览器用例，当前head手动core工作流43694082546 attempt2通过；但前端相较7309f5未改，SUB-02迟到响应/SUB-03改变文件集问题仍未闭环，[本轮审核](https://github.com/insanetoto/nuochong-page/pull/141#pullrequestreview-5909915448)已记录。认可新测试，不重复要求已完成正常路径。143已补具体状态/恢复动作，见[完整任务卡](task-cards/import-submit-isolation.md)。

先完成142当前PR140的RUN验收交接，ChatGPT审核通过后自动合并关闭142；随后143解除业务依赖，独立提交；144在共享文件交接后实施。当前143/144仍Blocked，可做设计/测试计划，不在未审分支扩写代码。没有新增重复Issue，也不让总目标107阻塞已完成独立任务关闭。

可直接使用[下一任务提示词](next-task-prompt-2026-11-15.md)。本次没有复审PR140的新head，不声称142已经通过；没有合并业务实现或部署。
