# ADR-004：通过官方 SDK 集成独立 Harness 进程

状态：Accepted（2026-10-29，用户明确批准A-10 Go；采纳为B阶段架构基线，不代表生产能力全部交付）。

## 背景

官网继续独立静态发布；业务平台需要可创建、跟踪和取消的AI执行能力，并保留自身身份、业务任务与数据权威。直接把业务页面绑定到Harness内部接口会扩大上游升级影响。

## 已采纳方案

使用官方`@deepseek-ai/dsh-sdk-client`驱动同版本`@deepseek-ai/dsh`具名Profile，业务只依赖自有harness-adapter契约；Host作为受管理的独立进程。候选版本均为0.2.1-rc.2，锁定传递依赖。默认路由deepseek-official/deepseek-v4-flash已通过锁定版本初始化实测，无模型请求。

sdk与sdk-minimal均用于A阶段验证。生产Profile需在A-05/A-06明确插件、工具和权限白名单，不能认为名称含minimal就天然满足企业隔离。

## 备选

| 方案 | 取舍 |
| --- | --- |
| 官方SDK＋独立Host | 推荐；复用进程生命周期/协议，仍需业务适配与运行隔离 |
| 直接开发公开Gateway/BFF | 可满足已有Web客户端扩展，但需额外验证信任面和多用户授权，当前不作为默认 |
| 修改上游核心或私有导入 | 不采纳；版本升级和契约测试成本高 |
| 只借鉴插件模式、不使用真实Harness | 不满足本次实际接入Harness目标 |

## 证据与局限

见[隔离原型](../../experiments/phase-a/runtime/README.md)及其results。两个Profile完成真实SDK初始化/关闭；干净安装复验另记录。环境为Node24.21.0/macOS arm64；Linux x64启停、工具和受控Host部署已由后续原型验证；Host的Node22兼容性未验证。不把初始化视为真实模型、工具、断连恢复、多租户或生产压测完成。

## 升级与撤回条件

CLI/SDK同版本升级，在独立PR重跑干净安装和启动、A-06契约与故障测试。若公开接口无法表达取消、状态/结果归属或受控工具授权，则补充官方支持的集成方案原型并修订此ADR；不以私有接口临时绕过。

## A-06 原型补充（2026-10-29，待阶段验收）

实测默认SDK不发布实时token通知；采用自有Profile插件，通过公开服务类与agent/assistant-stream Hook桥接，继续使用官方SDK管理子进程，未访问私有接口。只将持久根会话completed终态映射成功，不能用SDK返回idle代替成功。取消原型采用每次执行独占子进程并关闭；成本和资源将在A-09验证。详见[实测矩阵](../../experiments/phase-a/results/runtime.md)。ADR保持Proposed，生产采纳仍待A-10。

## A-10最终采纳记录

用户在当前会话明确回复“批准 A-10 Go”。A-06真实模型、工具、取消/断流/会话恢复与A-09容器启动已验证。采用公开Hook/服务类的部署自有流式桥，不能把idle当成功；仅根会话completed映射成功。RC与桥协议升级必须重新测试。Host原生模块使用有界私有exec缓存，普通tmp/state保持noexec，不使用privileged绕过。证据与遗留责任见[阶段评审](../refactor/phase-a-review.md)；后续改变版本、边界或冻结指标须独立记录并重测。

## 当前产品范围变更

2026-10-29起，公司OA以Harness为基座。本文保留已验收技术决策历史；旧业务迁移义务和B—E阶段产品范围由[ADR-010](ADR-010-oa-harness-product-scope.md)及[新路线图](../refactor/roadmap.md)替代，不自动恢复旧业务模块。
