# nuochong 产品 CLI 0.2

OA/Harness能力的命令行入口；通过控制API使用服务端身份、资源授权和运行状态。独立于上游 `dsh`，不会暴露 Harness 宿主管理权限、数据库或模型凭据。

当前实现20项运行/会话/身份/模型与只读工具命令，与apps/control-api使用同一契约；已有真实PostgreSQL/HTTP/CLI及本机真实模型验收。新API尚未发布公网，不能把原生Web端口当作控制API。未来MCP、审计/用量等仍为planned；旧业务模块不属于当前清单。

## 直接运行与安装

只需要 Node >=22.13.0，无第三方运行依赖，无需改变项目根依赖。

```sh
node tools/nuochong-cli/bin/nuochong.mjs capabilities --json
node tools/nuochong-cli/bin/nuochong.mjs schema runs.create --json
node tools/nuochong-cli/bin/nuochong.mjs runs get --run-id example --dry-run
```

需要短命令时可由开发者选择本机安装：

```sh
npm install --global ./tools/nuochong-cli
nuochong capabilities --json
```

包目前 private，尚未发布到 npm，也未在本次修改全局环境。离线打包/独立安装测试验证其不依赖仓库外部路径。OA-02/OA-04已提供正式API与共享契约，OA-03负责外部AI/MCP适配，不搬迁官网入口。

## 外部 AI 的使用顺序

1. 执行 `capabilities --json` 读取命令ID、输入/输出schema、副作用、可用性和重试策略。这是本地客户端契约，不是实时服务端权限许可。
2. 使用JSON stdin调用能力；传入独立用户或受限服务凭据。API地址为origin，HTTP只允许本机回环开发，远程要求HTTPS。
3. 按进程退出码及结构化结果处理；202代表请求受理，`runs get`/终态事件才反映业务状态。读取失败运行的命令本身仍可以退出0，不能据此认为业务成功。
4. 事件按cursor恢复；中断/超时不自动取消远端任务，也不自动重连或重发写操作。明确取消须调用 `runs cancel`。

```sh
# 在当前进程环境设置 NUOCHONG_API_URL 和 NUOCHONG_ACCESS_TOKEN
# 需指向兼容OA控制API；不是 DeepSeek key 或 GitHub token
printf '%s\n' '{"prompt":"解释这份授权资料","idempotencyKey":"agent-task-001"}' \
  | nuochong runs create --input - --json
nuochong runs get --run-id RUN_ID --json
nuochong runs events --run-id RUN_ID --after EVENT_ID --timeout-ms 180000
nuochong runs cancel --run-id RUN_ID --json
```

AI宿主应使用参数数组与stdin，避免把模型文本拼进shell：

```js
import { spawn } from 'node:child_process';
const child = spawn('nuochong', ['runs', 'get', '--input', '-'], {
  shell: false, env: scopedEnvironment,
});
child.stdin.end(JSON.stringify({ runId: trustedRunId }));
// 同时收集stdout/stderr并检查退出码；stdout可为JSON或NDJSON。
```

`--dry-run`只做本地输入验证和请求预览，输出 `executed:false`；不联系API，不验证权限、资源、额度或执行可行性，不等于审批。没有 `--yes`、`--force` 或身份覆盖选项。

## 输出与退出码

普通成功：stdout单行JSON，含schemaVersion/command/ok/data；错误：stderr单行JSON，含error.code/message及可用的httpStatus/requestId/cursor，stdout不混入日志或上游错误原文。

流式成功：stdout逐行NDJSON，kind为event/delta/end。持久事件含cursor，瞬态delta没有cursor；最后end说明已收到持久终态，terminal仍可能是run.failed。中途失败保留已输出记录和stderr的lastEventId，进程非0退出。

| 退出码 | 含义 |
| --- | --- |
| 0 | 客户端操作成功，不代表业务运行成功 |
| 2 / 3 | 输入错误 / 配置错误 |
| 4 / 5 / 6 / 7 | 未认证 / 无权限 / 不可见资源 / 冲突 |
| 8 / 9 / 10 / 11 | 限流 / API错误或不可用 / 网络错误 / 客户端超时 |
| 12 / 14 | 契约或不完整流错误 / 尚未提供的能力 |
| 70 / 130 / 141 | 内部错误 / SIGINT中断 / 输出消费者关闭 |

默认总deadline30秒，可显式设1..180000ms，覆盖stdin等待、网络、流和输出背压。所有HTTP命令不自动重试，不跟随重定向。创建运行要求稳定幂等键；取消仍由服务端按终态仲裁。

JSON响应上限1MiB，stdin上限512KiB，SSE行/帧上限256KiB，每次最多10000条持久事件；去重缓存保存摘要而非全文。序号倒退、同ID不同内容、错误runId及带持久ID的token帧均拒绝。达到边界时使用已输出的cursor恢复/查状态，不能静默丢数据。

## 契约与验证

输入/输出schema随客户端版本发布。create/event DTO与A-05冻结快照做一致性测试；get使用不强制企业tenant字段的OA运行契约；当前验证器只支持本清单使用的基础Draft-07子集，遇未知schema特性直接失败，不宣称通用JSON Schema实现。OA-02/03提取共享契约与生成流程后，服务端、CLI和未来MCP从同一能力定义生成。

取消响应补充约定：200或202，JSON至少包含runId及cancelRequested:true；表示取消请求已记录，不表示已取消。OA-02已实现此兼容响应。A-09的部署探针API只是夹具，不是本CLI已通过联调的正式API。

```sh
node --test tools/nuochong-cli/test/*.test.mjs
node tools/nuochong-cli/test/package-smoke.mjs
```

本机macOS Node24验证；远程Linux Node22.13/24.21由product-cli.yml执行，结果以PR检查为准。Windows尚未验证。源码与规范见[产品CLI方案](../../docs/refactor/cli-native.md)。MCP适配为后续范围，本次没有部署MCP服务或连接外部AI账号。

原生Harness Web的3080端口不是本客户端的控制API。当前兼容API位于apps/control-api，绑定实际服务地址与受限凭据后使用；合成测试、真实数据库与真实模型报告分别记录。

20项命令列表通过capabilities/schema发现。新增示例：`nuochong auth me`、`nuochong sessions list`、`nuochong models config get`、`nuochong tools list`、`nuochong runtime status`。身份/凭据管理须admin用户且auth:manage；模型配置须config:write。成员只能访问自身运行/会话。列表/history可用JSON after游标，退出前查询终态而不是把stream退出0等同于模型成功。完整部署/身份边界见[控制API手册](../../apps/control-api/README.md)。
