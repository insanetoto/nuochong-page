# V2补充质量与发布任务（2026-11-08）

2026-11-11当前状态：#106已合并部署隔离测试（a6d9a5e）；#107 Ready并顺序接管共享文件，见[开工卡](task-107-kickoff.md)。原20项与6项发布质量任务统一台账为26项，发布设计仍与运行实现分别验收；完整V2未上线。见[发布记录](release-2026-11-11.md)与[复盘改进](retrospective-2026-11-11.md)。下方旧状态为历史快照。

原20项功能/设计任务保持ID与范围；新增6项，总计26项。ChatGPT负责设计规划、原型和技术预审；DeepSeek实现代码/测试/部署工具；负责人确认设计、人工验收和具体发布。角色不等于共享账号个人Assignee，实际成员领取时登记。

[流程](release-process.md) · [16条验收矩阵](release-acceptance.md) · [统一JSON台账](execution-plan.json)

| ID / Issue | 任务 | 状态 | 依赖 |
| --- | --- | --- | --- |
| [KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125) | V2原型到验收用例追踪与发布规则冻结 | In review | [PLAN-01 #101](https://github.com/insanetoto/nuochong-page/issues/101)、[PLAN-02 #102](https://github.com/insanetoto/nuochong-page/issues/102) |
| [KBV2-REL-02 #126](https://github.com/insanetoto/nuochong-page/issues/126) | V2真实业务浏览器E2E与原型验收负例 | Planned | [KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)、[KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106)、[KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107)、[KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109)、[KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110)、[KBV2-08 #111](https://github.com/insanetoto/nuochong-page/issues/111)、[KBV2-09 #112](https://github.com/insanetoto/nuochong-page/issues/112)、[KBV2-14 #113](https://github.com/insanetoto/nuochong-page/issues/113)、[KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108)；PLAN-03:FULL |
| [KBV2-REL-03 #127](https://github.com/insanetoto/nuochong-page/issues/127) | V2 Linux视觉基线、交互可达性与设计一致性门禁 | Planned | [KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)、[KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106)、[KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107)、[KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109)、[KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110)、[KBV2-09 #112](https://github.com/insanetoto/nuochong-page/issues/112)、[KBV2-14 #113](https://github.com/insanetoto/nuochong-page/issues/113)、[KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108)；PLAN-03:FULL |
| [KBV2-REL-04 #128](https://github.com/insanetoto/nuochong-page/issues/128) | V2不可变候选产物、测试部署、版本核验与发布预检 | Planned | [KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)；PLAN-03:FULL |
| [KBV2-REL-05 #129](https://github.com/insanetoto/nuochong-page/issues/129) | 独立知识库生产环境方案、隔离配置与恢复演练 | Planned | [KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)、[KBV2-REL-04 #128](https://github.com/insanetoto/nuochong-page/issues/128)；PLAN-03:FULL |
| [KBV2-REL-06 #130](https://github.com/insanetoto/nuochong-page/issues/130) | V2 P1生产发布批准、执行核验与交付记录 | Planned | [KBV2-11 #115](https://github.com/insanetoto/nuochong-page/issues/115)、[KBV2-REL-04 #128](https://github.com/insanetoto/nuochong-page/issues/128)、[KBV2-REL-05 #129](https://github.com/insanetoto/nuochong-page/issues/129)；PLAN-03:FULL |

原#115新增依赖#126/#127/#128，负责同一RC的联合验证与负责人验收；#130在#115和生产准备后执行。没有另建重复联合验收任务。#94/FULL仍待处理，不把本次规划误记为已批准运行风险。

## KBV2-REL-01 · #125 V2原型到验收用例追踪与发布规则冻结

- 主责：ChatGPT设计；DeepSeek评估可测试性；负责人确认新增规则。
- 状态：In review；依赖：[PLAN-01 #101](https://github.com/insanetoto/nuochong-page/issues/101)、[PLAN-02 #102](https://github.com/insanetoto/nuochong-page/issues/102)。
- 范围：完成release-process.md和release-acceptance.md；确认P1范围、16条AC、页面/动作/状态/命令/任务映射，保留批准原型不重绘。
- 允许目录：`docs/product/knowledge/v2/`、`docs/refactor/`。

验收标准：

- [ ] 全部10类原型页面和P1关键状态有AC与唯一实现归属；明确v0兼容测试与v2验收测试边界。
- [ ] 旧首页/缺图谱/缺三来源模块必须失败；确认设计已输出与实际测试通过分别登记。
- [ ] DeepSeek提供测试可行性反馈；负责人确认新增发布规则，不能伪造确认。

## KBV2-REL-02 · #126 V2真实业务浏览器E2E与原型验收负例

- 主责：DeepSeek实现；ChatGPT设计预审；负责人验收。
- 状态：Planned；依赖：[KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)、[KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106)、[KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107)、[KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109)、[KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110)、[KBV2-08 #111](https://github.com/insanetoto/nuochong-page/issues/111)、[KBV2-09 #112](https://github.com/insanetoto/nuochong-page/issues/112)、[KBV2-14 #113](https://github.com/insanetoto/nuochong-page/issues/113)、[KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108)。另需PLAN-03:FULL；具体环境/部署授权另记。
- 范围：新增独立v2功能验收套件、真实API/PG合成夹具与CI；保留v0兼容套件，不以拦截API假响应代替集成。按页面增量交付，完整验收等待全部依赖。
- 允许目录：`apps/control-api/test/`、`.github/workflows/`、`tests/`。

验收标准：

- [ ] 覆盖V2-HOME-01至V2-STATE-12及联合场景，包含两类身份、空态、失败、撤权、审批失效、并发、幂等、断线和任务恢复。
- [ ] 旧v0首页、首页出现创建表单、缺图谱或任一三来源模块时明确失败，报告AC→测试文件/用例映射。
- [ ] 模型合成响应与真实模型验证分开，测试不向客户库写数据；错误脱敏，日志不含密码/token。

## KBV2-REL-03 · #127 V2 Linux视觉基线、交互可达性与设计一致性门禁

- 主责：DeepSeek实现；ChatGPT对照原型审查；负责人确认真实Linux基线。
- 状态：Planned；依赖：[KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)、[KBV2-03 #106](https://github.com/insanetoto/nuochong-page/issues/106)、[KBV2-04 #107](https://github.com/insanetoto/nuochong-page/issues/107)、[KBV2-06 #109](https://github.com/insanetoto/nuochong-page/issues/109)、[KBV2-07 #110](https://github.com/insanetoto/nuochong-page/issues/110)、[KBV2-09 #112](https://github.com/insanetoto/nuochong-page/issues/112)、[KBV2-14 #113](https://github.com/insanetoto/nuochong-page/issues/113)、[KBV2-15 #108](https://github.com/insanetoto/nuochong-page/issues/108)。另需PLAN-03:FULL；具体环境/部署授权另记。
- 范围：固定Linux/浏览器/字体/数据/图谱种子，桌面与移动实际页面截图对照原型，建立批准后的真实产品基线及后续视觉比较。
- 允许目录：`apps/control-api/test/`、`tests/`、`.github/workflows/`、`docs/product/knowledge/v2/`。

验收标准：

- [ ] 全部P1页面至少正常与空/错误状态，关键权限/抽屉/对话框；1440x1000与390x844无遮挡/整页溢出，键盘、焦点恢复、Escape、减少动画与图谱列表替代通过。
- [ ] 首次真实Linux基线由ChatGPT预审并由负责人确认；原型HTML不直接当真实页面逐像素基线；只保存截图、macOS截图、自动更新基线都不能算通过。
- [ ] 截图差异、缺基线或未批准基线时CI明确未通过；不能整块遮蔽图谱/操作/空态，真实图数据仍来自服务端。

## KBV2-REL-04 · #128 V2不可变候选产物、测试部署、版本核验与发布预检

- 主责：DeepSeek实现；ChatGPT契约及运维方案预审；负责人批准具体测试部署。
- 状态：Planned；依赖：[KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)。另需PLAN-03:FULL；具体环境/部署授权另记。
- 范围：设计并实现API/Worker/Web/迁移/CLI版本关联的完整RC产物、清单、digest、版本查询、发布前证据检查和已有隔离测试的可恢复更新。禁止沿用六文件补丁为完整V2部署。
- 允许目录：`.github/workflows/`、`apps/control-api/deploy/`、`apps/control-api/src/`、`apps/control-api/test/`、`apps/product-web/`、`packages/contracts/`、`tools/nuochong-cli/`、`docs/product/knowledge/v2/`。

验收标准：

- [ ] 固定sourceSha/artifactDigest；测试与生产提升同一不可变产物，前后端实际版本可核验；不从浮动分支重建，不把官网deploy视为知识库deploy。
- [ ] 发布预检对缺必选AC/错SHA或digest/未验收或缺明确人工确认返回失败，stage明确preview/candidate/production；--yes与dry-run不得绕过。
- [ ] 合成备份/迁移/恢复演练；应用回退和数据恢复分别处理，保留账号/模型配置，不复用已删除bootstrap凭据；实际测试部署需单独具体授权。
- [ ] 只读版本查询按本任务planned契约补能力清单、schema、CLI和API/CLI同权负例；未实现前不可注册ready。

## KBV2-REL-05 · #129 独立知识库生产环境方案、隔离配置与恢复演练

- 主责：ChatGPT先设计；负责人确认环境及成本；DeepSeek按批准方案建设。
- 状态：Planned；依赖：[KBV2-REL-01 #125](https://github.com/insanetoto/nuochong-page/issues/125)、[KBV2-REL-04 #128](https://github.com/insanetoto/nuochong-page/issues/128)。另需PLAN-03:FULL；具体环境/部署授权另记。
- 范围：方案先行：知识库生产URL/路径、网关TLS、服务/数据库/对象/凭据/模型隔离、容量成本、监控告警、验证账号、备份恢复与运行手册；批准后实施环境，尚不开放V2流量。
- 允许目录：`docs/product/knowledge/v2/`、`apps/control-api/deploy/`、`.github/workflows/`。

验收标准：

- [ ] 负责人明确批准生产环境/URL/资源及成本；与隔离测试DB、对象、账号、密钥分离，不把官网静态生产目录当知识库生产。
- [ ] 无凭据入库/入日志，最小权限、TLS/访问/监控/备份及隔离负例通过；不开放普通员工owner接口。
- [ ] 在隔离恢复副本恢复DB+对象且校验完整；冻结失败阈值、观察窗口、责任人和停写/回退流程；未确认生产路径不得标Ready。

## KBV2-REL-06 · #130 V2 P1生产发布批准、执行核验与交付记录

- 主责：ChatGPT整理发布单；负责人批准实际版本/环境；DeepSeek执行；ChatGPT核验回填。
- 状态：Planned；依赖：[KBV2-11 #115](https://github.com/insanetoto/nuochong-page/issues/115)、[KBV2-REL-04 #128](https://github.com/insanetoto/nuochong-page/issues/128)、[KBV2-REL-05 #129](https://github.com/insanetoto/nuochong-page/issues/129)。另需PLAN-03:FULL；具体环境/部署授权另记。
- 范围：汇总测试RC、人工验收、Linux基线、风险和迁移恢复证据，待负责人批准具体SHA/digest和生产环境后发布；验证真实页面和受控合成业务，标记最终范围。
- 允许目录：`docs/product/knowledge/v2/`、`.github/workflows/`。

验收标准：

- [ ] #115负责人验收与REL-05环境准备完成；发布单列16条AC全部结论、RC SHA/digest、批准原型、版本/迁移、备份、回退、URL和明确发布批准；不复用KBV2-01旧授权。
- [ ] 发布同一验收产物；认证后首页全景及三来源入口、合成业务、API/Worker/Web版本/任务、匿名401和监控检查通过；测试资料/临时凭据清理记录齐全。
- [ ] 失败按已演练方案停止/回退，不把恢复旧库直接丢弃新写入；成功后回填Issue/路线图及实际URL/版本/run/范围，才标V2 P1 Released；未批准生产可止步测试Accepted。

## 排序与估算

当前先完成#125设计评审和#94调查/#103完整准入；#126/#127随页面增量实现，#128可在准入后先建设候选发布能力；功能链和全部质量证据齐后执行#115；#129先设计、批准后建设，最后#130等具体发布批准再执行。DeepSeek领取前补工程估算和实际执行人，负责人据资源排日历；本轮不虚构工期。

REL-04新增只读版本能力为[planned独立候选契约](release-version-contract.json)，不改动已冻结W0的35项契约，不注入ready注册表。实现前经ChatGPT契约预审；CLI/API复用同一可信服务，未知版本不得mock成功。纯测试与视觉任务不新增业务commandId。
