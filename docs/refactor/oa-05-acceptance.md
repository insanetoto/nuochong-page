# OA-05 隔离验证记录

Issue #36 / PR #51。OA-02、OA-04前置已验收；2026-10-30 OA-03也已人工验收。用户要求继续OA-05，本报告记录技术实测与边界；2026-10-30用户明确确认“OA-05 验收通过”。

- 官方 Harness SDK、控制 API、Worker、CLI/MCP 在独立 Linux 容器及真实 PostgreSQL 中验证；容器使用内存、CPU、PID、只读文件系统与有界tmpfs限制。
- 真实Host容器强杀并重启3次；真实Worker子进程强杀恢复3次，未知dispatch停止重放、单一终态；API子进程重启3次并检查跨进程撤权。Host同时运行真实SDK和持久Worker，dispatch使用合成阻塞执行器；不代表真实模型请求经过故障恢复。
- 同一镜像ID用于候选及目标，回退到另一镜像标签并实际启动SDK与API；两个镜像业务代码/schema相同，不代表破坏性代码或迁移回滚。
- 合成数据库 `pg_dump` 到独立数据库并逐表比较8张表；不推断生产规模RPO/RTO或灾备能力。
- 已认证主体拒绝操作写最小审计，不存请求文本或凭据；隔离测试验证拒绝及不更改配置。未认证请求、数据库故障期间审计和全链路运营审计仍有限制。
- 官网16项基线哈希与双构建/E2E检查；Linux像素基线不存在，未声称像素比较通过。
- 模型成本/用量未计量，unknown；没有加隐含费用上限或将unknown写成零。

GitHub Actions 的 `OA required gate` 汇总7项实际检查；已追加到refactor/integration分支保护的必需检查，保留原有Build、E2E及strict设置；详见PR #51和仓库实际保护配置。模型密钥不进入CI。本次未向main/test推送，未发布公网控制API。复现与范围见[容器演练手册](../../apps/control-api/deploy/ci/README.md)。


人工验收：2026-10-30用户明确确认“OA-05 验收通过”；#36关闭为completed，OA-06前置已满足。此前限制继续有效，生产推广需单独授权。
