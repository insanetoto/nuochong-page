# A-09 部署与恢复验证

2026-10-29；基线fcb8d5c，[PR #29](https://github.com/insanetoto/nuochong-page/pull/29)，技术head db5d713。用户在本会话明确回复“A-09 验收通过”。

[Linux CI 40833880173](https://github.com/insanetoto/nuochong-page/actions/runs/40833880173) **18/18通过**；原始脱敏产物已下载核对并保存[linux-deployment.json](../deployment/results/linux-deployment.json)。Node24.21.0、Fastify5.12.7、PG17.11、4 CPU/约16.76GB Runner。双构建40833880228、Harness40833880185、E2E40833880154均成功。

| 目标 | 实测 | 结论 |
| --- | --- | --- |
| Host三次SIGKILL后10秒内恢复 | 6511.85 / 4137.56 / 4118.71ms，各重试一次 | 通过；10个任务最终终态/数据库模拟副作用各一次 |
| 同产物推广 | candidate与四个后端角色均为同一v2 image ID | 通过，完整digest在原始报告 |
| 60秒内应用回滚 | API/两Worker/Host整体v2→v1，恢复后新任务成功，2438.76ms | 通过；无数据库迁移回滚声明 |
| 独立数据库恢复 | pg_dump/pg_restore至prototype_restore，逐表比对jobs/history/effects/quota，326.23ms | 通过；10任务与全部夹具一致 |
| CPU/内存 | Host内核512MiB/1CPU/128PID；64MiB独立探针实际OOM；0.25CPU探针21次节流 | 通过；不是生产容量承诺 |
| 服务并发/配额 | Host第三并发调用429，API第六未完成任务429；合成配额2次且跨Host重启不重置 | 通过；不更改真实模型费用策略 |
| 真实HTTP流式代理 | 3个合成帧，首帧约4.96ms/总603.02ms；断连清理和Host断流error事件 | 通过；不是模型TTFT |
| 官网故障隔离 | 311次字节抽样0失败；Host停机期间4组批准DOM/SEO/链接/图像清单 | 通过；Linux无像素基线 |
| 凭据与追踪 | 静态产物/完整服务日志0凭据泄漏，API/Worker/Host requestId关联 | 通过 |

本机macOS最终配置：强杀真实Harness Host进程组后原官网基线 **5/5通过**，Chrome156.0.8078.48、Node24.21.0；未更新任何截图。[darwin-visual.json](../deployment/results/darwin-visual.json)。

实际Host会启动锁定的真实SDK；部署任务执行器/issuer/配额为合成夹具，无付费模型调用。真实模型证据独立属于A-06；未部署公网或生产。v1/v2内嵌版本清单不同，共用业务源码/schema，仅证明部署修订回退；不证明破坏性迁移、真实IdP或生产灾备。

[历史失败](../deployment/results/failure-history.json)保留4轮真实失败及修复：原生加载私有exec缓存、Fastify输入静默改写、恢复URL错误等。最终按冻结v1重跑通过，未删除慢样本、刷新截图或放宽阈值。源码/镜像清单、复现及范围见[deployment/README.md](../deployment/README.md)。
