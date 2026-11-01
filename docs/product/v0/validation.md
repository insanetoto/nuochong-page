# 初版验证记录

2026-11-01，KBV0-06。下列是工程测试，不是负责人产品验收。

| 检查 | 本机结果 | 范围 |
|---|---|---|
| PostgreSQL API/身份/来源/队列 | 53/53 | 独立 schema、私有真实文件、HTTP；含真实 SIGKILL 恢复/发送后不确定任务不重放、插件只读/版本兼容与代理 Cookie/CSRF 负例 |
| 公司工作台浏览器 | 1/1 全链路 | 实际 Chrome；登录、文件导入、编译、审校、审批发布、原文、引用问答、部门、退出、只读角色拒绝管理 |
| CLI | 19/19 + 独立 npm 包 | 登录脱敏、协议/超时/幂等/事件；真实知识查询与管理拒绝另在 API 测试中 |
| MCP | 3/3 | 真实 stdio 与 HTTP；公司角色、引用撤回、身份撤销、伪造输入拒绝 |
| 插件组合 | 3/3 | 依赖、版本、命名冲突与禁用边界 |
| 真实 DeepSeek Harness | 2 个任务通过 | 编译候选草稿→测试明确审校发布→引用问答；报告 knowledge-v0-real.json；请求总数未测、费用 unknown |

浏览器故障/协议测试使用明确的合成模型执行器，不能当作真实模型结果。真实模型用独立脚本，在隔离 PostgreSQL 与合成制度上验证，密钥不提交、不注入普通 CI。工作台 macOS 截图只能作本机页面证据，不能冒充 Linux 官网像素基线。

Linux CI 已执行同样 PostgreSQL/MCP/CLI 检查与 Chromium 工作台闭环并通过，上传合成页面截图；后续提交仍须通过各自 PR head 门禁。

未满足的原规划大范围目标：50/20 人工标注集、真实生产容量/成本、全部来源格式、语义召回/完整 lint、企业 SSO、跨产品完整卸载/数据迁移，见 README 下一轮清单。官网本轮未改动。

## Linux 与真实公网收尾

PR #83 已合入集成分支；PR #84 在实际代理修复后新增 Cookie/CSRF 与插件兼容负例。最后以 PR head 必需检查为准，不将先前提交的 CI 视作新提交自动通过。

[公网验证运行 41314069131](https://github.com/insanetoto/nuochong-page/actions/runs/41314069131) 成功，运行产品版本 `51ed85e09c3bb56b2aba53156876f194851681a9`：

- 真实公司登录、UTF-8 文件导入、服务器受限 Harness 编译草稿、合成明确审校发布、带当前原文修订引用的真实回答，两个提交的模型任务成功。
- 真实公网 CLI 与 MCP 查询同一发布内容，伪造身份拒绝；独立报告 [public-integrations](../../../apps/control-api/results/knowledge-v0-public-integrations.json)。
- 390px 无横向溢出；已检查工作流桌面与手机截图；官网生产/Worker 测试均 200，原生账号仍可登录。
- 配对私有数据库/对象/版本 SHA 备份实际完成，四项用户服务（数据库、API、Worker、Native）均 active。未进行该备份的跨机恢复演练。
- [公网脱敏报告](../../../apps/control-api/results/knowledge-v0-public.json)不含模型 Key、口令、Cookie、原始私有日志或真实制度。截图留在该工作流 Artifact。

此前失败已修复：工作流并发锁冲突、PG configure 参数、环境文件 URL 引用、验证脚本测试官网地址、Nginx 二次 Cookie path。前几轮在真实模型调用前停止，不能称模型失败或产品验收通过。费用仍 unknown；任务提交次数与供应商实际请求数不同。

这些结果是工程验证，不代替下一轮负责人的产品验收，也不是生产发布。
