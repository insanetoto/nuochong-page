# OA-04 公司访问基础验收

2026-10-30；Issue #35，独立分支feature/oa-04-access。OA-01已获人工验收；复用OA-02正式API/持久身份底座，并独立完善角色变更、自助撤权和Native owner隔离验收。技术实现完成，[PR #47](https://github.com/insanetoto/nuochong-page/pull/47)及远程检查通过；整体人工验收已通过。

## 实际身份方案

本阶段采用管理员线下配置、随机256bit opaque bearer凭据。主体/角色、凭据摘要、scope、期限、撤销和epoch存储在PostgreSQL，不是内存demo、合成issuer或固定测试口令。首次管理员仅可在空身份库由私有运维命令创建；没有公开bootstrap/匿名登录回退。外部OIDC/企业SSO和员工Web登录本次未接入，不冒称已交付。

员工/服务初始入口为正式API/CLI，管理员负责provisioning。原生Harness Web保持独立owner认证，仅供管理员测试，API的admin身份也不能兑换原生owner链接或转发其管理RPC。服务器/数据库运维管理员仍是受信任运维角色，与API内admin权限区分。

## AC与证据

| 要求 | 实现/实测 |
| --- | --- |
| 管理员/普通使用者与受限服务边界 | 成员/服务不能管理身份/凭据/模型配置；service不能提升为admin；最后活跃管理员不得降级/停用 |
| 服务端身份与资源归属 | request/body/header/JWT/Native cookie都不能覆盖身份，运行/会话/history只读本主体，API管理员也不自动读取他人私有数据 |
| 真实凭据与限权 | 只存令牌摘要，按7个共享scope限制；过期401、撤销401、主体停用失效，不缓存陈旧角色/权限 |
| 角色变更与撤权 | 角色变化递增epoch，使全部旧凭据失效；提升后需重新签发，降级不能留下旧admin凭据；同状态启停幂等 |
| 自助退出 | auth logout只撤销当前认证凭据，不接受客户端指定他人credentialId；CLI调用与API同权，其他主体不受影响 |
| 已有连接/运行撤权 | SSE每100ms重验，Worker心跳重验并关闭SDK；实测撤销期间的运行cancelled、stream停止，未发送成功终态或后续私有结果 |
| 不开放Native owner能力 | 成员及API管理员调用owner/RPC/settings/plugin/tool-exec未注册路径均404；Native cookie/JWT/伪造身份头无API凭据时401 |
| 拒绝无副作用 | 未授权管理/配置写入403；伪造身份/非法文本400、跨资源404，数据库无额外运行/身份副作用 |
| CLI原生接口 | 22项共享commandId/schema/HTTP/CLI映射；auth me/logout、principal create/list/set-active/set-role、credential create/list/revoke，单独包离线安装与真实API联调通过 |

本机正式API测试23/23通过，既有CLI协议18/18及独立离线安装包通过；使用真实PostgreSQL17.11、真实HTTP和CLI；角色/撤权场景使用合成主体，生产代码无fixture执行或身份开关。进程重启后的权限仍从数据库读取；实际API子进程重启、另一进程提交撤销后立即401已验证。

[Linux CI](https://github.com/insanetoto/nuochong-page/actions/runs/40998085551)同样23/23通过，并通过真实无凭据SDK启动/关闭；[CLI双Node矩阵](https://github.com/insanetoto/nuochong-page/actions/runs/40998085656)、[官网双构建](https://github.com/insanetoto/nuochong-page/actions/runs/40998085588)、[Playwright E2E](https://github.com/insanetoto/nuochong-page/actions/runs/40998085608)、[架构契约](https://github.com/insanetoto/nuochong-page/actions/runs/40998085609)均通过。官网源码/资产/URL/SEO未改动；本次未重新运行专用Linux像素基线检查，不将macOS结果冒充该检查。

真实模型与身份测试分别记录：OA-02最终模型验收矩阵为5个提交轮次；开发复验额外执行2轮和4轮，累计11个提交轮次，provider HTTP请求数（含工具续调用）未逐一计量，费用金额unknown。模型密钥仅本机使用，没有传入GitHub Actions；报告不含密钥、令牌或私有原始内容。

## 决策与发布边界

[ADR-011](../adr/ADR-011-oa-control-and-access.md)记录采用的控制面与身份方案；[访问/部署手册](../../apps/control-api/README.md)包含权限矩阵、迁移/初始化/撤权命令及独立服务模板。未新增公网控制API或员工Web入口，没有改动现有Native测试页面及main/test发布。后续公网推广需要专用数据库、TLS入口和服务凭据配置；MCP属于OA-03，运营审计/限流/灾备属于OA-05。

状态：Accepted。2026-10-30用户在会话中明确确认：“OA-02、OA-04 均验收通过”。 #35关闭为completed，OA-05设Ready，不自动开工或发布。
