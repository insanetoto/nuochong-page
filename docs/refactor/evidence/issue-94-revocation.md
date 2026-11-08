# Issue #94：撤权 / 300ms 租约 / 终态收敛调查

2026-11-08 · 执行者 DeepSeek · 预审 ChatGPT · 负责人确认结论 · 不表示 FULL 准入或产品验收

## 1. 结论（收窄到实测）

本次调查未在受控复现中观察到“撤权后继续披露”或“撤权后成功终态”。但不能据此宣称所有竞态均已证明无泄漏。实测覆盖两条路径：

1. **Worker 仍持有有效租约时撤权**：run 收敛为 `cancelled`，SSE 无 `run.completed`，后续 401。
2. **仅 SSE 鉴权路径（无 worker 终态）**：撤权后旧流关闭，撤权前 delta 可见、撤权后 delta 不可见，新连接 401，数据库无成功输出。
3. **300ms 租约因 heartbeat 延迟而过期**：`workOnce` 暂留 `running`；`recoverExpired()` 收敛为唯一 `failed(unavailable)`，无 `run.completed`，后续 401。

原测试在 `await workOnce` 后立即断言 `cancelled`，把租约丢失后的瞬态 `running` 当作撤权失败；这是测试等待/租约恢复时序问题，不是该次失败中的权限放行。

仍有一个需要产品/架构确认的语义问题：租约丢失后恢复为 `failed` 而不是 `cancelled`。安全上未观察到泄漏，但如果要求撤权运行必须以 `cancelled` 收敛，需要在 `recoverExpired` 中结合撤权状态判断；本 PR 没有擅自改这一生产语义。

## 2. 环境与基线

| 项 | 值 |
| --- | --- |
| 代码基线 | `b2c14334bdbe519f4ac6d46a4f9fb2ab2dcc8a64`（`refactor/integration`） |
| 分支 | `codex/issue-94-revocation` |
| 测试提交 | `02c7417`、`08e84d0`、`3f42696`（证据文档见本文件所在提交） |
| 运行时 | GitHub Actions Ubuntu、Node 24.21.0、PostgreSQL 17.11 服务容器 |
| 测试 | `apps/control-api/test/control-api.test.mjs` 的隔离 schema/真实 HTTP/SSE/Worker 夹具 |
| 数据 | 合成 prompt/成员/凭据；无客户资料、无模型调用、无部署 |

原失败：PR #87 的 control-api run `41320806255`，测试
`credential revocation terminates an in-flight run and stream without continued disclosure`
在 `leaseMs:300` 时读到 `running`；该次运行 52 pass / 1 fail，后续 401 通过。

## 3. 租约丢失的确定性复现

测试 `lease expiry during revocation converges to one terminal state without disclosure` 使用显式屏障，不依赖固定 sleep：

1. 包装 `store.heartbeat`，第一次进入时阻塞并发出 `heartbeatEntered`；
2. 包装 executor，确认 `execute` 已启动后发出 `started`；
3. 等待两者都发生，再轮询数据库直到 `lease_until <= clock_timestamp()`；
4. 此时才撤权；随后释放 heartbeat；
5. heartbeat 因租约已过期返回空，`workOnce` 置 stale 并 abort executor；
6. `await workOnce` 后断言 run 仍为 `running`；
7. 调用 `recoverExpired()`，断言唯一 `failed(unavailable)` 终态、无 `run.completed`、401。

时序（相对 `workOnce` 启动）：

```text
t0       claim，lease_until = t0 + 300ms
t~75    第一次 heartbeat 进入并阻塞（heartbeatEntered）
t~?     executor.execute 已启动（started）
t~300   租约到期；轮询确认 lease_until <= now
t+       撤权；释放 heartbeat
t+       heartbeat 返回空 -> stale -> abort executor
t+       await workOnce 返回；run 仍为 running
t+       recoverExpired() -> failed(unavailable)，写 run.failed
之后     读取 run=401；SSE 无 run.completed；终态事件 1 个
```

关键断言：`running` 是恢复前瞬态；`recoverExpired()` 后转唯一 `failed`；没有成功终态；后续 401。

## 4. SSE 撤权负例（含 mutation 证据）

测试 `revocation closes an open stream before later deltas without a worker terminal`：

