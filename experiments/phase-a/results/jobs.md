# A-07 持久任务验证记录

2026-10-29，基线 `bc53bb713cc356278021451aec8b37594a1c14e1`，Issue #7已领取。

原型和测试矩阵见 [jobs/README.md](../jobs/README.md)。本机无PostgreSQL，已完成语法和差异检查；真实数据库结果待远程PostgreSQL 17.11工作流，不以语法检查代替验收。

输出：`jobs/outputs/jobs-probe.json`，包含版本、CPU/内存/OS、全部用例及3轮真实Worker崩溃重领时限。未运行/失败时必须保留原因，只有实际结果满足冻结v1指标后才进入人工验收。
