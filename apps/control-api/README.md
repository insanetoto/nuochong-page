# OA正式控制API与公司访问基础

对应OA-02 #33 / OA-04 #35。Node24.21.0、Fastify5.12.7、PostgreSQL17.11/pg8.23.1、官方Harness SDK0.2.1-rc.2；独立API进程和持久Worker，不修改官网或上游核心，不依赖历史原型目录。

## 环境与启动

在完整仓库内安装此包；API仅复用CLI包的无依赖契约源码，部署产物需包含tools/nuochong-cli/src与apps/control-api。根官网依赖和锁文件不变。

```sh
npm ci --prefix apps/control-api --ignore-scripts --no-audit --no-fund
# 在服务端环境提供DATABASE_URL、OA_DATABASE_SCHEMA、OA_RUNTIME_HOME、DEEPSEEK_API_KEY
# 环境变量示例见environment.example；真实环境文件仅保存在服务器私有目录
node apps/control-api/src/migrate.mjs
node apps/control-api/src/admin.mjs bootstrap '公司管理员'
# 在两个独立进程分别运行
npm start --prefix apps/control-api
npm run worker --prefix apps/control-api
```

默认API只监听127.0.0.1:3081，迁移单独执行并校验版本1 SQL的SHA256，改动须新增版本迁移。bootstrap必须在空身份库由数据库管理员执行，一次输出随机管理员凭据，初始有效期24小时；不提供公开注册或演示登录。管理员应在到期前签发后继凭据，遗失/全部过期需由数据库管理员按受控恢复流程处置，不启用无鉴权HTTP回退。

使用专用数据库/权限：迁移角色创建schema，服务角色只授予该schema的USAGE、表DML和identity序列权限；公网数据库连接应使用已验证TLS。stateRoot须是专属可写目录，独立于原生Web的owner状态和官网静态目录，定期备份由OA-05落地。

用户级systemd模板在deploy/下，环境文件位于用户.config/nuochong-oa-control/environment，权限0600，服务UMask0077。先实际迁移/配置数据库再安装服务；模板不会自动初始化数据库或发布公网。现有测试服务器约2GB内存，正式新增数据库/Worker前须核实余量和配额，不能把该模板当作已完成线上容量验收。

## 真正的身份和权限

当前身份方案是管理员签发的256bit随机opaque bearer凭据，数据库只存摘要、作用域、有效期和撤销状态。每个主体有user/service类型和admin/member角色；service只能member。身份、归属、scope从数据库读，不能由X-User-ID、模型、JWT里的角色或请求体覆盖。没有静态mock token、演示口令或合成issuer回退。

管理员在私有终端将自己的凭据设置为NUOCHONG_ACCESS_TOKEN，NUOCHONG_API_URL指向API origin。通过`nuochong auth principals create`建立主体，再用`auth credentials create`签发限定scope/期限的凭据；凭据只在签发响应中出现一次。可用`auth credentials revoke`撤销或`auth principals set-active`停用主体。成员与服务不能管理身份/凭据或修改模型/工具权限。所有会话/运行仅归属其principal，管理员也不自动读取他人私有内容。

| 能力 | 成员/服务 | 管理员 |
| --- | --- | --- |
| auth me | 有效凭据可读自身 | 同左 |
| 运行create/cancel | 需要runs:write，仅自身 | 同左，不绕过归属 |
| 运行get/events | 需要runs:read，仅自身 | 同左 |
| 会话create | sessions:write | 同左 |
| 会话get/list/history | sessions:read，仅自身 | 同左 |
| 模型/工具/runtime读取 | config:read | 同左 |
| 版本化配置更新 | 拒绝 | admin用户且config:write |
| 主体/凭据生命周期 | 拒绝 | admin用户且auth:manage |
| 原生Web owner管理面 | 不通过本API提供 | 本API管理员也不能兑换owner凭据 |

员工初始入口为受限API/CLI；原生测试Web仍仅管理员使用。外部OIDC/员工Web登录未在本次假装实现；需要企业SSO时扩展当前principal与认证适配，保持同一服务端授权规则。

## CLI与契约

能力清单与JSON Schema来自tools/nuochong-cli/src/registry.mjs和core-commands.mjs，22项能力都有命令映射。CLI0.2.0/契约1.1，独立包无需后端依赖：

```sh
node tools/nuochong-cli/bin/nuochong.mjs capabilities --json
node tools/nuochong-cli/bin/nuochong.mjs auth me --json
node tools/nuochong-cli/bin/nuochong.mjs sessions create --input '{"name":"工作会话"}'
node tools/nuochong-cli/bin/nuochong.mjs runs create --input -
node tools/nuochong-cli/bin/nuochong.mjs models config get
node tools/nuochong-cli/bin/nuochong.mjs tools list
```

