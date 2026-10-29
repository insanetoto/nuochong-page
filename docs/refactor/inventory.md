> 范围变更（2026-10-29）：本文保留为已验收A阶段的历史证据。用户现改为以DeepSeek Harness为基座的公司OA；旧业务迁移/旧B—E执行计划已撤销，当前以[新路线图](roadmap.md)和[ADR-010](../adr/ADR-010-oa-harness-product-scope.md)为准。

# A-01 仓库与功能资产盘点

日期：2026-10-29；Issue #1。状态：技术盘点完成；用户于2026-10-29在本任务中明确确认全部三项迁移处置。PR #21已创建，待集成审查与CI，不把确认处置等同于自动合并。

## 固定基线

已成功执行 `git fetch origin`，下列为远程跟踪分支对应的精确提交。分支后续变化需重新盘点，不以分支名代替版本。

| 参考 | SHA |
| --- | --- |
| origin/main | `46ab969aa3ad10c2b2efd4c4f0b8243bb403943b` |
| origin/dev | `bdba03f2b4643dda2a81b2c09294fde2b2106ef6` |
| origin/test | `a9083ddc2c8ecf3f31e3ed7242479884f5ee86fa` |
| origin/docs/refactor-collaboration-plan | `6e6836508daeb98691c5dd2c29f6cd3b263f615c` |

## 结论与迁移规则

- 官网以 origin/main 为保护基线。test 调整了产品/价值区块顺序，不能因合并test而顺带改变官网。该差异先不采纳，若产品要求另开变更。
- test 包含更完整的业务原型；保留路由、界面、双语、列表/弹窗/导航和测试资产。后续按模块替换模拟实现，不删除未盘点功能。
- dev并不是test的完整替代；三个分支分别留存，不进行整分支覆盖、强推或合并。
- main的CI与健康检查比test更新；不能因迁移业务丢失main工作流和健康检查脚本。
- 尚无真实后端身份、企业隔离、持久业务库、课程评分、工单自动化或模型服务。模拟页面不作为产品功能已经交付的证据。

## 功能与运行资产

| 资产 | 现状与来源 | 迁移归属 |
| --- | --- | --- |
| 双语营销官网 | main的HomePage、globals、public素材；URL语言参数/本地偏好/浏览器语言 | A-02固定内容/截图；B-01整体迁移，禁止顺带改版 |
| 静态生产入口 | static-src/main.tsx只渲染HomePage，不加载AppEntry；Vite输出dist-static | B-01官网独立构建；B-06同产物推广 |
| 完整Worker应用 | app/layout含业务AppEntry；worker/index.ts提供路由及可选图片优化 | B-01/B-05逐步替换运行入口，旧环境先保留 |
| 国家码API | /api/country读取cf-ipcountry，无值返回XX | B-01保留兼容，部署外移后确认代理提供方式 |
| 模拟登录/员工管理 | main与test均有前端状态及演示身份；不是服务端权限控制 | B-02真实身份；B-03持久数据；不复制演示口令 |
| 企业控制台与双语壳 | test包含图标导航、子导航、语言切换、共享表单/弹窗/分页 | B-01保留交互，权限在B-02实施 |
| 个人资料与安全设置 | test的profile数据为mock常量；不等于真实密码/账号安全能力 | B-01保留界面，B-02/B-03替换实现 |
| 培训列表与详情 | test含mockTrainingCourses和课程编辑原型 | B-01保留资产；D阶段交付真实培训闭环 |
| 工单列表与详情 | test含工单UI、mock数据及编辑交互 | B-01保留资产；E阶段交付真实工单/工具执行 |
| 通知、订阅、语音界面 | test含通知分类/详情/订阅/TTS页面及mock数据 | B-01保留原型；真实发送/语音服务暂缓，另开范围变更 |
| 帮助列表与详情 | test内置内容与组件 | B-01保留；独立CMS/内容运营暂缓 |
| SIWC帮助代码 | app/chatgpt-auth.ts依赖特定托管身份头，当前非业务真实认证 | A-05评估身份方案；B-02不信任公网伪造头 |
| D1/Drizzle/R2 | db/schema.ts为空，hosting配置未启用绑定，examples/d1仅示例 | A-05决定存储；B-03实施；示例不能冒充生产数据 |
| 构建与测试 | npm锁文件；Worker SSR、静态构建、Playwright业务流程；test另有扩展模块用例 | A-02/B-06保留回归意图并扩充 |
| 发布与健康检查 | main推送部署Nginx，test推送部署Cloudflare；CI与部署分开触发 | B-06建立强制门禁；A阶段不触发生产部署 |

