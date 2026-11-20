# 下一步领取独立任务144

2026-11-20。142、143已验收关闭；PR146合并SHA `96ae5b62bd398f00d2a7100bceba522b1a31a603`。144业务依赖及共享文件交接均满足。107仍为Tracking，未部署。

```text
你是DeepSeek。本轮只领取Issue #144：维护者能跟随批次并恢复失败文件。

先读AGENTS.md、docs/refactor/delivery-contract.md、Issue144最新顶部和docs/refactor/task-cards/import-batch-recovery.md。142/143已完成，从包含96ae5b62bd398f00d2a7100bceba522b1a31a603的最新origin/refactor/integration建立独立分支/目录，记录执行者、基础SHA、允许修改文件。旧PR141只作为可复用实现/测试来源，不整体合并或继续stack。

编码前先提交BAT-01—04的测试可执行性映射：每项给原状态、输入、动作、确定屏障/交错、期望、禁止副作用、测试路径与数据库/API断言。已有预检通过的相同方案可引用；新缺口先反馈ChatGPT，不自行改变设计或再拆144-A/B/C。

BAT-01：真实批次从parsing到completed/partial/failed/cancelled，最多3次受控poll观察变化；详情按真实ID，未提交向导草稿保持。
BAT-02：failed/cancelled文件重试、parsing取消；连续点击、409/403/401/断响应，目标fileId和expectedRevision准确，防重入、错误可恢复，取消请求不冒充真实取消终态。
BAT-03：101个合成批次走真实cursor，两页无重复遗漏；after确实发送，返回/刷新、切空间与身份变化无旧详情残留。
BAT-04：完成/部分完成、空列表、无权限/撤权、窄屏/键盘；只显示真实状态和允许动作，待审入口交接已设计真实资源/路由，不伪造审校数据。

只实现批次监控恢复交互及测试，不重写143向导/后端状态机，不新增业务命令或审校编辑器。正常业务成功使用真实API/PG，错误渲染可受控响应，不添加生产测试后门。完成后一个结果PR至refactor/integration，关联144，逐AC附固定head、实际命令、CI日志、失败及未运行项；技术审核和有效CI通过后自动合并关闭144。不要关闭107，不代签人工体验，不自行部署。
```
