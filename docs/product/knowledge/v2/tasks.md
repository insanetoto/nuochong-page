# 知识库 v2 任务索引（执行计划 r6（整版发布规划））

**r6 · V2整版发布规划（2026-11-08）：原20项加6项质量/发布任务，共26项，新增Issues #125—#130。仅#104离线模块已Released（隔离测试）；完整V2尚未实现/验收/发布。REL-01设计已输出待评审，#94与PLAN-03:FULL仍待处理。**

[发布流程](release-process.md) · [16条页面/交互验收矩阵](release-acceptance.md) · [6项补充任务卡](release-tasks.md) · [统一台账](execution-plan.json)


**2026-11-08 发布更新：KBV2-01 已由负责人验收，PR #123 已合入 integration；官网测试/生产及知识库隔离测试发布成功。知识库 v2 页面与后续业务能力仍 planned，#94 / 完整运行准入保持独立。详见[验收与发布记录](release-2026-11-08.md)。**


2026-11-08更新：负责人已确认原型评审通过。当前以[任务卡](next-work.md)、[JSON台账](execution-plan.json)及[负责人路线图](execution-roadmap.md)为唯一执行口径。本页替换原父任务/估算表中相互冲突的阶段与依赖，原始记录仍可从Git提交5a172f5查看。

共26项：原3项设计准入、12项P1工程/验收、3项P2后续、2项其他产品设计，加6项质量/发布工作。新增KBV2-14（搜索/阅读/引用问答）与15（产品壳/任务/兼容），已有任务ID不重编号。PLAN-01/02已Accepted、PLAN-03进行中、KBV2-01 Released（隔离测试），其余Planned；原型Accepted不等于实现Accepted。原20项与新增6项Issues均已创建（见[登记记录](issue-registration.md)），成员与日期待准入登记。

W0设计已补齐，见[一次确认单](w0/admission.md)；#104当前Released（隔离测试），依赖为#103的R1子出口，见[验收记录](w0/r1-acceptance-2026-11-08.md)。

## 任务与依赖

