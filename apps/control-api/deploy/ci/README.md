# OA-05 隔离容器与恢复演练

`.github/workflows/oa-reliability.yml` 在短期 Linux Runner 构建正式控制 API/CLI/MCP 镜像，使用隔离 PostgreSQL 和合成身份，不读取模型密钥、不连接公网测试或生产数据库。容器限制为只读根、768 MiB、1 CPU、256 PID 和 64 MiB 可执行 tmpfs；在其中启动真实受限 Harness SDK。此检查不是生产容量测定。

演练将候选镜像直接标记为目标，核对同一 image ID；再切换到不同标签版本的上一镜像，分别启动 SDK 和真实 API 进程检查。两个版本只有镜像标签不同，不验证破坏性代码和数据库迁移回滚。三次强杀实际 Harness Host 容器后重新启动，另三次强杀 Worker 子进程，验证租约恢复、未知 dispatch 不重放和终态唯一；三次 API 子进程重启验证持久状态和跨进程撤权。Host 容器同时启动真实SDK和持久Worker，并用合成阻塞执行器触发未知dispatch；恢复时验证终态唯一和不重放。Host 容器测试没有执行真实模型任务，不能推断生产在途模型调用可恢复。

独立 `pg_dump` 到新建数据库恢复合成表，并逐表比较 schema_versions、principals、credentials、sessions、runtime_config、runs、events、audit 的排序内容摘要。该小规模夹具不代表生产备份的 RPO/RTO、加密、保留周期或跨区域灾备。数据恢复与应用镜像切换分别执行。MCP 使用实际 stdio/API/数据库验证权限和幂等；模型计费未测量，记录为 unknown。

每个指向集成分支的 PR 都运行官网双构建/E2E、CLI 双 Node、控制 API/MCP、容器演练和 `OA required gate`。后者读取 PR 源提交的七个 GitHub Actions 检查，缺失、跳过、失败或超时均失败；单独将它设为分支保护必需检查后，才可声称门禁强制合并。官网 16 项已批准源码/素材哈希与 E2E 验证，Linux 无批准的像素截图基线，不能声称像素检查通过。

## 运维与复现

```sh
npm ci --prefix apps/control-api --ignore-scripts
TEST_DATABASE_URL=... npm test --prefix apps/control-api
TEST_DATABASE_URL=... npm test --prefix tools/nuochong-mcp
node scripts/ci/check-homepage-baseline.mjs
# GitHub Actions：OA reliability verification，使用短期 Linux Docker Runner
```

生产部署前须单独准备数据库、备份策略、TLS、凭据及容量；应用与 Worker systemd 模板见上级目录。授权成功和已认证主体的 4xx 拒绝记录 actor、command、结果，拒绝日志不记录请求数据、令牌或资源参数；无效凭据没有主体审计，数据库不可用时拒绝审计为尽力记录，不能当作完整合规审计。模型请求/费用未独立计量，状态是 unknown；不能按零费用或完整配额管理报告。全局限流、全链路追踪、备份保留/恢复演练和正式员工 Web/MCP 全入口联调仍需后续规划及真实部署验证。
