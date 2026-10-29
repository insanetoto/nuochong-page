# A-09 部署与恢复验证

2026-10-29，基线fcb8d5c，用户已验收A-08并授权继续A-09/A-10。

本机macOS：强杀真实Harness Host进程组后，原官网基线5/5通过，Chrome156.0.8078.48，Node24.21.0；未更新截图。证据[darwin-visual.json](../deployment/results/darwin-visual.json)。

Linux：实际容器、限额、Host强杀、同产物推广、应用回滚、独立数据库恢复结果等待远程CI。实现、复现、合成执行范围和限制见[部署说明](../deployment/README.md)，不能用本机语法检查替代这些结果。
