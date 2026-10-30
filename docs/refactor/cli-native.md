# 公司OA的CLI优先接口

2026-10-29。当前产品是以DeepSeek Harness为基座的公司OA，临时首页使用原生Web；具体业务模块以后规划。CLI规则保留，首先覆盖Harness运行、会话、模型、工具、权限与诊断。

## 一套能力，多种入口

Web、nuochong CLI与未来MCP使用同一版本化能力契约和服务端授权，不各写状态机，不直连数据库，不将原生dsh owner管理面直接下放给一般AI或员工。外部AI先发现commandId/schema，再通过参数数组及JSON stdin调用；不把模型文本拼成shell。

| 能力 | 目前状态 |
| --- | --- |
| capabilities/schema/help/version | 独立客户端离线可用 |
| --dry-run | 本地输入验证/请求预览；不检查真实权限/额度，不联系服务端 |
| runs create/get/cancel/events | HTTP客户端已实现；正式OA控制API实现位于apps/control-api，与原生Web网关协议分离；新API尚未公网发布 |
| session/model/tool/runtime/auth等 | OA-02/OA-04实现20项共享契约/CLI映射，真实数据库与模型证据分别记录 |
| 知识/培训/工单等业务命令 | 不在当前计划或能力清单中，未来需求确认后另行定义 |
| MCP | OA-03提供受限stdio适配，使用同一契约和API授权；流式事件仍通过CLI，不开放管理员工具 |

当前代码与运行方式见[CLI包](../../tools/nuochong-cli/README.md)。原生Web端口不是产品CLI控制API；本次在隔离真实PostgreSQL上验证正式API/CLI，真实模型证据见控制API包结果，不把合成故障算作真实模型。

## 机器协议

普通结果stdout单行JSON，流式结果stdout为NDJSON；错误stderr为JSON，退出码稳定。能力清单含输入/输出schema、副作用、幂等、可用性及流式语义，本地清单不是账号的实时权限。

创建运行需要调用方稳定幂等键；202只代表受理，读取/事件也可能成功返回failed业务终态。客户端不自动重试写请求或跟随重定向。deadline有界；SIGINT只停止客户端跟随，不偷偷取消远端任务。持久事件cursor可恢复，瞬态token不持久化。

服务端决定身份/资源权限，客户端不能提供tenant/user/roles覆盖。新Harness运行DTO不强制企业tenant字段，保留服务端actorId与资源所有权。CLI不使用DeepSeek/GitHub密钥作为登录凭据。

写入、工具配置、权限改变和未来审批须由相同服务端策略校验；--dry-run不等于批准，当前不提供--yes/--force来跳过授权。不可实现的身份人类步骤要明确说明，不能用演示认证回退。

## 六个任务中的责任

| 任务 | CLI工作 |
| --- | --- |
| OA-01 | 独立安装/工作区和共享能力/schema，承接当前tools/nuochong-cli；原生运维启动器保留官方日志格式 |
| OA-02 | 交付正式运行/会话/配置API与一致事件/取消响应；原生SDK终态正确映射 |
| OA-03 | CLI接真实API、补已交付核心命令，验证受限MCP和实际外部AI使用；无通用exec后门 |
| OA-04 | 用户/受限服务身份、资源归属、撤权，CLI/Web/MCP同权 |
| OA-05 | 并发/超时/用量/审计、跨进程授权和安装/契约CI；未知用量不记0 |
| OA-06 | 同一版本真实模型＋API＋CLI/MCP和原生首页验收后，才规划首个OA业务模块 |

未来每个产品能力PR必须有commandId/schema、CLI映射、授权/副作用/幂等说明、成功/错误机器示例和负例测试。纯布局/视觉交互无须强行变成命令；只有UI按钮或mock成功不能算业务功能完成。

未来MCP适配参考[官方工具协议](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)，复用能力元数据及schema；stdio适配和DeepSeek模型真实工具调用验证见tools/nuochong-mcp/README.md。旧B—E矩阵已被[OA路线图](roadmap.md)取代，旧估算不能套用于当前CLI增量。
