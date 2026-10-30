# ADR-011：OA正式控制面、持久运行与最小公司身份

状态：Proposed（OA-02 #33 / OA-04 #35，待整体验收）。继承ADR-005/006的PostgreSQL与任务租约，不新增业务tenant/员工/组织领域。

## 决策

独立apps/control-api使用Node24.21.0、Fastify5.12.7、PostgreSQL17.11/pg8.23.1；API与Worker是不同进程。API不直接执行模型，数据库持有会话归属、运行/终态/幂等键、事件、调用方与凭据；每轮SDK进程独立拥有，按actor/session分离Harness持久home。

运行/事件沿用A-05传输语义，创建运行额外支持可选sessionId，未指定时创建私有会话。身份来自当前有效数据库凭据，客户端/模型不能覆盖。会话与运行归属不可越权，管理员也不自动读取他人私有内容。

最小身份方案采用管理员线下配置并签发的真实随机256bit opaque bearer凭据；数据库只存SHA256摘要、作用域、期限、撤销标记与principal epoch。无演示口令、固定mock token、合成issuer生产回退。首次bootstrap仅允许已迁移且空的身份库，在私有管理员终端一次输出管理员令牌；不是公开注册API。它不代表外部OIDC/企业SSO已经接入。

服务principal只能member角色；成员/服务凭据不得含config:write/auth:manage。每个API请求读取当前有效权限，撤销/过期/主体停用立即影响新请求；已有SSE每100ms轮询重新验证，Worker按租约心跳重新验证并关闭其SDK进程。已认证在途请求以认证时刻为授权线性化点，不承诺撤权能撤销已经完成的操作。

员工初期入口为受限API/CLI。原生Harness Web继续仅供拥有其私有启动链接的管理员使用，API凭据不能兑换该owner凭据；没有通用RPC/shell/插件管理转发入口。公司普通员工Web/SSO接入须另行设计，不将原生owner页面直接开放给员工。

## 执行、恢复与工具

使用SKIP LOCKED与会话行锁串行同会话，租约token拒绝旧Worker结算，唯一actor/idempotencyKey拒绝冲突请求。只有未dispatch且未超重试上限的失效任务可自动重排；dispatch意图在调用SDK前持久化，此后结果不确定则失败停重试，人工核对，避免重放模型计费或未来外部副作用。Worker重启恢复任务权威状态，SDK通过公开resumeSession恢复持久会话；缺失/占用会话拒绝，不静默替换历史。

只将根session的turn/end completed判为成功；idle、子session完成、耗尽、错误和清理失败都不能冒充成功。显式取消关闭拥有的整个SDK进程，API取消确认不等于立即终态；取消/完成在数据库事务中仲裁。

sdk-minimal禁用所有文件/目录/持久shell工具，只有自有只读current_time工具可选启用。模型route固定已验收deepseek-official/deepseek-v4-flash，密钥仅通过服务端环境进入SDK。管理员以expectedVersion更新版本化模型/只读工具配置；每个运行固定创建时的配置快照，撤销运行权限通过凭据/主体撤销完成。任意模型endpoint、写工具和动态插件安装均未开放。

持久事件由数据库序号提供可恢复cursor；token delta通过同schema的PostgreSQL NOTIFY瞬态传递，不落事件表/不提供cursor。API逐次鉴权后发送，单客户端积压64KiB或背压时断开，客户端用持久cursor/状态恢复。已消费终态cursor再订阅返回409 STREAM_COMPLETE，避免空流假挂起。

## 契约、CLI与部署边界

22项能力在tools/nuochong-cli/src/registry.mjs及core-commands.mjs定义输入/输出、权限、HTTP、CLI映射。API直接使用这份元数据和验证器；CLI可独立打包，无后端依赖。现有创建/事件基础字段与A-05快照保持兼容，客户端版本0.2.0、契约1.1。未来OA-03负责扩展外部AI与MCP，不复制鉴权或状态机。

新API必须显式迁移、配置数据库、初始化管理员和单独启动；无内存回退，无自动复制原生页面凭据/实验密钥。仓库同时包含API及Worker服务单元，但本次没有自动改动已上线Native测试入口或新增公网控制API；生产发布仍需独立批准。验证与使用见apps/control-api/README.md。

OA-04补充：auth logout只撤销当前已认证凭据，不接受客户端指定目标；auth principals set-role仅管理员可用，角色变化递增主体epoch，使全部旧凭据失效，服务主体不能提升为admin，最后一个活跃管理员不能降级。重新启用同一状态不重复撤销新凭据。
