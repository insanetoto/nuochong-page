# A-08 企业与工具隔离验证

2026-10-29；基线 `79013374268cdbbf7b9936965b952e59a1e8c675`。状态：本机及Linux均26/26通过，待人工验收。

实现与威胁边界：[isolation/README.md](../isolation/README.md)。本机Node24.21.0/macOS arm64，真实RSA签名及ToolRuntime，合成issuer和内存资料；不是生产OIDC联调、数据库RLS或跨进程权限缓存验证。

覆盖4用户的企业文档/下载和私有会话/运行、签名/issuer/audience/有效期/算法/key注入拒绝、伪造tenant/owner角色、服务端Actor伪造、工具白名单、未批准写入、审批跨资源/运行重放及过期、5次并发消费只成功1次、guard后撤权、审批人撤权、上传边界及审计脱敏。所有拒绝无副作用；2次明确授权的合成写入是正例，不计为违规。

远程技术提交8b0b5fb：[Harness 40828562923](https://github.com/insanetoto/nuochong-page/actions/runs/40828562923)成功，产物已下载核对，原始脱敏报告见[Linux证据](../isolation/results/linux-isolation.json)。双构建40828563014、E2E40828562998均成功。审批期满使用注入时钟；跨进程持久审批不在本原型结论内。
