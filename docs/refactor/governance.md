# A-03 协作治理落地与验收

日期：2026-10-29。Issue #3。状态：保护规则已配置并回读验证；PR #23已通过双构建及E2E、合入集成分支，Issue #3已关闭。用户明确取消非作者必需批准，其他保护保留。

## 已落实资产

- 根AGENTS.md：官网基线、企业隔离、适配层、任务/验收/发布边界。
- .github/ISSUE_TEMPLATE/task.md、PULL_REQUEST_TEMPLATE.md：范围、依赖、AC、证据与恢复。
- CODEOWNERS：暂路由至已知维护人insanetoto；未虚构团队成员，仅为可选审查路由，不强制独立批准。
- A/B里程碑和stage:A、stage:B标签：已关联现有20个Issue（含两个总览），无未经批准的截止日期。
- refactor/integration：从已验收A-02提交57ded3af9ec1d319471046a7e209185acce801d8建立；不会修改main/test。
- E2E触发：新增refactor/integration推送与PR；规划文档分支PR也运行E2E，需以本次Actions验证结果为准。

## 发布与权限状态

仓库已由用户改为public；用户随后补充Administration授权。已通过传统分支保护API启用main、test、refactor/integration规则，并逐项回读验证。Rulesets为空不代表传统分支保护不存在。

不自动公开仓库、购买套餐、增加成员或改变生产部署。CODEOWNERS/模板只是指引，不能替代服务端强制规则。

## 已启用规则（API回读验证）

对main、test、refactor/integration：要求PR、必需批准人数为0、解决审查讨论、禁止删除与强推；enforce_admins=true，管理员同样受约束。用户于2026-10-29明确要求“不需要非作者审核”，据此调整审批人数；CI与其余保护保持。

main和refactor/integration的required checks使用实际作业名：`Build (worker)`、`Build (static)`、`Playwright E2E`；要求分支为最新。线上Health属于环境状态检测，PR事件会跳过，不能作为所有PR强制项。已有分支若工作流未产出某检查，不可直接添加永远不会出现的必需检查；先通过独立PR同步工作流再启用。test当前工作流只有E2E及部署，暂强制Playwright E2E，双构建门禁等B-06同步工作流后再加；此差异明确保留。main/test工作流的修改需要单独审查，不在此次A-03直接推送。

main/test当前仍会触发旧部署。部署等待同SHA完整检查的强制门禁与同产物推广在B-06落实；不能把PR检查误当完整生产发布门禁。

## 任务演练证据

A-01：领取#1→资产盘点→PR #21→用户确认三项处置→对应SHA Actions成功→合入规划分支→关闭Issue。

A-02：领取#2→独立截图/内容基线→本地普通回归5/5→PR #22→用户明确验收→合入规划分支→关闭Issue。准确平台限制记录在tests/visual/README.md。

人类确认来自用户当前会话，已回填Issue；没有伪造GitHub approve review。

## 尚待验收清单

- [x] d04a4c2在集成目标上双构建与新增E2E成功，Actions 40810216230/40810216228。
- [x] 管理员授权后通过API启用三个分支保护并回读验证。
- [x] 按用户明确要求不设置非作者必需审批；CODEOWNERS保留可选路由。
- [ ] Project若启用，明确权限和同步方式；现用#11/#20作为Issue状态总览，不冒充自动看板。
- [x] 用户明确确认审批策略，管理员授权配置已回读；PR #23集成后关闭#3。

配置快照见[evidence/A-03-github-setup.json](evidence/A-03-github-setup.json)。此前套餐/权限失败已解除；当前剩余验收项见上表，不把历史阻断当当前状态。
