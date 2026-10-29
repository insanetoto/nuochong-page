# A-06 Harness 执行与流式原型

日期：2026-10-29；依赖 A-05 已验收，基线 `6195bc2a8896e3bb596e2142ce9b4c69cbd6fbd8`。实现见 [PR #26](https://github.com/insanetoto/nuochong-page/pull/26)。本报告为技术验证证据，Issue #6 保持打开直至负责人验收。

## 结论与架构调整

默认模型真实调用、自定义只读工具、实时通知、取消、超时、传输关闭、持久会话恢复和插件卸载已完成本机验证。SDK 与 CLI 0.2.1-rc.2，Cordis 4.0.5，Node 24.21.0/macOS arm64。生产和官网未修改。

发现两处必须由自有适配层处理的边界：

1. 官方 SDK 默认只发布持久 session 事件，未提供 transient assistant stream 通知。`stream-bridge-plugin.mjs` 使用公开的 `HarnessSdkJsonRpcServer`、`JsonRpcLineTransport` 和 `agent/assistant-stream` Hook，提供部署自有的 `nuochong.assistant.stream` 通知；由 SDK 订阅接收。无私有导入、无上游核心改动。该通知不是上游协议承诺，升级时必须重测。
2. SDK `run()` 返回空闲不能证明模型成功。实际 429 故障曾被最初适配层误判成功；现以根会话持久 `turn/end.reason.kind=completed` 才判成功，错误或未知终态均失败，补充回归用例。

每个原型运行拥有独立子进程，取消关闭整个所属子进程，清理完成才返回终态；清理失败抛错。此策略开销待 A-09 测量，不代表生产会话池设计。停止本地进程不能证明供应商停止计算或计费。

## 实测矩阵

| 验证 | 范围和方法 | 结果 |
| --- | --- | --- |
| 默认模型＋只读工具 | deepseek-official/deepseek-v4-flash，5 并发、10 请求，每个真实调用可由子进程审计 | 10/10 通过，返回预期合成代码 |
| 首 token P95 | 自有桥接器接收首个 text-delta；从启动开始，包含子进程初始化和工具往返；nearest-rank，失败样本计 Infinity | 2,618.97ms，目标 ≤15,000ms |
| 总耗时 P95 | 包含关闭清理；同一批 10 样本 | 2,676.40ms，目标 ≤120,000ms |
| 实时输出中取消 | 收到真实 text-delta 后取消 | ack 0.27ms；关闭 26.42ms，分别低于1秒/5秒 |
| 工具往返时取消 | 首次真实工具结果后取消，独立子进程审计文件对比取消前后调用次数 | 1→1，新增执行0；关闭13.53ms |
| 请求超时 | 对真实模型运行注入500ms测试deadline（生产候选默认180秒） | timed_out，清理完成，无成功误判 |
| 真实传输断开 | 模型输出中关闭公开 SDK client 传输 | 见 darwin-model-disconnect.json，必须 failed/TransportClosedError |
| 新进程恢复会话 | 真实模型完成后，重新启动同一home并调用公开 resumeSession，无新增prompt | 恢复成功，工作目录一致 |
| HTTP/SSE断连重连 | 真实回环HTTP连接；内存合成生命周期事件；Last-Event-ID切片和sourceKey去重 | 通过；异运行游标409，客户端收到1/2/3无重复 |
| 上游429 | 真实SDK/供应商适配器＋本机合成HTTP端点，不用真实凭据 | 3次请求（首发＋2重试）后failed |
| 上游挂起 | 同上，端点接收但不回应，注入1.5秒deadline | 1次请求，约1.53秒后timed_out |
| 工具注册/取消/卸载 | 真实Cordis＋ToolRuntime；协作式AbortSignal，等待工具清理 | 5项通过；卸载后无法调用 |
| 适配层和事件契约 | 明确标注的合成transport与内存journal夹具 | 连同真实工具共13/13通过 |
| 官方两个Profile和自有桥 | 无模型启动/关闭 | 本机3/3通过；Linux由远程CI复验 |

实测完整样本：`../runtime/results/darwin-model-matrix.json`；取消独立审计、会话恢复、SSE、供应商故障、适配层报告同目录。Token usage 为供应商报告值；未核验账单金额，费用标记 **unknown**，无费用上限（用户决定）。取消样本可能无完整usage，不据此宣称零费用。

早期严格夹具曾要求模型恰好调用工具一次，某轮出现两次只读调用而失败，证据保留为 `darwin-model-matrix-strict-fixture.json`。冻结目标不要求只读请求恰好一次，最终判据改为至少调用一次、每次调用与子进程审计一致、正确返回且不引入写操作；未放宽时延、取消、重试或身份隔离目标。最终新一轮10个样本均实际调用一次。不能据此承诺模型不重复请求，写工具必须另行幂等与授权。

## 可复现命令

```sh
npm ci --prefix experiments/phase-a/runtime --ignore-scripts --no-audit --no-fund
node experiments/phase-a/runtime/verify-sdk.mjs
node experiments/phase-a/runtime/verify-adapter.mjs
node experiments/phase-a/runtime/verify-sse.mjs
node experiments/phase-a/runtime/verify-provider-faults.mjs
# 真实付费调用：先在本机环境或被忽略的runtime/.env.local配置DEEPSEEK_API_KEY
node experiments/phase-a/runtime/verify-model.mjs --bridge --matrix
node experiments/phase-a/runtime/verify-model.mjs --bridge --cancel-tools
node experiments/phase-a/runtime/verify-model.mjs --bridge --resume
node experiments/phase-a/runtime/verify-model.mjs --bridge --disconnect
```

默认CI不调用真实模型、不读取真实凭据。所有直接使用的公开包显式声明、锁定。`profile-patch.mjs` 禁用具名Profile自带的文件/图像、目录及Shell工具，仅插入合成只读工具；供应商重试显式限制为2次。不能仅凭minimal名称推定权限安全。

## 原型局限和后续责任

- HTTP/SSE用例验证实际网络断连，但事件源是内存夹具；数据库提交后发布、跨Host恢复属于A-07/A-09/B-04，不能由内存journal证明。
- 尚未测实际公网反向代理、Host强杀/资源上限或生产负载。A-09负责；小样本P95不是生产SLA。
- 真实模型在本机macOS运行；Linux当前只执行无密钥真实SDK/工具/故障验证。没有把macOS结果冒充Linux模型测量。
- 读取工具没有写副作用。任意第三方工具必须协作响应信号，框架不能强杀同进程中的任意JavaScript。
- 此原型不提供业务鉴权、企业隔离或持久任务权威；由A-07/A-08负责。没有将Harness owner权限授予终端用户。

## 远程验证证据

技术提交 `8bd70b4`：Linux [Harness探针40817710164](https://github.com/insanetoto/nuochong-page/actions/runs/40817710164)产物已下载核对：3个Profile/变体初始化关闭、13项适配/工具验证、SSE和两类供应商故障全部通过。双构建40817710151、E2E40817710168、契约40817710160均成功。后续记录更新提交仍须等待其必需CI再集成。
