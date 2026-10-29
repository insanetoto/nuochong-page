# A-06 执行原型：阶段性结果

日期：2026-10-29。依赖 A-05 已验收，集成基线 `6195bc2a8896e3bb596e2142ce9b4c69cbd6fbd8`。**A-06 尚未完成验收**。

## 实现边界

`../runtime/adapter.mjs` 通过官方 SDK 的公开入口启动执行；每次运行拥有独立 Harness 子进程。取消关闭整个所属子进程，等待清理完成才返回终态；清理失败明确抛错。该策略开销待测，不代表后续会话池设计。停止本地子进程也不能证明供应商停止计算或计费。

只读工具使用真实 Cordis Context、SystemPrompt、ToolRuntime 和 defineTool；工具仅返回合成字符串，不访问磁盘/网络。插件卸载等待 `Fiber.dispose()`，不是修改上游源码。ToolRuntime 本身没有被假定能自动强杀任意工具：工具必须响应 AbortSignal，等待其持有的工作结束。

EventJournal 是进程内契约夹具，只保存生命周期事件，拒绝 token delta；它验证游标切片和 sourceKey 去重。它不是持久队列、HTTP/SSE 服务或数据库提交后发布机制。持久化属于 A-07/B-04。

## 可复现命令

```sh
npm ci --prefix experiments/phase-a/runtime --ignore-scripts --no-audit --no-fund
node experiments/phase-a/runtime/verify-sdk.mjs
node experiments/phase-a/runtime/verify-adapter.mjs
```

Node 24.21.0；SDK/工具 0.2.1-rc.2，Cordis 4.0.5；直接使用的包均在隔离 package.json 中显式声明并锁定。结果输出 `runtime/outputs/adapter-probe.json`；已提交本机证据 `runtime/results/darwin-adapter.json`。Linux 结果由 PR 的 Harness runtime probe 工作流生成，未完成前不声称通过。

| 验证 | 类型 | 本机结果 |
| --- | --- | --- |
| 只读工具 schema 输出 | 真实 ToolRuntime | 通过 |
| 预取消不进入工具正文 | 真实 ToolRuntime | 通过 |
| 执行中取消并等待清理、后续调用被阻止 | 真实 ToolRuntime | 通过 |
| deadline 协作中止工具 | 真实 ToolRuntime＋调用方信号 | 通过 |
| 插件卸载后找不到工具且无法调用 | 真实 Cordis 生命周期 | 通过 |
| 流式通知转发、单次使用和关闭一次 | 合成 transport | 通过 |
| 取消/请求超时关闭运行并等待 | 合成 transport | 通过 |
| transport 故障、清理失败明确失败 | 合成 transport | 通过 |
| deadline 遇清理失败仍返回错误、不挂起 | 合成 transport | 通过 |
| 事件游标、去重、外来游标和 delta 拒绝 | 内存契约夹具 | 通过 |

合计 12/12，本机约 90ms，不是模型性能数据。

## 未运行与解除条件

- 无隔离服务端凭据：尚未真实模型请求、首 token/总时延、5 并发/10 请求、费用/usage、上游限流、模型执行时的取消和断连。
- 尚未实际 HTTP/SSE 代理断连重连、Host 崩溃恢复、资源占用；内存夹具不能替代这些结果。
- 尚未把合成只读工具注入具名 Profile 后由真实模型调用。工具 registry 与 SDK 执行分别验证，不能声称端到端通过。
- 默认路由沿用 A-04 的 `deepseek-official / deepseek-v4-flash`；不设置费用上限，符合用户决定；仍需按 A-05 的请求 deadline 限制等待并记录真实结果。

待本机环境变量 `DEEPSEEK_API_KEY` 或被忽略的 `runtime/.env.local` 配置完成后，核验公开凭据配置接口，执行真实矩阵。输出仅记录脱敏测量和分类错误。A-06 Issue 保持打开，A-09 不因本原型的部分通过而解锁。
