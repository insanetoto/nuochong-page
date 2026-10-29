# ADR-009：CLI优先与外部AI接入

状态：Proposed，2026-10-29用户要求未来产品功能CLI化；本次基础实现及更新后的OA范围待增量验收。关联Issue #31。

每项新增产品能力必须有稳定commandId、输入/输出schema、权限/副作用/幂等与版本，再提供CLI和Web映射；未来MCP复用相同契约与API，不另写业务规则，不用后端shell执行任意CLI字符串。

当前范围由[ADR-010](ADR-010-oa-harness-product-scope.md)确定：先覆盖Harness运行/会话/模型/工具和OA基础身份，业务模块未来独立规划。CLI不等于公开原生dsh owner权限；服务端控制凭据、资源和工具授权。

当前tools/nuochong-cli是独立、未发布的无依赖Node客户端，提供离线发现/预检与运行HTTP客户端；正式OA API待OA-02。创建/event DTO保留A-05传输语义，新运行DTO去除未建设企业业务的tenant要求；历史A-05实验契约不重写。

当前验证器仅支持自己发布的基础JSON Schema子集，遇未知特性失败；OA-01提取共享契约与生成流程。已发布版本的破坏性变更必须保留兼容策略，不能把客户端契约当成服务端权限许可。

原生OA启动器是本机管理员运维命令，使用官方启动认证和日志；产品客户端仍保持JSON/NDJSON通道，不把启动owner凭据塞入普通AI调用协议。

设计边界、覆盖与验收见[CLI规范](../refactor/cli-native.md)。[MCP工具协议](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)供后续适配参考，本次不声称MCP服务或外部AI账号已经连接。
