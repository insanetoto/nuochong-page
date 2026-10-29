# A-09 部署、资源与恢复隔离演练

仅在专用GitHub Actions Runner启动短期容器，不修改现有公网测试或生产环境。基线为A-08集成提交fcb8d5c；A-02、A-06、A-07、A-08均已获用户验收。

## 复现

需Linux Docker Engine（cgroup v2）、Node24.21.0；本机没有Docker，不伪称本机完成容器实验。

```sh
npm ci
npm ci --prefix experiments/phase-a/runtime --ignore-scripts
npm ci --prefix experiments/phase-a/jobs --ignore-scripts
npm ci --prefix experiments/phase-a/deployment --ignore-scripts
npm run build:static
npx playwright install --with-deps chromium
node experiments/phase-a/deployment/verify-deployment.mjs
```

脚本只创建带随机a09前缀的容器和网络，以及该容器中的合成数据库；结束后删除容器、匿名数据库卷和网络。不接入生产数据库。Docker镜像及构建目录保留在短期Runner供诊断，Runner销毁后回收；不上传镜像、备份或构建目录，仅上传脱敏JSON。

## 模板与版本清单

[template.json](template.json)列出角色、数值限制与必需服务端配置。运行时从官方Node24.21.0和PostgreSQL17.11镜像解析digest后锁定本轮构建；具体digest、应用image ID、源码SHA及源文件/锁文件/官网构建摘要写入输出报告，不虚构未执行的镜像ID。

构建上下文通过允许清单装配源码、锁定依赖及官网dist-static，排除.env、.dsh-home、Git和用户文件。两份不可变产物v1/v2具有不同内嵌release清单，共用同一业务源码和数据库schema；验证部署修订切换，**不验证破坏性业务代码或数据库迁移回滚**。candidate和推广目标使用同一v2 image ID；API/两个Worker/Host整体回退到v1，验证版本及新任务可执行。官网独立容器继续运行。

## 实际边界

- 官网服务器只依赖Node静态文件模块，无业务/AI启动依赖，不接收服务端凭据。API为真实Fastify5.12.7，使用A-08合成签名issuer；Worker使用A-07真实PostgreSQL租约/事务，Host实际启动锁定Harness SDK与只读Profile。
- 部署任务使用明确标注的合成执行器，**本套件不调用真实模型**。真实模型证据来自A-06，不把合成SSE延迟计入模型TTFT。服务间凭据为每轮随机合成值，绝不加载用户模型密钥。
- API以数据库事务锁限制最多5个未完成任务；Host最多2个并发合成调用。持久合成调用配额2次，超额429，跨Host重启不重置。这是额度机制验证，不改变用户批准的真实模型不设费用上限政策。
- Host运行于512MiB/1CPU/128 PID限制、只读文件系统及有界tmpfs下；普通tmp/state显式noexec，锁定原生模块仅在Host专用32MiB、uid/gid1000、0700的exec缓存加载（不会给容器privileged权限）；独立64MiB容器触发真实OOM，0.25CPU容器验证内核节流。依据[Docker资源限制](https://docs.docker.com/engine/containers/resource_constraints/)。尚不是生产容量测定或物理机内存隔离保证。
- 真实HTTP代理验证首帧提前到达、客户端断连清理和Host断流的错误事件；Host停机的新AI请求503/AI_UNAVAILABLE。流式演练端点是/probe接口，不是B-04完整持久事件API。
- 三次SIGKILL整个Host容器（包含SDK子进程），重启后在冻结10秒内恢复任务，检查数据库副作用/终态各一次；同时持续抽样官网字节，首轮停Host期间用Linux浏览器核对4组已批准DOM/SEO/链接/图片清单。Linux没有像素基线，不声称Linux截图通过。
- 本机另强杀真实Harness Host进程组后运行原5项macOS截图/交互基线，未更新任何截图。复现：先build:static，再执行verify-local-visual.mjs。
- pg_dump恢复到独立prototype_restore数据库，逐表精确比较jobs/status_history/effects/a09_quota并记录耗时；与应用回滚分别计量。此小合成夹具不替代生产备份保留、加密、RPO/RTO或跨区域灾备。
- 静态产物、全周期服务日志检查随机服务凭据/数据库密码及token格式泄漏；通过requestId/runId核对API、Worker、Host追踪。生产审计接入由B阶段实现。

原始输出deployment/outputs/deployment-probe.json，已核对证据放results；汇总见[deployment.md](../results/deployment.md)。

实际验证发现Fastify会默认删除未知字段，已显式禁用removeAdditional/coerceTypes/useDefaults，身份伪造字段必须400且不入库。历史失败与修复保存在results/failure-history.json，未修改冻结阈值。
