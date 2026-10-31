# A-05 业务契约草案

JSON Schema Draft-07。在仓库根目录执行`node experiments/phase-a/contracts/verify-contracts.mjs`；当前验证器复用根锁文件Ajv6.15.0，无新增生产依赖。B-01提取契约包时显式声明验证器依赖。

## 信任边界

actor.schema仅描述服务端构造的身份结构；结构合法不证明身份可信。create-run是客户端入站数据，禁止携带tenantId/userId/roles等覆盖字段，额外字段直接拒绝而非静默采纳。服务端完成认证、成员/资源授权后才调用领域服务。A-08验证实际签名和授权，而不是用这些schema冒充隔离已实现。

## HTTP契约

| 路径 | 语义 |
| --- | --- |
| POST /api/ai/runs | 校验create-run；服务端绑定ActorContext和策略；同企业/用户/用途的幂等键唯一；返回202与runId |
| GET /api/ai/runs/:id | 按企业及资源权限读取状态/最终结果；未知或不可访问资源不泄露存在性 |
| GET /api/ai/runs/:id/events | 先授权，SSE提供持久日志与实时token；日志重连按Last-Event-ID补齐并去重 |
| POST /api/ai/runs/:id/cancel | 幂等记录取消请求；已成功/失败的终态不被覆盖，冲突返回409 |

持久event的sequence在同run内严格递增；只能在日志事务提交后发布，重连补齐不能产生缺口。实时token单独使用无持久cursor的SSE事件，不进入此event.schema，不承诺断线后逐token恢复。最终结果/终态必须可重读，不能仅存在于实时流。

错误类：unauthorized(401)、forbidden(403)、not_found(404)、conflict(409)、invalid_input(422)、限流(429)、provider_error(502)、unavailable(503)、timeout(504)。生产错误包只返回code/requestId/安全摘要，不返回凭据、堆栈或原始上游响应。

run.version用于乐观并发；状态变更及租约更新须事务仲裁。合法状态不等于合法流转；任务状态机/终态唯一性由A-07验证，不由JSON schema保证。schema版本随契约产物管理；破坏性变化必须带迁移及旧客户端兼容策略。

当前fixtures仅验证结构、入站额外身份字段拒绝、枚举与序号/时间格式，不宣称模型调用、数据库、HTTP服务、跨企业访问或外部IdP已经实现。
