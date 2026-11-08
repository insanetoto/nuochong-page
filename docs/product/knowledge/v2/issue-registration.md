# v2任务Issue登记与核对（2026-11-08）

依据负责人指令“将所有任务转换为issue，如果暂时不能转换的，可以暂缓”，已将现有20项任务全部登记为GitHub Issues，**创建20项，暂缓创建0项**。计划来源为PR #100提交856bd4d；创建执行者为ChatGPT / Codex。

全部任务都能表达为设计或受前置条件约束的工程工作，因此无需暂缓创建。创建与启动分开：PLAN-01继续设计核查，其余保持Planned/待依赖；P2与其他产品设计也只登记Backlog，不提前调用外部服务或实现未经批准的业务。

## 任务登记表

| ID | Issue | 工作 | 波次 | 前置Issue |
| --- | --- | --- | --- | --- |
| PLAN-01 | [#101](https://github.com/insanetoto/nuochong-page/issues/101) | 知识库交接、存量缺口与设计决定冻结 | W0 | 无 |
| PLAN-02 | [#102](https://github.com/insanetoto/nuochong-page/issues/102) | P1命令与数据契约实现前冻结 | W0 | [PLAN-01 #101](https://github.com/insanetoto/nuochong-page/issues/101) |
| PLAN-03 | [#103](https://github.com/insanetoto/nuochong-page/issues/103) | 实现准入与执行任务登记 | W0 | [PLAN-01 #101](https://github.com/insanetoto/nuochong-page/issues/101), [PLAN-02 #102](https://github.com/insanetoto/nuochong-page/issues/102)；[#94](https://github.com/insanetoto/nuochong-page/issues/94)调查/风险决定 |
| KBV2-01 | [#104](https://github.com/insanetoto/nuochong-page/issues/104) | 本体注册表与版本治理 | W1 | [PLAN-03 #103](https://github.com/insanetoto/nuochong-page/issues/103) |
| KBV2-02 | [#105](https://github.com/insanetoto/nuochong-page/issues/105) | 数据模型扩展与迁移 | W1 | [KBV2-01 #104](https://github.com/insanetoto/nuochong-page/issues/104) |
| KBV2-03 | [#106](https://github.com/insanetoto/nuochong-page/issues/106) | 知识空间管理 | W2 | [KBV2-02 #105](https://github.com/insanetoto/nuochong-page/issues/105) |
| KBV2-04 | [#107](https://github.com/insanetoto/nuochong-page/issues/107) | 文本/PDF/DOCX 导入与片段任务 | W2 | [KBV2-02 #105](https://github.com/insanetoto/nuochong-page/issues/105) |
| KBV2-15 | [#108](https://github.com/insanetoto/nuochong-page/issues/108) | 产品壳、导航兼容与持久任务页面 | W2 | [KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106), [KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107) |
| KBV2-06 | [#109](https://github.com/insanetoto/nuochong-page/issues/109) | 片段待审与条目组装 | W2 | [KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107) |
| KBV2-07 | [#110](https://github.com/insanetoto/nuochong-page/issues/110) | 发布与能力输出 | W3 | [KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106), [KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109) |
| KBV2-08 | [#111](https://github.com/insanetoto/nuochong-page/issues/111) | 图谱查询 API | W3 | [KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110) |
| KBV2-09 | [#112](https://github.com/insanetoto/nuochong-page/issues/112) | 知识全景前端 | W3 | [KBV2-08 #111](https://github.com/insanetoto/nuochong-page/issues/111), [KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108) |
| KBV2-14 | [#113](https://github.com/insanetoto/nuochong-page/issues/113) | 员工搜索、阅读、原文核验与引用问答页面 | W3 | [KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110), [KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108) |
| KBV2-10 | [#114](https://github.com/insanetoto/nuochong-page/issues/114) | 契约、CLI 与 MCP | W3 | [KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106), [KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107), [KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109), [KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110), [KBV2-08 #111](https://github.com/insanetoto/nuochong-page/issues/111) |
| KBV2-11 | [#115](https://github.com/insanetoto/nuochong-page/issues/115) | P1迁移、评测与试点 | W4 | [KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106), [KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107), [KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109), [KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110), [KBV2-08 #111](https://github.com/insanetoto/nuochong-page/issues/111), [KBV2-09 #112](https://github.com/insanetoto/nuochong-page/issues/112), [KBV2-10 #114](https://github.com/insanetoto/nuochong-page/issues/114), [KBV2-14 #113](https://github.com/insanetoto/nuochong-page/issues/113), [KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108)；[#94](https://github.com/insanetoto/nuochong-page/issues/94)调查/风险决定 |
| KBV2-05 | [#116](https://github.com/insanetoto/nuochong-page/issues/116) | 音视频/OCR 导入（P2） | P2 | [KBV2-11 #115](https://github.com/insanetoto/nuochong-page/issues/115) |
| KBV2-12 | [#117](https://github.com/insanetoto/nuochong-page/issues/117) | P2媒体专项评测与试点 | P2 | [KBV2-05 #116](https://github.com/insanetoto/nuochong-page/issues/116), [KBV2-11 #115](https://github.com/insanetoto/nuochong-page/issues/115) |
| KBV2-13 | [#118](https://github.com/insanetoto/nuochong-page/issues/118) | 能力运营、排期与跨产品知识快照设计 | P2 | [KBV2-11 #115](https://github.com/insanetoto/nuochong-page/issues/115) |
| TOOL-01 | [#119](https://github.com/insanetoto/nuochong-page/issues/119) | 首个企业AI工具产品方案 | Parallel design | [PLAN-01 #101](https://github.com/insanetoto/nuochong-page/issues/101) |
| LEARN-01 | [#120](https://github.com/insanetoto/nuochong-page/issues/120) | 培训考试首期产品方案 | Parallel design | [PLAN-01 #101](https://github.com/insanetoto/nuochong-page/issues/101) |

## 每个Issue包含

- 稳定任务ID、计划状态、责任角色、设计SHA与批准原型版本；未擅自指定Assignee。
- 范围/不做项、允许目录与交付物、真实Issue依赖、启动条件及原有验收标准。
- commandId引用、完整schema/CLI交付要求、同权负例、审批/幂等/错误/失败恢复要求。
- 执行者、基础SHA、分支、PR、CI、人工验收和发布记录待补齐字段。

设计任务使用仓库现有documentation标签，工程/验证使用enhancement标签；没有新增仓库权限、保护规则或GitHub Project。依赖以Issue正文中关联任务清单表达，不声称已配置GitHub原生blocked-by关系或自动状态同步。

#94继续复用，不重复创建；#85维持已验收关闭。原型确认不重复请求。PLAN-03中原“尚未获创建Issue授权”的说明已更新为本轮登记完成，剩余实施准入和实际人员分配继续处理。

## 核对记录

远程逐项核对：20个任务ID/标题/Issue编号一一对应、全部Open、无重复、依赖链接指向真实前置Issue；全部包含验收标准、目录和命令/CLI说明；未出现预览占位编号。JSON/任务表/路线图回填一致，依赖仍无环、P1不依赖媒体。仅更新文档和任务元数据，未运行产品测试或更改运行代码。

当前任务来源：[完整任务卡](next-work.md)、[JSON台账](execution-plan.json)、[负责人路线图](execution-roadmap.md)。实际开始工作前读取Issue最新状态与依赖验收证据；本文是登记快照，不代替后续执行事实。
