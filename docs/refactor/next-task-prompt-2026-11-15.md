# 下一步仅执行独立任务142

2026-11-15复审后更新。范围及合法交错预期见[Issue142](https://github.com/insanetoto/nuochong-page/issues/142)及[本轮审查](https://github.com/insanetoto/nuochong-page/pull/140#pullrequestreview-5909973194)。

```text
你是DeepSeek。本轮只领取正式Issue #142，沿用PR #140和当前1350ef7实现，不处理107-C、143或144，也不再拆字母子任务。

先读#142顶部及最新审查，把下列三项映射到具体测试文件、夹具、屏障和独立预期，先交测试计划，不重写已通过的强杀恢复、线程超时、PDF/DOCX。

1. RUN-02：Worker到最终提交临界点暂停；分别让取消先获串行锁和提交先获串行锁，检查API/函数/DB文件/批次一致。取消先持久化则cancelled且0来源/片段；提交先完成则保持parsed且仅一份副作用，不能假报cancelled。
2. RUN-03：Worker授权检查后、插入前持业务锁暂停；另一个真实管理事务撤角色，证明其锁等待。释放后验证提交先完成的合法结果；反序撤权先完成则Worker拒绝且0新增。不能只用前后顺序用例或sleep猜测。
3. RUN-04：真实CLI与API用相同身份/空间验证reader导入写、隐藏/跨空间资源拒绝，附稳定错误和0业务副作用。

另如实记录PR run43696739241旧control-api取消断言running≠cancelled失败，与同head手动成功区分。定位最小原因，不盲目复跑或删断言，不擅改原生Worker；如需超出142的修复，先给证据和范围反馈。

完成后在PR140交付RUN-01—04证据表、准确head/实际命令和运行链接、失败/未运行项。仍只一个独立结果PR至integration，不Closes107。ChatGPT审核及有效CI通过后自动合并关闭142，再从已合并SHA领取143；143/144目前不开始新代码，不自行部署。
```