| ID | Issue | 工作 | 主责 | 依赖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| PLAN-01 | [#101](https://github.com/insanetoto/nuochong-page/issues/101) | 知识库交接、存量缺口与设计决定冻结 | ChatGPT；负责人确认 | 无 | Accepted |
| PLAN-02 | [#102](https://github.com/insanetoto/nuochong-page/issues/102) | P1命令与数据契约实现前冻结 | ChatGPT；DeepSeek评估可实现性 | PLAN-01 | Accepted |
| PLAN-03 | [#103](https://github.com/insanetoto/nuochong-page/issues/103) | 实现准入与执行任务登记 | ChatGPT；负责人批准 | PLAN-01, PLAN-02 | In progress |
| KBV2-01 | [#104](https://github.com/insanetoto/nuochong-page/issues/104) | 本体注册表与版本治理 | DeepSeek；ChatGPT预审；负责人验收 | PLAN-03:R1 | Released（隔离测试） |
| KBV2-02 | [#105](https://github.com/insanetoto/nuochong-page/issues/105) | 数据模型扩展与迁移 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-01 | Planned |
| KBV2-03 | [#106](https://github.com/insanetoto/nuochong-page/issues/106) | 知识空间管理 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-02 | Planned |
| KBV2-04 | [#107](https://github.com/insanetoto/nuochong-page/issues/107) | 文本/PDF/DOCX 导入与片段任务 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-02 | Planned |
| KBV2-15 | [#108](https://github.com/insanetoto/nuochong-page/issues/108) | 产品壳、导航兼容与持久任务页面 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-03, KBV2-04 | Planned |
| KBV2-06 | [#109](https://github.com/insanetoto/nuochong-page/issues/109) | 片段待审与条目组装 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-04 | Planned |
| KBV2-07 | [#110](https://github.com/insanetoto/nuochong-page/issues/110) | 发布与能力输出 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-03, KBV2-06 | Planned |
| KBV2-08 | [#111](https://github.com/insanetoto/nuochong-page/issues/111) | 图谱查询 API | DeepSeek；ChatGPT预审；负责人验收 | KBV2-07 | Planned |
| KBV2-09 | [#112](https://github.com/insanetoto/nuochong-page/issues/112) | 知识全景前端 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-08, KBV2-15 | Planned |
| KBV2-14 | [#113](https://github.com/insanetoto/nuochong-page/issues/113) | 员工搜索、阅读、原文核验与引用问答页面 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-07, KBV2-15 | Planned |
| KBV2-10 | [#114](https://github.com/insanetoto/nuochong-page/issues/114) | 契约、CLI 与 MCP | DeepSeek；ChatGPT预审；负责人验收 | KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08 | Planned |
| KBV2-11 | [#115](https://github.com/insanetoto/nuochong-page/issues/115) | P1迁移、评测与试点 | DeepSeek；ChatGPT预审；负责人验收 | KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08, KBV2-09, KBV2-10, KBV2-14, KBV2-15, KBV2-REL-02, KBV2-REL-03, KBV2-REL-04 | Planned |
| KBV2-05 | [#116](https://github.com/insanetoto/nuochong-page/issues/116) | 音视频/OCR 导入（P2） | DeepSeek；ChatGPT预审；负责人验收 | KBV2-11 | Planned |
| KBV2-12 | [#117](https://github.com/insanetoto/nuochong-page/issues/117) | P2媒体专项评测与试点 | DeepSeek；负责人验收 | KBV2-05, KBV2-11 | Planned |
| KBV2-13 | [#118](https://github.com/insanetoto/nuochong-page/issues/118) | 能力运营、排期与跨产品知识快照设计 | ChatGPT；负责人确认 | KBV2-11 | Planned |
| TOOL-01 | [#119](https://github.com/insanetoto/nuochong-page/issues/119) | 首个企业AI工具产品方案 | ChatGPT；负责人确认 | PLAN-01 | Planned |
| LEARN-01 | [#120](https://github.com/insanetoto/nuochong-page/issues/120) | 培训考试首期产品方案 | ChatGPT；负责人确认 | PLAN-01 | Planned |

## 新增发布质量与运维任务

| ID | Issue | 工作 | 主责 | 依赖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| KBV2-REL-01 | [#125](https://github.com/insanetoto/nuochong-page/issues/125) | V2原型到验收用例追踪与发布规则冻结 | ChatGPT设计；DeepSeek评估可测试性；负责人确认新增规则 | PLAN-01, PLAN-02 | In review |
| KBV2-REL-02 | [#126](https://github.com/insanetoto/nuochong-page/issues/126) | V2真实业务浏览器E2E与原型验收负例 | DeepSeek实现；ChatGPT设计预审；负责人验收 | KBV2-REL-01, KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-08, KBV2-09, KBV2-14, KBV2-15 | Planned |
| KBV2-REL-03 | [#127](https://github.com/insanetoto/nuochong-page/issues/127) | V2 Linux视觉基线、交互可达性与设计一致性门禁 | DeepSeek实现；ChatGPT对照原型审查；负责人确认真实Linux基线 | KBV2-REL-01, KBV2-03, KBV2-04, KBV2-06, KBV2-07, KBV2-09, KBV2-14, KBV2-15 | Planned |
| KBV2-REL-04 | [#128](https://github.com/insanetoto/nuochong-page/issues/128) | V2不可变候选产物、测试部署、版本核验与发布预检 | DeepSeek实现；ChatGPT契约及运维方案预审；负责人批准具体测试部署 | KBV2-REL-01 | Planned |
| KBV2-REL-05 | [#129](https://github.com/insanetoto/nuochong-page/issues/129) | 独立知识库生产环境方案、隔离配置与恢复演练 | ChatGPT先设计；负责人确认环境及成本；DeepSeek按批准方案建设 | KBV2-REL-01, KBV2-REL-04 | Planned |
| KBV2-REL-06 | [#130](https://github.com/insanetoto/nuochong-page/issues/130) | V2 P1生产发布批准、执行核验与交付记录 | ChatGPT整理发布单；负责人批准实际版本/环境；DeepSeek执行；ChatGPT核验回填 | KBV2-11, KBV2-REL-04, KBV2-REL-05 | Planned |

KBV2-11 / #115额外依赖REL-02/03/04；生产发布在REL-06完成，不能用#115关闭代替。所有运行实现仍要求FULL。

## 范围、估算与门槛

- v0与原型确认见[原型评审记录](prototype-acceptance-2026-11-08.md)和[v0验收](../../v0/acceptance-2026-11-08.md)。#94仍Open；ADR-011/012的P1架构方向已Accepted，不重复申请已通过的页面原型批准。
- P1范围和D01—D14已在PLAN-01确认；完整版本化schema/CLI及兼容设计已在PLAN-02冻结；PLAN-03记录批准合入设计、实施授权、集成SHA、具体成员与共享文件责任。
- 03/04/06/07各自负责空间/导入/审校/发布管理页面；09只负责全景，14负责员工知识消费，15负责公共壳与持久任务。10不承担首次定义所有接口，负责各功能交付后的联合验证。
- 11显式依赖14/15等全部P1交付；05/12媒体仅在P1后独立实现验收，不成为文本闭环前置。13负责后续能力运营、排期与跨产品快照设计，再拆实现任务。
- 原47–75工程人日来自历史范围，不用于当前计划承诺；完成PLAN-01/02后由DeepSeek重新评估，人员到位后再制定日历排期。
- 现有命令/数据兼容、权限裁剪、审批、幂等、终态与恢复作为每项验收条件；原型不是业务成功证据。官网、上游核心和生产配置不在允许修改范围。

## 与原任务的继承

01本体继承PLAT-01/02；02模型继承KB-02；03空间与06审校/07发布继承KB-03/06/07/13；04文本及05媒体继承KB-04；08图谱继承KB-08；09全景与14员工消费继承KB-11；10集成继承KB-14；11验收继承KB-17；15整合已有产品壳与任务基础。只继承相关切片，不将原30项完整规划自动标记完成，也不恢复旧B—E业务演示。

R1最新准入以[验收与固定基线](w0/r1-acceptance-2026-11-08.md)为准；#104只依赖#103的R1子出口，不等待父Issue关闭。其余任务不据此跳过完整前置。
