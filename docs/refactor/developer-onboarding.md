> 当前范围更新：只推进[公司OA-Harness基座路线](roadmap.md)和[OA任务](tasks.md)；文中旧B—E示例不再是领取指令。旧业务演示已移除，业务模块以后另行规划。

# 开发人员上手指南：从个人环境到任务验收

适用项目：nuochong-page；日期：2026-10-29。按顺序完成首次配置，以后从“领取任务”开始。

本指南是个人操作手册；团队规则见 [协作说明](collaboration.md)，任务范围见 [OA任务清单](tasks.md)。示例中的姓名、邮箱、Issue 编号、分支、SHA 和路径均需换成个人实际值。

## 0. 先确认团队准备好了什么

向负责人获取：GitHub 仓库访问权限、任务 Issue URL、指定基础分支/SHA、审查人、测试资源和验收标准。

当前规划随重构集成分支维护；本次OA范围调整见Issue #31和其PR。A阶段已验收，旧B—E停止执行；新OA任务#32—#37见[执行跟踪](oa-tracking.md)。当前增量已验收，仅OA-01 Ready，其余Backlog。refactor/integration和main已启用PR/必需检查，非作者审批数为0；不假定GitHub Project已建立。

当前 `main` 推送会触发生产部署，`test` 推送会触发旧测试环境部署。个人开发只能推送任务分支。没有 Ready Issue 时先请负责人完成任务分派；不要随意挑选未满足依赖的后续任务。

## 1. 配置个人工具

| 工具 | 当前要求 | 验证命令 |
| --- | --- | --- |
| Git | 使用团队支持的稳定版本 | `git --version` |
| Node.js | 当前 engines 要求 >=22.13.0；官网CI用Node22；OA原生页面统一Node24.21.0 | `node --version` |
| npm | 随团队 Node 版本使用；按 package-lock 安装 | `npm --version` |
| GitHub CLI | 推荐；也可用 GitHub 网页领取任务和创建 PR | `gh --version` |
| Codex | 使用团队提供的桌面应用或开发环境，登录自己的授权账号 | 打开本任务目录并完成一次只读仓库检查 |

macOS：先安装 Apple 命令行开发工具（若 Git 已可用可跳过）：

```bash
xcode-select --install
```

已安装 Homebrew 的成员可以安装 GitHub CLI：

```bash
brew install gh
```