输入通过JSON/stdin；不要把密钥放argv。`runs create`输入prompt/idempotencyKey及可选sessionId；未指定sessionId时创建私有会话。相同主体/幂等键+相同输入只创建一次，冲突409。取消200/202只确认请求，终态由get/events确认。服务不自动重试写请求；配置更新需要expectedVersion，主体启停和撤销操作幂等，凭据/主体新建属于显式操作，结果不明时先查列表/核对，不盲目重发。

SSE持久生命周期事件有单调sequence/cursor，瞬态run.delta没有id、不会写入事件表；断开不自动取消运行。API每100ms重新验证连接凭据，Worker按租约心跳检查撤权并关闭SDK。已消费终态cursor返回409 STREAM_COMPLETE，应查询运行终态。单客户端瞬态积压超过64KiB/出现背压会断开，用持久cursor恢复或查状态，不能把断流当成功。

会话/身份/凭据列表每页100项，after和nextCursor基于数据库精确(created_at,id)排序；私有会话cursor仍查归属。history每页4项，确保最坏UTF8/JSON转义输入/输出也在CLI的1MiB响应上限内。普通HTTP错误只返回稳定code/requestId，不透传数据库、模型诊断或凭据。

## SDK、持久状态与恢复

SDK进程按主体/会话隔离home，每次运行独立拥有/关闭；后续轮次通过公开resumeSession恢复，缺失/被占用会话拒绝而不创建替身。根session turn/end completed才是成功，idle、子会话完成、maxTokens、错误和清理失败均不能误判。

数据库维护queued/running/retry_wait/succeeded/failed/cancelled，租约token和事务保证终态仲裁，同会话串行。dispatch前持久意图，失效任务只有未dispatch且未达到3次尝试时可重排；dispatch后结果未知终止自动重试，避免重复模型计费或未来外部写入。未知远程结果需要管理员核对，不保证任意外部系统exactly-once。

API/Worker重启不丢失事件和历史；Worker退出时回收所拥有的SDK进程，强杀后由租约恢复权威状态。令牌delta允许瞬态丢失；历史和最终文本从数据库读取。SSE客户端离开只关闭跟随，明确cancel才关闭执行进程。

只启用自有只读current_time工具；禁用文件/目录/shell工具。管理员配置只允许已验证的deepseek-v4-flash与时钟开关，不开放任意provider URL、写工具、模型密钥或插件安装。配置按run创建时快照固定；要撤销正在执行的主体权限，撤销凭据/停用主体。工具调用记录限于工具名/授权结果，不记录请求参数或私有文档。

## 验证和当前发布边界

```sh
# 必须使用隔离的真实PostgreSQL；无数据库时不会以mock跳过为成功
TEST_DATABASE_URL=... npm test --prefix apps/control-api
node apps/control-api/src/probe-sdk.mjs
node --test tools/nuochong-cli/test/*.test.mjs
node tools/nuochong-cli/test/package-smoke.mjs
# 本机真实模型专用，不在CI自动读取/传输历史密钥
TEST_DATABASE_URL=... node apps/control-api/test/verify-real-model.mjs
```

CI使用PostgreSQL17.11服务验证真实HTTP/CLI、权限、SSE、强杀/fencing和故障；故障executor仅测试注入，生产入口没有fixture开关。SDK启动检查真实进程但不调用模型。真实默认模型验收另存脱敏报告，真实提交轮数不是provider HTTP请求数，计费金额未知，不按零费用记录。

本次未将新控制API发布到现有公网Native测试路径，未改main/test、Nginx或既有模型配置；现有原生页面继续原方式运行。公网控制面推广需实际数据库、独立入口/TLS/服务凭据配置与发布验收；MCP/外部AI集成和运营稳定性仍按OA-03/OA-05执行。

OA-04补充：auth logout只撤销当前已认证凭据，不接受客户端指定目标；auth principals set-role仅管理员可用，角色变化递增主体epoch，使全部旧凭据失效，服务主体不能提升为admin，最后一个活跃管理员不能降级。重新启用同一状态不重复撤销新凭据。

最终验收证据见[OA-02报告](../../docs/refactor/oa-02-acceptance.md)和[OA-04报告](../../docs/refactor/oa-04-acceptance.md)：Linux真实PostgreSQL23/23、CLI18/18与独立包通过；技术合并与整体人工验收分别记录。
