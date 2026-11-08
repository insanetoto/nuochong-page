# W0设计确认与R1有限准入验收记录

2026-11-08 · 记录执行者：ChatGPT / Codex。

负责人在会话明确回复：

> 批准确认单，允许合并

批准证据：[https://github.com/insanetoto/nuochong-page/issues/103#issuecomment-6717796754](https://github.com/insanetoto/nuochong-page/issues/103#issuecomment-6717796754)。确认对象为PR #121的f681b99及w0/admission.md；原型5a172f5继续有效，不重复验收。

## 合并与固定基线

| PR | 目标 | 实际merge SHA |
| --- | --- | --- |
| [#121](https://github.com/insanetoto/nuochong-page/pull/121) | `codex/knowledge-v2-prototype` | `1456216b5e5b52d995a8bb6d77486df4cc08a3b2` |
| [#100](https://github.com/insanetoto/nuochong-page/pull/100) | `docs/knowledge-v2-ontology-design` | `1250d94dfbe41b8214661037d364f3bd29a0d4f8` |
| [#99](https://github.com/insanetoto/nuochong-page/pull/99) | `refactor/integration` | `ed15df85b834d4a7fbc7637678ab98866c4c9e11` |

**DeepSeek获准的实施基础SHA：`ed15df85b834d4a7fbc7637678ab98866c4c9e11`（refactor/integration）。** 后续本验收记录的文档提交不改变此代码/设计基线；领取时阅读Issue #104的最新准入说明，不要求该文档能在其自身历史父提交中出现。

合并前核对head/base、CI和无冲突；未使用admin绕过，未推main/test。CI结果见PR/Actions，当前基线记录与实际merge一致；本记录只涉及设计与限定开工，不声称v2实现已测试。

## 验收与任务状态

- PLAN-01 / #101：D01—D14和实际差异/共享IAM设计获得负责人确认，设计任务Accepted。
- PLAN-02 / #102：35项契约及hash/兼容设计获得确认，设计任务Accepted。DeepSeek实现中的可实现性反馈继续走变更，不将结构测试冒充业务验证。
- PLAN-03 / #103：**仅R1子出口Accepted**，完整运行准入未完成，父Issue保持Open。#94风险没有被接受或关闭。
- KBV2-01 / #104：**Ready，执行者DeepSeek，预审ChatGPT，最终产品验收负责人确认**。依赖为`PLAN-03:R1`，不要求整个#103关闭；JSON保留dependsOn=PLAN-03并以dependencyExits.R1明确分项，禁止工具只看父Issue是否关闭。
- 其余任务保持Planned和原有依赖。R1不授权02迁移或后续运行集成、媒体、真实资料与部署。

## #104允许范围与工作方式

仅packages/platform内离线本体/manifest/schema加载、命名空间/版本/依赖/深只读校验、明确command major allowlist及既有插件测试；可以添加plugins/knowledge静态描述及相关测试。不得启用新业务处理器，运行命令仍59。不得改身份/授权/任务/Worker/数据库/发布审批，不处理真实资料、不部署。

DeepSeek从上方固定SHA创建独立codex分支/工作目录，阅读[本体实现规范](ontology-spec.md)及schema，完成[Issue #104](https://github.com/insanetoto/nuochong-page/issues/104)的实现与测试后开PR到refactor/integration。该任务期间platform注册文件由该实现任务独占；锁文件/新增依赖需求先反馈，未授权的共享文件不自行修改。ChatGPT负责预审，人工产品验收和发布分别记录。

## 完整W0尚未解除的条件

#94须提供复现、撤权无继续披露、唯一终态及回归证据，或由负责人另行明确决定运行风险；不能用本次R1授权代替。首个运行任务的具体准入、部署和生产授权依然独立。
