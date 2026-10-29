# A-08 企业与工具授权原型

基线：`79013374268cdbbf7b9936965b952e59a1e8c675`。夹具：2个企业、每企业2用户、各2份内容不同的同名文档，以及各用户私有会话和运行。

```sh
npm ci --prefix experiments/phase-a/runtime --ignore-scripts --no-audit --no-fund
node experiments/phase-a/runtime/verify-isolation.mjs
```

复用A-04锁定的隔离运行环境，使用其已显式声明的公开Cordis/SystemPrompt/ToolRuntime入口；不依赖A-06适配层内部实现。真实RSA签名、真实ToolRuntime guard和工具正文复验；身份提供方、成员、资料和审批均为合成内存夹具。没有调用真实IdP或模型。

## 信任边界

- 签名校验限定服务端固定key/RS256、issuer、audience和有效期，不加载客户端给出的jku/kid URL。参考[OpenID Connect身份校验原则](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation)。本实现仅用于验证边界，**不是完整OIDC客户端**，不用于生产登录；真实code flow、nonce、JWKS轮换和外部账号由B-02使用维护中的OIDC库实现。
- tenant/role来自服务端成员映射，JWT扩展字段、模型参数和客户端Actor拷贝不能提升权限。Actor由服务端创建并通过WeakSet验证；该进程内能力不能直接序列化为跨服务凭据。
- 同企业文档共享；会话/运行仅本人可读。下载再次调用同一授权边界，原型不访问真实S3。对象路径遍历和跨企业资源均拒绝。
- 每次调用由服务端生成callId并绑定Actor/run；真实ToolRuntime全局guard拒绝缺少绑定的调用，宿主owner工具即便已注册也不能获得放行。嵌套工具默认同样拒绝，未来需显式传递受限能力。
- 写操作审批绑定tenant/user/run/document/固定动作和30秒有效期；消费前复核成员及审批人角色，一次消费。执行正文再次授权，防止guard后撤权。过期测试使用可注入时钟，不等待30秒。
- 并发重放在此单进程内只成功一次；不能据此宣称跨进程审批原子性。B-04/B-05需持久事务消费、幂等及撤权传播测试。
- 原型createRun仅验证身份输入边界，不替代A-07的持久幂等任务。上传限制为10MiB UTF-8纯文本；未实现PDF解析、杀毒或生产对象存储。
- 审计只记录生成的requestId、固定动作和允许/拒绝；不记录JWT、提示词或资料内容。生产审计的企业/资源字段、保留策略和导出在B阶段实现。

## 结果

本机26/26通过，接受2次有授权的合成写入，未授权宿主工具执行0次；拒绝场景无新增写副作用。[本机报告](results/darwin-isolation.json)。Linux由Harness runtime probe复验，报告见[结果汇总](../results/isolation.md)。
