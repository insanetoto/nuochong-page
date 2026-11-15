# 导入任务在强杀、取消和撤权后保持一致终态

类型：独立开发/验收任务；执行DeepSeek；设计与预审ChatGPT；人工体验/发布负责人。规划ID：import-runtime-acceptance（正式GitHub Issue编号创建后记录，不使用107-A/B/C）。

## 目的与完成结果

运行API/CLI建批→真实Worker消费→受控故障→同任务恢复，交付稳定持久终态。

## 当前状态与依赖

In review：复用PR140，不重新实现已通过代码。

已合并解析器68ab723；迁移/命令基线见PR140。当前PR140新head6752263尚须复审，旧意见不等于新提交失败。

## 范围

plugins/knowledge/import-worker.mjs、运行入口、导入服务、相应PG/CLI测试；允许补受控测试缝，不改原生Harness状态机或107-C页面。

## 设计追溯

需求：可靠导入、隔离与恢复；业务：上传→建批→逐文件解析→待审，不自动发布；功能：版本化knowledge.objects.upload.v1、imports create/list/get/retry/cancel及既有服务端身份授权；页面：批准#imports（无UI任务填不适用）。逐AC的精确输入/状态语义优先于概览。新状态/权限/契约缺口先由ChatGPT修订，不自行扩大产品。

## 实施步骤

1. 核对上列设计版本和依赖，记录实际SHA、唯一修改人/目录，列已有代码与缺口，保留旧审查证据。
2. 提交下表AC→实际测试文件/用例/合成夹具/屏障的映射，由ChatGPT预检可执行性；不得只报测试总数。
3. 对缺口提供确定性反例，实施最小修订；沿用npm锁文件和公开窄适配，不触及上游核心/真实公司数据/生产配置。
4. 运行下表适用检查及相关回归，附固定head、命令/环境/日志和失败/未运行项，提交一个结果PR至integration。
5. 预审通过且有效CI通过后自动合并；满足本任务全部AC后关闭。人工体验和发布另记，父Tracking不自动关闭。

## 冻结验收矩阵

| AC | 操作/夹具/交错 | 预期及量化断言 | 测试层 |
| --- | --- | --- | --- |
| RUN-01 | 同file处于parsing且未写业务对象时SIGKILL，确认真实exit；同schema/root重启 | 文件/批次按既定LEASE_EXPIRED收敛，经真实API retry后只有1个来源；片段集等于独立夹具预期，无半套/重复片段 | 真实隔离PG/API/CLI及子进程故障测试 |
| RUN-02 | 屏障令取消分别先于解析错误、deadline、最终提交；旧lease A晚到而新B已完成 | API/函数/DB文件/批次结果一致；A成功/失败/取消路径均不能覆盖B；取消后无来源/片段新增；超时线程确实停止 | 真实隔离PG/API/CLI及子进程故障测试 |
| RUN-03 | 授权检查后、提交前交错撤销credential/角色/部门或归档 | 共享串行边界有明确先后关系；撤销先完成则0后续业务写；提交先完成则结果有唯一授权时点，不静默提权 | 真实隔离PG/API/CLI及子进程故障测试 |
| RUN-04 | 真实PDF空首页第二页正文、DOCX两段→API上传→worker→source读取 | 原文hash与提取文本hash分别匹配夹具，页码=2/段索引精确匹配；读回正文相等，CLI/API同权负例一致 | 真实隔离PG/API/CLI及子进程故障测试 |

## 证据与关闭条件

每AC附测试路径/用例、固定输入hash/独立预期、实际环境/SHA/运行链接；未执行不算通过。既有命令建议：`node --test apps/control-api/test/knowledge-imports.test.mjs`（隔离TEST_DATABASE_URL）、`node --test apps/control-api/test/product-web.browser.mjs`（对应依赖齐全后）、CLI对应测试与相关构建。最终回执必须列实际使用的命令，不声称未跑项已通过。

本任务仅在上述全部适用AC与相关回归通过、技术预审完成且精确head合入integration后关闭；不能以别的任务未完成拖延本任务的独立验收，也不能用本任务通过代替全产品人工验收。发布默认未授权。
