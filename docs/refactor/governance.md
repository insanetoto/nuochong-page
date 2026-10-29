# A-03 协作治理落地与验收

日期：2026-10-29。Issue #3。状态：实施/验证中，不宣称强制保护已生效。

## 已落实资产

- 根AGENTS.md：官网基线、企业隔离、适配层、任务/验收/发布边界。
- .github/ISSUE_TEMPLATE/task.md、PULL_REQUEST_TEMPLATE.md：范围、依赖、AC、证据与恢复。
- CODEOWNERS：暂路由至已知维护人insanetoto；未虚构团队成员，不表示作者可独自批准自己。
- A/B里程碑和stage:A、stage:B标签：已关联现有20个Issue（含两个总览），无未经批准的截止日期。
- refactor/integration：从已验收A-02提交57ded3af9ec1d319471046a7e209185acce801d8建立；不会修改main/test。
- E2E触发：新增refactor/integration推送与PR；规划文档分支PR也运行E2E，需以本次Actions验证结果为准。

## 发布与权限状态

仓库已由用户改为public，Rulesets可读取，当前为空。传统分支保护读取仍返回403 Resource not accessible by personal access token；需要Administration权限或管理员网页操作。账户拥有admin身份不等于Token获授Administration API权限。

不自动公开仓库、购买套餐、增加成员或改变生产部署。CODEOWNERS/模板只是指引，不能替代服务端强制规则。

## 拟启用规则（需回读验证）

对main、test、refactor/integration：要求PR、至少1位非作者批准、新提交撤销旧批准、解决审查讨论、禁止删除与强推。不要为通过当前PR而关闭规则；缺少独立审查成员则保留待审状态。

required checks使用实际作业名：`Build (worker)`、`Build (static)`、`Playwright E2E`；要求分支为最新。线上Health属于环境状态检测，PR事件会跳过，不能作为所有PR强制项。已有分支若工作流未产出某检查，不可直接添加永远不会出现的必需检查；先通过独立PR同步工作流再启用。main/test工作流的修改需要单独审查，不在此次A-03直接推送。

main/test当前仍会触发旧部署。部署等待同SHA完整检查的强制门禁与同产物推广在B-06落实；不能把PR检查误当完整生产发布门禁。

## 任务演练证据

A-01：领取#1→资产盘点→PR #21→用户确认三项处置→对应SHA Actions成功→合入规划分支→关闭Issue。

A-02：领取#2→独立截图/内容基线→本地普通回归5/5→PR #22→用户明确验收→合入规划分支→关闭Issue。准确平台限制记录在tests/visual/README.md。

人类确认来自用户当前会话，已回填Issue；没有伪造GitHub approve review。

## 尚待验收清单

- [ ] 本次PR的构建与新增E2E在集成目标上实跑通过。
- [ ] 管理员通过API或网页启用适用分支保护并回读验证。
- [ ] 团队指定独立审查成员，完善CODEOWNERS与审查职责。
- [ ] Project若启用，明确权限和同步方式；现用#11/#20作为Issue状态总览，不冒充自动看板。
- [ ] 用户确认治理差异与管理员配置证据后关闭#3。

配置快照见[evidence/A-03-github-setup.json](evidence/A-03-github-setup.json)。待权限问题解决后更新快照，保留此次失败原因与时间，不把历史阻断当作当前状态。
