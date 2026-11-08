# Issue #94：撤权 / 300ms 租约 / 终态收敛调查

2026-11-08 · 执行者 DeepSeek · 预审 ChatGPT · 负责人确认结论 · 不表示 FULL 准入或产品验收

## 1. 结论

本次失败不是权限泄漏，也不是“撤权后仍可继续披露”。在合成复现中：

- 撤权后立即读取 run 仍为 `running`，因为 300ms 租约已过期、第一次 heartbeat 尚未完成；
- `recoverExpired()` 在下一轮收敛为唯一 `failed(unavailable)` 终态并写 `run.failed`；
- SSE 没有 `run.completed`，后续读取返回 401，终态事件恰好一个。

原测试在 `await workOnce(...)` 后立即断言 `cancelled`，把“租约丢失后的瞬态 running”当作撤权失败；这是测试等待/租约恢复时序问题。生产权限语义没有被放宽：无继续披露、无成功终态、后续请求拒绝。

仍有一个需要产品/架构确认的语义问题：租约丢失后恢复为 `failed` 而不是 `cancelled`。安全上无泄漏，但如果要求撤权运行必须以 `cancelled` 收敛，需要在 `recoverExpired` 中结合撤权状态判断；本 PR 没有擅自改这一生产语义。

## 2. 环境与基线

| 项 | 值 |
| --- | --- |
| 代码基线 | `b2c14334bdbe519f4ac6d46a4f9fb2ab2dcc8a64`（`refactor/integration`） |
| 分支 | `codex/issue-94-revocation` |
| 代码提交 | `02c7417`（证据文档见本文件所在提交） |
| 运行时 | GitHub Actions Ubuntu、Node 24.21.0、PostgreSQL 17.11 服务容器 |
| 测试 | `apps/control-api/test/control-api.test.mjs` 的隔离 schema/真实 HTTP/SSE/Worker 夹具 |
| 数据 | 合成 prompt/成员/凭据；无客户资料、无模型调用、无部署 |

原失败：PR #87 的 control-api run `41320806255`，测试
`credential revocation terminates an in-flight run and stream without continued disclosure`
在 `leaseMs:300` 时读到 `running`；该次运行 52 pass / 1 fail，后续 401 通过。

## 3. 确定性复现

新增测试 `lease expiry during revocation converges to one terminal state without disclosure`：

1. 创建成员/凭据/run；
2. 包装 `store.heartbeat`，让第一次 heartbeat 人为延迟 450ms；
3. 以 `leaseMs:300` 启动 `workOnce`，确认 run 已 running；
4. 打开 SSE，撤销凭据；
5. `await workOnce` 后读取 run；
6. 调用 `recoverExpired()`，读取终态、SSE 文本、事件列表和 401。

时序（相对 `workOnce` 启动）：

```text
t0       claim，lease_until = t0 + 300ms
t~75    第一次 heartbeat 开始，被人为延迟 450ms
t~300   租约到期
t~?     撤权请求提交（SSE 打开后）
t~525   延迟 heartbeat 返回：lease_until > now 失败，workOnce 置 stale 并 abort executor
t~525   await workOnce 返回；run 仍为 running（这是原测试读到的事实）
t~525   recoverExpired()：running + lease_until <= now -> failed(unavailable)，写 run.failed
之后    读取 run=401；SSE 无 run.completed；终态事件 1 个
```

复现测试的关键断言：

- `await workOnce` 后 `running`（证明不是“立即 cancelled”的测试假设）；
- `recoverExpired()` 后 `failed`、`error_code=unavailable`；
- SSE 文本不含 `run.completed`；
- 后续 API 读取 401；
- `run.completed/run.failed/run.cancelled` 恰好一个，且为 `run.failed`。

## 4. 三类事实的区分

| 维度 | 观察 | 结论 |
| --- | --- | --- |
| 测试等待 | `await workOnce` 只表示当前 worker 退出，不保证另一次恢复已完成；原测试立即读 running | 测试假设过强，不是权限失败 |
| 租约恢复 | heartbeat 超过 lease 后返回空，worker 置 stale 并跳过 settle；`recoverExpired` 在下一轮产生唯一 failed 终态 | 终态收敛依赖恢复循环；worker 循环会调用 `recoverExpired()` |
| 实际权限 | 撤权后 SSE 无 `run.completed`，后续 API 401，未观察到输出继续披露 | 未发现越权或数据泄漏 |

## 5. 最小修复（本 PR）

- 撤权用例改为 `leaseMs:1000`：只验证“租约仍有效时撤权 → cancelled”，避免把 CI DB/heartbeat 延迟当成撤权失败；保留 `cancelled`、无 `run.completed`、401 断言。
- 新增确定性租约丢失回归，覆盖 transient running → recovery failed 的唯一终态/无披露/401。
- 未改生产 Worker、Store、身份、授权或任务状态机；未降低任何安全断言。

## 6. 验证证据

| 检查 | 结果 |
| --- | --- |
| PR #132 control-api（PG 17.11 / Node 24.21.0，run `42486432393`） | 54/54 pass；`credential revocation...` 385ms；`lease expiry...` 1042ms |
| `npx eslint apps/control-api/test/control-api.test.mjs` | pass |
| `node --check` / `git diff --check` | pass |
| 既有 25 项平台离线测试 | pass（同 job） |

未运行：真实模型、浏览器、部署、生产容量/告警；本任务为离线/合成集成调查，不涉及这些范围。未用重复重跑代替复现；上述 reproduced 用例为确定性注入。

## 7. 残留假设与后续

1. 生产终态收敛依赖至少一个 Worker/恢复循环继续运行；若所有 Worker 停止，数据库中的 run 可能暂时保持 running，但凭据已撤销、API 401，无法继续读取。需要运维告警覆盖“长期 running + 已撤权”组合。
2. 租约丢失后恢复为 `failed` 而非 `cancelled`：本 PR 保留现状。如果产品要求撤权运行必须 `cancelled`，建议由 ChatGPT 预审后再改 `recoverExpired`（结合 credential revoked/principal inactive），并补充“恢复为 cancelled”的测试；不要在本调查中静默改变终态语义。
3. 本次结论不构成 FULL 准入；#94 的负责人风险决定、#103 FULL 和 V2 P1 发布仍需独立记录。

## 8. 复现命令

```bash
# 需要隔离 PostgreSQL；CI control-api job 使用 PG 17.11
TEST_DATABASE_URL=postgresql://... npm test --prefix apps/control-api
# 仅跑相关用例（Node 24 test runner）
TEST_DATABASE_URL=... node --test --test-name-pattern='revocation|lease expiry' apps/control-api/test/control-api.test.mjs
```