- 用 `store.claim(5000)` 直接进入 `running`，**不运行 worker**；因此唯一能关闭该 SSE 的机制就是循环中的 `identity.authenticate(token)`；
- 通过真实 `pg_notify('oa_delta_<schema>')` 发送 `pre-revocation-visible-marker`，证明连接确实能收到 delta；
- 撤权后等待 300ms（SSE 每 100ms 重新鉴权），发送 `post-revocation-secret-marker`；
- 断言旧流关闭、包含 pre、不含 post、无 `run.completed`；run 仍为 `running`（说明不是 worker 终态关闭流）；数据库 `output` 为 null；新 SSE 请求 401。

**Mutation 证据**：在临时分支仅移除 `app.mjs` 的 `await identity.authenticate(token)`，重新运行 control-api：

- run `42489885533` 只失败该测试；
- 失败信息包含 `post-revocation-secret-marker`，证明移除流鉴权后 delta 会继续透传；
- 临时 mutation 分支已删除，未合并。

## 5. 三条撤权/租约路径的区分

| 维度 | 观察 | 结论 |
| --- | --- | --- |
| 测试等待 | `await workOnce` 只表示当前 worker 退出，不保证另一次恢复已完成；原测试立即读 running | 测试假设过强，不是权限失败 |
| 租约恢复 | heartbeat 超过 lease 后返回空，worker 置 stale 并跳过 settle；`recoverExpired` 在下一轮产生唯一 failed 终态 | 终态收敛依赖恢复循环；worker 循环会调用 `recoverExpired()` |
| SSE 鉴权 | 无 worker 时，撤权后旧流由 SSE 重新鉴权关闭；post delta 不再透传 | 流鉴权有效；mutation 可使其失败 |
| 实际权限 | 上述受控路径中无 `run.completed`、无 post delta、后续 401、output null | 未观察到越权；不外推为所有竞态已证明 |

## 6. 最小修复（本 PR）

- 保留撤权用例并改为 `leaseMs:1000`，只验证“租约仍有效时撤权 → cancelled”，保留无 `run.completed`、401 断言。
- 新增无 worker 的 SSE 鉴权负例（pre/post delta + mutation 证据）。
- 新增显式屏障的租约丢失回归，避免用睡眠改变概率；覆盖 transient running → recovery failed 的唯一终态/无披露/401。
- 未改生产 Worker、Store、身份、授权或任务状态机；未降低任何安全断言。

## 7. 验证证据

| 检查 | 结果 |
| --- | --- |
| PR #132 control-api（PG 17.11 / Node 24.21.0，run `42489559363`） | 55/55 pass；worker 撤权 447ms；SSE 撤权 1329ms；租约丢失 557ms |
| Mutation（移除 SSE 鉴权，run `42489885533`） | 仅 `revocation closes an open stream...` 失败，post marker 出现；证明用例敏感 |
| `npx eslint apps/control-api/test/control-api.test.mjs` | pass |
| `node --check` / `git diff --check` | pass |
| 既有 25 项平台离线测试 | pass（同 job） |

未运行：真实模型、浏览器、部署、生产容量/告警；本任务为离线/合成集成调查，不涉及这些范围。

## 8. 残留假设与后续

1. 生产终态收敛依赖至少一个 Worker/恢复循环继续运行；若所有 Worker 停止，数据库中的 run 可能暂时保持 running，但凭据已撤销、API 401，无法继续读取。需要运维告警覆盖“长期 running + 已撤权”组合。
2. 租约丢失后恢复为 `failed` 而非 `cancelled`：本 PR 保留现状。如果产品要求撤权运行必须 `cancelled`，建议由 ChatGPT 预审后再改 `recoverExpired`（结合 credential revoked/principal inactive），并补充“恢复为 cancelled”的测试；不要在本调查中静默改变终态语义。
3. 本次结论不构成 FULL 准入；#94 的负责人风险决定、#103 FULL 和 V2 P1 发布仍需独立记录。

## 9. 复现命令

```bash
# 需要隔离 PostgreSQL；CI control-api job 使用 PG 17.11
TEST_DATABASE_URL=postgresql://... npm test --prefix apps/control-api
# 仅跑相关用例（Node 24 test runner）
TEST_DATABASE_URL=... node --test --test-name-pattern='revocation|lease expiry' apps/control-api/test/control-api.test.mjs
```