Node 从 [官方安装渠道](https://nodejs.org/en/download)或团队现有版本管理器安装。已安装 nvm 的成员可执行 `nvm install 24.21.0`、`nvm use 24.21.0`，之后核对实际版本；此命令不替代团队精确版本冻结。不要在同一终端混用多个 Node 安装来源。

Linux 使用发行版工具和官方安装渠道；Windows 建议统一使用 WSL2 Linux 环境，将代码、Node、npm、Git 和测试全部放在该环境中，避免 Windows Node 与 WSL 路径混用。平台差异无法解决时由平台负责人提供可复现开发环境。

首次开发不需要安装整套 Harness、数据库或生产部署工具。Harness已锁定0.2.1-rc.2，按apps/oa说明安装；不擅自安装上游最新版替代批准版本。

## 2. 配置 Git 署名与 SSH

在自己的电脑上配置个人身份；不要照抄其他成员邮箱：

```bash
git config --global user.name "你的姓名或GitHub用户名"
git config --global user.email "你的GitHub已验证邮箱或GitHub提供的noreply邮箱"
```

若电脑有多套工作身份，可在克隆后使用不带 `--global` 的同名命令，仅对本仓库设置。

先检查现有密钥，再决定是否生成：

```bash
ls -al ~/.ssh
```

没有适用密钥时执行：

```bash
ssh-keygen -t ed25519 -C "你的GitHub邮箱"
```

设置密钥密码；文件已存在时不要覆盖。macOS 使用默认路径时可执行：

```bash
eval "$(ssh-agent -s)"
ssh-add --apple-use-keychain ~/.ssh/id_ed25519
pbcopy < ~/.ssh/id_ed25519.pub
```

自定义文件名时替换路径。Linux/WSL 使用 `ssh-add ~/.ssh/id_ed25519`，复制 `.pub` 公钥文本。将公钥添加到 [GitHub SSH keys](https://github.com/settings/keys)，类型为 Authentication Key；私钥不上传、不共享。

测试：

```bash
ssh -T git@github.com
git ls-remote git@github.com:insanetoto/nuochong-page.git
```

首次连接核对 [GitHub 服务器指纹](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)再确认。SSH 显示个人用户名并提示认证成功即正常，GitHub 不提供 shell，所以该测试命令返回码 1 不等于失败。`ls-remote` 应能读取仓库分支；它只证明读取权限，推送权限以管理员授予及后续任务分支推送为准。[官方说明](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/testing-your-ssh-connection)

## 3. 登录 GitHub 管理任务

SSH 用于 Git 拉取/推送；GitHub CLI 使用浏览器授权访问 Issues、PR、Actions。无需手动创建 PAT，但 CLI 仍会保存授权凭据，两者权限独立。

```bash
gh auth login --hostname github.com --git-protocol ssh --web
gh auth status
gh repo view insanetoto/nuochong-page
```

按终端提示完成浏览器授权，确认登录的是有仓库权限的个人账号。[GitHub CLI 官方说明](https://docs.github.com/en/github-cli/github-cli/quickstart)

不使用 CLI 时，在 [仓库网页](https://github.com/insanetoto/nuochong-page)操作 Issues、Projects、Pull requests 和 Actions；代码仍使用 SSH。CLI 权限暂时不可用不必阻止已授权的本地开发，但不能虚报远程 CI 结果。

## 4. 获取源码与规划

在个人工作目录下克隆，不把下载的 ZIP 当成长期协作工作区：

```bash
git clone git@github.com:insanetoto/nuochong-page.git
cd nuochong-page
git remote -v
git status --short --branch
git config user.name
git config user.email
```

阅读[当前文档入口](README.md)，获取集成分支：

```bash
git fetch origin
git switch --track origin/refactor/integration
```

本地已有同名分支时用 `git switch refactor/integration`；有未提交改动先妥善保留，不强行切换。该分支用于阅读，实际实现要使用下面的独立任务分支。

## 5. 在 GitHub 领取任务

1. 打开[OA跟踪表](oa-tracking.md)，筛选Ready；如团队另建Project则同步状态；阅读 Issue 中的依赖、范围、交付物和每条 AC（验收标准）。
2. 确认依赖已被验收，尚无其他主负责人；“依赖 PR 已打开”不算依赖完成。
3. 将自己设为 Assignee，填写审查人，状态改为 In progress。没有编辑权限时请负责人分派。
4. 评论记录基础分支、SHA、计划修改目录和预计验证方法，再开始工作。

CLI 可用于列出和查看任务；以下 `123` 只是示例，必须替换为真实 Issue 编号：

```bash
gh issue list --repo insanetoto/nuochong-page
gh issue view 123 --repo insanetoto/nuochong-page
gh issue edit 123 --repo insanetoto/nuochong-page --add-assignee @me
```

Project 状态和自定义字段在网页中更新；不假定 `gh issue edit` 会同步 Project 状态。规划ID如OA-01对应#32；具体映射见跟踪表。不因Issue已创建就自动视为Ready。

领取评论模板：

```text
领取：OA-01 / #32
负责人：@我；审查人：@成员
基础：refactor/integration @ 完整SHA
修改范围：apps/oa/ 等Issue批准目录
依赖：#编号，已验收
验证：列出AC对应命令、夹具及所需测试资源
```

## 6. 为个人任务建立隔离工作区

推荐一任务一分支、一 Codex 聊天、一独立目录。以下示例仅在负责人已建立 `refactor/integration`，且指定以其最新提交为基础时执行：

```bash
git fetch origin
git show-ref --verify refs/remotes/origin/refactor/integration
git worktree add -b feature/OA-01-native-home ../nuochong-OA-01 origin/refactor/integration
cd ../nuochong-OA-01
git branch --show-current
git rev-parse HEAD
git status --short
```

将输出 SHA 写回 Issue。若任务指定固定 SHA，确认该 SHA 已获取后，将 worktree 命令最后的 ref 替换成它。分支不存在则找集成人确认，不能擅自改从 test 或 main 开始。

个人只做单任务时也可以在独立 clone 中 `git switch -c`；并行任务不得共享工作目录、node_modules 的安装过程或未分隔的本地运行端口。

## 7. 安装依赖，先验证原始环境

进入任务目录执行：

```bash
node --version
npm --version
npm ci
npx playwright install chromium
npm run dev
```

当前默认开发地址为 `http://localhost:3000`；浏览器检查官网首页和语言切换；旧/app业务路由应404。停止开发服务器使用 Ctrl+C。Playwright 配置会自行启动开发服务器，测试前确认 3000 端口没有其他项目运行，避免误测。

首次在干净分支运行 `npm test`、`npm run build:static`、`npm run test:e2e` 和 `npm run lint`，记录基线结果。此前 main 曾存在 HomePage hooks lint 错误；以当前实测为准，发现存量失败应记录 SHA、错误和归属，不降低规则或归咎于新代码。

原生OA预览使用独立依赖与状态，不要求模型密钥即可检查页面：

```bash
npm ci --prefix apps/oa --ignore-scripts --no-audit --no-fund
npm run oa:start
```

在终端打开官方打印的私有启动URL；默认127.0.0.1:3080，使用apps/oa/.state。模型对话需管理员另配服务端凭据，当前不向普通员工开放owner管理面。官网Worker的/oa只按NUOCHONG_OA_URL跳转，未配置503；静态站需实际服务/代理。详见[原生首页说明](../../apps/oa/README.md)。产品CLI的NUOCHONG_ACCESS_TOKEN是后续OA服务凭据，不能用DeepSeek/GitHub密钥替代。

## 8. 使用 Codex 编写代码

在 Codex 中打开本任务的 worktree 目录，创建独立聊天。先让它读取适用 AGENTS.md（若已有）、Issue、ADR 和规划；AGENTS.md 可用于保存仓库长期约束，但不替代本次任务范围。[OpenAI 官方工作流说明](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)

可复制以下任务提示：

```text
请完成 Issue <URL>（规划ID：OA-01）。
工作目录：<本任务绝对路径>，任务分支：feature/OA-01-native-home。
基础分支及SHA：<负责人指定值>；目标：refactor/integration。
先读取适用AGENTS.md、Issue、roadmap.md、tasks.md及相关ADR。
范围：<允许目录与交付物>；不包含：<相邻模块>。
验收标准：<完整AC，含负例和故障场景>。
按小步实现并运行对应测试，保留其他人的修改。
官网内容与视觉不能改变；密钥不能进入源码、日志或PR。
接口/依赖冲突请报告并提出调整，不静默扩大范围。
输出：改动说明、AC对应证据、未运行项、风险与回滚步骤。
本次只授权本地实现和测试；提交/推送/创建PR由我单独指定。
```

开发者需阅读 diff 和测试结果，检查是否超出任务范围。跨聊天交接要保留基础/当前 SHA、AC状态、测试命令、失败原因及下一步，不要求接手者重读完整聊天。

## 9. 运行测试并整理证据

对代码改动，按 Issue 范围执行相关检查，当前命令为：

```bash
git diff --check
npm run lint
npm test
npm run build:static
npm run test:e2e
```

按需补充 [协作说明的验证矩阵](collaboration.md)：资源权限、任务恢复、工具幂等、官网视觉、CLI契约及原生页面等。仅文档变更检查链接、命令、任务依赖与现状即可，不要求无关全量构建。

验收证据按 AC 整理：

| AC | 实际步骤 | 预期/实际结果 | 证据 |
| --- | --- | --- | --- |
| AC1 | 执行命令与夹具 | 通过/失败/未运行及原因 | Actions URL、截图或脱敏日志 |
| AC2 | 权限/失败用例 | 必须与Issue标准一致 | 测试文件、结果 |

失败要区分新增回归、存量问题、网络/环境问题和缺少凭据。未运行不等于通过；真实模型集成不能用 mock 结果代替。截图与 trace 附在批准的 GitHub artifact/PR 中，移除凭据及非授权数据。

## 10. 检查、提交、推送

先检查文件，再按具体路径暂存，避免把其他任务或本地配置打包提交：

```bash
git status --short
git diff
git add <本任务文件路径>
git diff --cached --check
git diff --cached
git commit -m "feat(ai): add cancellable run adapter"
git push -u origin feature/OA-01-native-home
```

替换 `git add` 占位路径和提交描述；不要原样复制占位符。推送前核对当前分支，不能是 main/test。检查凭据、生成目录和客户资料未被暂存。后续修复继续提交到同一任务分支。

推送被拒绝时先 `git fetch origin` 判断原因，不使用 force 覆盖他人提交。需要更新基础时，在自己的任务分支按团队约定合并最新 `origin/refactor/integration`，解决冲突后重跑受影响验证；不在受保护分支处理试验性冲突。

## 11. 创建 PR、跟进 CI 与审查

在 GitHub Pull requests 中选择正确 base/head，先创建 Draft PR；按 [协作说明](collaboration.md) 的模板写问题、结果、Issue、证据及风险。CLI 示例：

```bash
gh pr create --repo insanetoto/nuochong-page --base refactor/integration --head feature/OA-01-native-home --draft
gh pr checks --repo insanetoto/nuochong-page 456
```

`456` 是示例 PR 编号。必要时使用 `gh pr create --web` 打开网页；审查人使用真实 GitHub 用户名。PR 描述填写 `Refs #实际编号`，待业务验收后再关闭 Issue，避免自动关闭掩盖 Validating 状态。

在 Actions 检查结果 SHA 与最新 PR 提交一致；打开失败 job 找到具体步骤，修复后推送并确认重新运行。任务分支推送触发双构建和线上健康观察，向refactor/integration的PR触发E2E；OA/CLI/契约专项检查按变更路径触发。所有适用检查均需核对，不把缺失检查误认绿色。

CI 和作者自查通过后，转为 Ready for review 并按任务需要请求可选审查（非作者批准不再是必需门禁）。启用 Codex GitHub Review 后按团队约定发起辅助审查；未启用则用独立聊天只读审查 diff。回复每条有效反馈，修复后附验证结果；更新提交后旧批准可能失效，重新请求审查。

## 12. 合并后的测试与最终验收

作者不能仅因 PR 已合并就将任务标为 Done：

1. 集成人按规则合并至指定分支，记录合并后 SHA，Project 转 Validating。
2. 测试负责人在目标测试环境验证该 SHA/产物版本，逐条检查 AC，而非只检查任务分支本地运行。
3. 产品涉及文案、视觉或用户流程时参与验收；架构变更由架构负责人确认 ADR。
4. 失败则创建关联缺陷并修复，保留原验收记录；不要通过改验收标准放行。
5. 通过后把验收评论、CI、版本、截图/报告回填 Issue，更新依赖任务状态，再标为 Done 并关闭 Issue。
6. A—E 阶段门禁另行会签；任务完成不代表阶段完成或已生产发布。

验收评论模板：

```text
任务：<规划ID / Issue>
PR与合并SHA：<URL / SHA>
测试环境与产物版本：<地址 / 摘要；仅文档填“不适用”>
AC1：通过，证据<URL>
AC2：通过，证据<URL>
回归与未运行项：<结果及批准的例外>
遗留问题：<关联Issue，无阻断项>
结论：通过 / 不通过
验收人和日期：<身份 / 日期>
发布状态：未发布 / 已发布版本及记录
```

生产发布由发布负责人负责，须走 [团队发布流程](collaboration.md)。不要自行推 main/test 来“完成验收”。

## 13. 常见阻断

| 现象 | 处理 |
| --- | --- |
| SSH publickey 错误 | 检查密钥加载、GitHub公钥、当前账号与组织授权；不复制同事私钥 |
| SSH成功，gh 403/404 | 核对 gh 登录账号、仓库/API授权；使用网页完成任务操作，必要时管理员处理 |
| gh 登录 unexpected EOF | 核对网络/代理并重试；可临时用 `GODEBUG=http2client=0 gh auth login --hostname github.com --git-protocol ssh --web` 排除 HTTP/2；不关闭TLS校验 |
| npm 安装超时 | 核对公司批准的网络/registry；可用 `npm ci --no-audit --no-fund --fetch-timeout=30000 --fetch-retries=1` 分离审计连接问题，不改锁文件掩盖失败 |
| 浏览器依赖缺失 | 执行 `npx playwright install chromium`；Linux/WSL 若缺系统依赖按平台指引安装，可能需要管理员权限 |
| 端口占用/跑到其他页面 | 停止自己旧服务，确认3000对应本任务目录；多任务端口调整需同步Playwright配置 |
| 集成分支不存在、Issue无AC或缺依赖 | 标记Blocked并找负责人，不自行从任意分支实现 |
| 同事已改相同接口/迁移 | 在Issue协商契约与合入顺序，更新基础后重测 |
| 需要模型/外部沙箱凭据 | 负责人通过受控测试环境配置；不在Issue、PR、聊天中粘贴密钥 |

## 14. 个人完成检查

- [ ] 个人身份、SSH、GitHub访问和工具版本已验证。
- [ ] 任务已领取，依赖/范围/AC/审查人/基础SHA明确。
- [ ] Codex在独立目录工作，未扩大范围或修改官网基线。
- [ ] 代码和文档已自查，相关测试与负例有真实证据。
- [ ] 仅本任务文件提交，远程任务分支与本地提交一致。
- [ ] PR目标正确、CI对应最新SHA、审查反馈已闭环。
- [ ] 合并后集成验收通过，Issue与Project记录完整。
- [ ] 发布状态如实记录，未把提交/合并当作生产发布。

## OA专项验证与CLI要求

```bash
npm run test:cli
node tools/nuochong-cli/test/package-smoke.mjs
node apps/oa/verify-home.mjs
```

CLI用合成HTTP/SSE服务检查协议；原生页面测试使用全新状态、0次模型调用。正式OA API/外部AI联调须在OA-02/03提交真实证据。新增功能必须同步commandId、输入/输出schema、CLI映射、授权/幂等/失败结果；未实现能力标planned。

官网视觉使用tests/visual说明的对应平台普通测试，不更新快照掩盖回归。当前路线不包含知识/培训/工单业务；不要执行历史A/B任务或复制旧演示登录。
