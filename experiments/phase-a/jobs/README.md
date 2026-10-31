# A-07 持久任务隔离原型

依赖 A-05，基线 `bc53bb713cc356278021451aec8b37594a1c14e1`。不依赖 A-06 内部代码，不部署官网或生产。

使用真实 PostgreSQL 17.11 和锁定的 pg 8.23.1。`schema.sql` 为原型夹具，不是产品迁移。`store.mjs` 实现唯一幂等键、行锁/`SKIP LOCKED`领取、5秒租约、fencing token、续租、最多2次重试、取消竞争和数据库事务内模拟副作用。算法依据：[PostgreSQL 17 行锁](https://www.postgresql.org/docs/17/explicit-locking.html)、[SELECT 锁定子句](https://www.postgresql.org/docs/17/sql-select.html)。

`verify-jobs.mjs` 每次创建并最终删除独立的 `a07_*` schema。仅对专用测试库执行，用户必须有创建/删除该测试schema的权限。没有 DATABASE_URL 时明确失败，不降级为内存假实现。

```sh
npm ci --prefix experiments/phase-a/jobs --ignore-scripts --no-audit --no-fund
# DATABASE_URL 指向隔离的 PostgreSQL 17.11，勿使用生产库
node experiments/phase-a/jobs/verify-jobs.mjs
```

测试包括3轮双独立连接池竞争、3个真实Node Worker进程被SIGKILL、每秒扫描直到5秒租约实际过期并在10秒内重领、旧token拒绝写入、重试和取消竞争。除3轮实测崩溃外，续租/不确定外部写入场景明确使用修改lease_until的数据库故障注入，不能混为真实等待时间。

effects 是同数据库、同事务的合成接收方，因此可以验证该边界内无重复业务写入；不能据此宣称任意远程服务exactly-once。外部调用前须持久化external_pending意图，丢租约或不明错误后标记compensation_required，禁止自动重试；实际外部接收方、人工补偿产品流程尚未实现。

服务端身份鉴权和企业隔离属于A-08。该模块不是可直接暴露给客户端的API，tenant/id/failure等参数来自可信执行代码，不能让模型或客户端直接调用。状态历史是本原型的数据库审计表，尚未实现A-05公共事件schema或SSE发布。备份、真实Host强杀和应用回滚属于A-09。

本机无PostgreSQL，只做Node语法检查；实际SQL/并发/故障结果以远程 `Durable jobs prototype` 工作流产物和 [结果报告](../results/jobs.md) 为准。