## 已知风险及证据边界

1. 官网的区块顺序跨分支不同；决定以生产main为默认保护基线，已获用户确认。
2. 模拟身份、个人资料、培训、通知等位于客户端；尚无跨企业授权或真实持久化，不能用于实际客户数据。
3. 生产静态站与测试完整应用内容范围不同；HTTP健康检查不能证明业务后台正常。
4. test中的hooks lint抑制及zh-CN测试locale不应无评审照搬；当前main lint是否仍失败由A-02/B-06实际检查。
5. CLAUDE.md中ICP未备案/域名拦截为历史记录，不能当作当前线上事实；本任务未执行在线探测，也未修改运行环境。
6. 通知真实推送、TTS服务、帮助运营尚不在既定B—E具体任务范围，本次标记暂缓并显式保留原型，禁止静默承诺实现。

## 分支差异汇总

- `origin/main..origin/test`：71 个文件差异。
- `origin/main..origin/dev`：70 个文件差异。
- `origin/dev..origin/test`：9 个文件差异。

## main → test 逐文件迁移映射

状态方向为main到test：A新增、M修改、D在test缺失。D不代表应在迁移时删除。所有行均为技术建议，已获用户确认。

| 状态 | 路径 | 处置 | 目标任务 |
| --- | --- | --- | --- |
| D | `.github/workflows/ci.yml` | 保留main治理能力；重建新应用门禁 | A-03 / B-06 |
| M | `.github/workflows/deploy-test.yml` | 保留main治理能力；重建新应用门禁 | A-03 / B-06 |
| M | `.github/workflows/deploy.yml` | 保留main治理能力；重建新应用门禁 | A-03 / B-06 |
| M | `.github/workflows/e2e.yml` | 保留main治理能力；重建新应用门禁 | A-03 / B-06 |
| M | `README.md` | 按新结构更新；保留规划及操作说明 | A-03 / B-01 |
| M | `app/HomePage.tsx` | 保留main官网基线；test变更单独审查，不直接覆盖 | A-02 / B-01 |
| M | `app/app/(console)/dashboard/page.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/(console)/help/[id]/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/help/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/notifications/detail/[id]/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/notifications/inner/[type]/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/notifications/layout.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/notifications/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/notifications/subscribe/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/notifications/tts/page.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/(console)/training/[id]/page.tsx` | 保留交互原型；真实课程/学习数据在D阶段替换 | B-01 / D-01—D-05 |
| A | `app/app/(console)/training/page.tsx` | 保留交互原型；真实课程/学习数据在D阶段替换 | B-01 / D-01—D-05 |
| A | `app/app/(console)/users/layout.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/(console)/users/profile/page.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/(console)/users/security/page.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/(console)/workorders/[id]/page.tsx` | 保留交互原型；真实工单/执行在E阶段替换 | B-01 / E-01—E-04 |
| A | `app/app/(console)/workorders/page.tsx` | 保留交互原型；真实工单/执行在E阶段替换 | B-01 / E-01—E-04 |
| M | `app/app/_components/AppEntry.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/AppShell.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/AuthGuard.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_components/ConfirmDialog.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/EmptyState.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/FormField.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/LanguageSwitcher.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/LoginForm.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_components/Modal.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/Pagination.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/Panel.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/SearchBar.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/StatusBadge.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/SubNav.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/Tabs.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/UserEditModal.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/app/_components/UsersManager.tsx` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_components/help/HelpDetail.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/help/HelpHome.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/help/HelpSidebar.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/notifications/NotificationDetail.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/notifications/NotificationsList.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/notifications/NotificationsSubscribe.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/notifications/NotificationsTts.tsx` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_components/profile/AvatarModal.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_components/profile/ProfileForm.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_components/profile/SecuritySettings.tsx` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_components/training/TrainingDetail.tsx` | 保留交互原型；真实课程/学习数据在D阶段替换 | B-01 / D-01—D-05 |
| A | `app/app/_components/training/TrainingEditModal.tsx` | 保留交互原型；真实课程/学习数据在D阶段替换 | B-01 / D-01—D-05 |
| A | `app/app/_components/training/TrainingList.tsx` | 保留交互原型；真实课程/学习数据在D阶段替换 | B-01 / D-01—D-05 |
| A | `app/app/_components/workorders/WorkOrderDetail.tsx` | 保留交互原型；真实工单/执行在E阶段替换 | B-01 / E-01—E-04 |
| A | `app/app/_components/workorders/WorkOrderEditModal.tsx` | 保留交互原型；真实工单/执行在E阶段替换 | B-01 / E-01—E-04 |
| A | `app/app/_components/workorders/WorkOrderList.tsx` | 保留交互原型；真实工单/执行在E阶段替换 | B-01 / E-01—E-04 |
| M | `app/app/_lib/auth.ts` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_lib/business-messages.ts` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_lib/help.ts` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_lib/i18n.ts` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_lib/list-utils.ts` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| A | `app/app/_lib/notifications.ts` | 保留路由/交互资产；通知和帮助先保持演示边界，不接真实业务推送 | B-01；真实通知/帮助运营另行变更评审 |
| A | `app/app/_lib/profile.ts` | 保留界面；替换模拟身份/安全设置，禁止迁移演示认证为生产身份 | B-01 / B-02 / B-03 |
| A | `app/app/_lib/training.ts` | 保留交互原型；真实课程/学习数据在D阶段替换 | B-01 / D-01—D-05 |
| A | `app/app/_lib/workorders.ts` | 保留交互原型；真实工单/执行在E阶段替换 | B-01 / E-01—E-04 |
| M | `app/business.css` | 保留工作台组件/路由/双语外观；模拟数据单独替换，样式不得污染官网 | B-01 / B-02 / B-03 |
| M | `app/globals.css` | 保留main官网基线；test变更单独审查，不直接覆盖 | A-02 / B-01 |
| M | `eslint.config.mjs` | 审查test语言环境与lint差异；统一后重跑检查 | A-02 / B-06 |
| M | `playwright.config.ts` | 审查test语言环境与lint差异；统一后重跑检查 | A-02 / B-06 |
| D | `scripts/check-environment.mjs` | 保留main治理能力；重建新应用门禁 | A-03 / B-06 |
| A | `tests/e2e/business-modules.spec.ts` | 保留用例意图；绑定新路由/真实数据夹具后扩充回归 | A-02 / B-06 / B-08 |
| M | `tests/e2e/login.spec.ts` | 保留用例意图；绑定新路由/真实数据夹具后扩充回归 | A-02 / B-06 / B-08 |

## 路由文件清单

动态路由保留原参数语义；(console)为路由组，不进入URL。

### origin/main

- `app/api/country/route.ts`
- `app/app/(console)/dashboard/page.tsx`
- `app/app/(console)/users/page.tsx`
- `app/app/login/page.tsx`
- `app/app/page.tsx`
- `app/page.tsx`
- `examples/d1/app/api/notes/route.ts`

### origin/test

- `app/api/country/route.ts`
- `app/app/(console)/dashboard/page.tsx`
- `app/app/(console)/help/[id]/page.tsx`
- `app/app/(console)/help/page.tsx`
- `app/app/(console)/notifications/detail/[id]/page.tsx`
- `app/app/(console)/notifications/inner/[type]/page.tsx`
- `app/app/(console)/notifications/page.tsx`
- `app/app/(console)/notifications/subscribe/page.tsx`
- `app/app/(console)/notifications/tts/page.tsx`
- `app/app/(console)/training/[id]/page.tsx`
- `app/app/(console)/training/page.tsx`
- `app/app/(console)/users/page.tsx`
- `app/app/(console)/users/profile/page.tsx`
- `app/app/(console)/users/security/page.tsx`
- `app/app/(console)/workorders/[id]/page.tsx`
- `app/app/(console)/workorders/page.tsx`
- `app/app/login/page.tsx`
- `app/app/page.tsx`
- `app/page.tsx`
- `examples/d1/app/api/notes/route.ts`

## 复现与审查

```bash
git fetch origin
git rev-parse origin/main origin/dev origin/test origin/docs/refactor-collaboration-plan
git diff --name-status origin/main origin/test
git diff --name-status origin/main origin/dev
git diff --name-status origin/dev origin/test
git ls-tree -r --name-only origin/test app
```

机器可读快照见 [A-01-inventory.json](evidence/A-01-inventory.json)，包含固定SHA、三组完整文件差异/处置/目标及路由。复核时使用该JSON内SHA重跑，避免新提交导致比较漂移。

未运行：构建、浏览器、线上健康或真实模型测试；本任务是只读源码盘点，以上属于后续任务。未合并main/dev/test，未修改官网或业务代码。

确认记录：用户明确表示“3项都确认，按照建议方式处置”：官网采用生产main基线；保留test业务原型并分阶段替换模拟实现；真实通知/TTS/帮助运营暂缓。PR：https://github.com/insanetoto/nuochong-page/pull/21 。集成审查与CI仍须通过后再关闭A-01。
