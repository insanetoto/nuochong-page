# 诺崇产品体系与企业知识库设计

2026-11-08 r6最新：[V2整版发布流程](knowledge/v2/release-process.md)、[16条原型验收矩阵](knowledge/v2/release-acceptance.md)、[6项补充任务 #125—#130](knowledge/v2/release-tasks.md)。统一台账现26项；只有KBV2-01离线模块已Released（隔离测试），完整V2尚未实现/验收/发布，FULL/#94仍待处理。以下保留历次阶段记录，当前状态以r6为准。

W0最新交接：[决策、完整契约与KBV2-01有限准入确认单](knowledge/v2/w0/README.md)。#104的R1准入已通过、Ready，完整运行准入仍未完成；本轮只记录合并与开工授权。

2026-11-08后续安排：[工作波次与20项任务卡](knowledge/v2/next-work.md)、[机器可读任务台账](knowledge/v2/execution-plan.json)。ChatGPT负责设计规划、页面原型、交互设计与预审，DeepSeek只负责按确认设计进行代码实现；v2原型评审已通过，当前更新实施规划，待其余设计决定及准入确认后领取，20项Issues已创建（[登记表](knowledge/v2/issue-registration.md)），尚未分配实际成员或开始编码。

2026-11-01 · 规划 v1.1 + 初版工程 v0 · 状态：知识库初版已实施并验证，隔离测试已部署并通过真实模型/浏览器/CLI/MCP 验证；负责人已于2026-11-08确认v0已交付范围人工验收（[记录](v0/acceptance-2026-11-08.md)）；生产发布另批。

当前原型已评审通过；[确认记录](knowledge/v2/prototype-acceptance-2026-11-08.md)与[负责人任务路线图](knowledge/v2/execution-roadmap.md)为本次更新入口。

推荐阅读顺序：

2026-11-08协作约定：ChatGPT负责设计规划、页面原型、交互设计与预审，DeepSeek只负责按确认设计进行代码实现；人工验收和发布由负责人确认。知识库v2预审修订及实现检查清单见 [PR #99交接说明](knowledge/v2/review-handoff.md)。文档合并不代表启动实现或产品验收。

1. [公司产品体系与三条技术路线](portfolio.md)
2. [共享组织、人员与角色权限插件](shared-access/design.md)
3. [插件架构决策 ADR-011](../adr/ADR-011-product-plugins-llm-wiki.md)
4. [知识库产品与技术设计](knowledge/design.md)
5. [知识库页面与交互设计](knowledge/pages.md)
6. [v2可点击页面原型](prototypes/knowledge-v2.html)与[页面/交互规范](knowledge/v2/prototype-design.md)（合成数据、界面评审专用，没有连接业务 API）；[v1历史原型](prototypes/knowledge.html)
7. [任务、依赖及验收](tasks.md)
8. [演示模型交付记录](demo-delivery.md)
9. [知识库初版范围、任务与验证](v0/README.md)
10. [产品本体方法论](ontology/README.md)与[产品套件本体](ontology/suite-ontology.md)
11. [知识库 v2 功能设计](knowledge/v2/README.md)：知识全景图谱、空间/导入/发布重构
12. [整体产品路线图](../refactor/roadmap.md)

## 2026-11-02 知识库 v2 设计（先设计，不开发）

负责人要求：知识首页以类似 Obsidian 的关系图谱展示知识全景；空间创建移入来源管理，来源管理拆为知识空间、知识导入、知识发布；导入支持文本/视频/语音并生成可追溯片段进入条目待审区；发布输出知识能力。本轮只形成设计，全部能力仍为 planned，不创建实现任务、不部署。

- [知识库 v2 总览](knowledge/v2/README.md)｜[知识首页图谱](knowledge/v2/home-graph.md)｜[来源管理](knowledge/v2/source-management.md)｜[导入管线](knowledge/v2/import-pipeline.md)｜[发布与能力](knowledge/v2/publication.md)｜[契约](knowledge/v2/contracts.md)｜[任务拆分](knowledge/v2/tasks.md)
- [本体方法论](ontology/README.md)｜[套件本体](ontology/suite-ontology.md)｜[ADR-012](../adr/ADR-012-product-ontology-and-knowledge-graph.md)（P1方向Accepted）
- ASR/OCR 由外部大模型适配器提供；测试阶段只用 DeepSeek 识别文本类来源，音视频/扫描件不纳入测试；v0 的 Markdown/TXT 能力与已部署测试继续有效。

## 本轮范围和依据

用户明确三条产品线：企业知识库、企业 AI 工具、培训和考试；共用 DeepSeek Harness 基座，产品能力通过插件扩展；知识库优先，以公司规章制度起步，采用 LLM Wiki 思路，并开放受控外部集成。演示使用公司服务端模型凭据，访客无需 DeepSeek 登录或自备 Key。

用户随后授权开始建设：已按 KBV0-01—07 拆出初版切片并顺序领取。共享身份/组织/固定角色、来源/编译/审校发布、引用问答与真实 API 工作台已实施；具体工程/CI/部署状态以 v0 台账为准。完整原规划中的 PDF/DOCX、SSO、语义检索、连接器与生产质量目标仍 planned，不恢复已撤销的旧演示。OA-01—06 历史验收继续有效，公司账号独立于原生管理员身份。

## 下一轮再确认，当前不阻断规划

- 指定制度归口人与审核/发布人；默认内容负责人审核，发布人确认，系统管理员不自动拥有内容发布权。
- 首批文件数量、格式及密级；本轮按 100 份、文本型 PDF/DOCX/Markdown/TXT、单文件 20MB、总量 500MB 做试点建议值。
- 员工身份源和首个外部系统；本轮先做公司受限身份与标准 HTTP 接口，真实 SSO/厂商连接器按选型接入，不承诺已有。
- 历史制度可见性；默认仅授权维护者访问，员工只见当前有效发布版本。
- 演示与内部正式环境的配额、并发和容量；本轮性能数字仅是验收目标，需用实测调整。
- 页面风格、移动端优先级；本轮提供桌面优先并可适配手机的独立产品壳，不修改官网。

实现、CI、人工验收、合并、部署分别记录；授权代理执行工作不能写成人工验收通过。
