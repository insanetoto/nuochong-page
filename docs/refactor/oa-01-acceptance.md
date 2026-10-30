# OA-01整体验收记录

2026-10-30。关联[#32](https://github.com/insanetoto/nuochong-page/issues/32)、[PR #44](https://github.com/insanetoto/nuochong-page/pull/44)。技术与人工整体验收均通过。用户原文：“OA-01 验收通过”。日期2026-10-30。

## 实际部署清单

- 运行环境：Ubuntu24.04.4 x86_64，用户级systemd，Node24.21.0，官方Harness0.2.1-rc.2；独立进程运行，未部署Docker镜像。
- 服务器current实际版本：bbb270a321e44eaaf7e627480086283d066ed87c；test包含后续验证/入口修复的3bd8b99，PR44将这些历史与实现回流集成分支。
- 服务：nuochong-oa-test.service；linger=yes、enabled；内存上限805306368字节（768MiB）、CPU配额1核、TasksMax256，为配置读回，不冒充压力/故障极限测试。
- 状态/工作区：deploy用户的.local/state/nuochong-oa-test；Node/版本目录在.local/share/nuochong-oa-test，官网静态目录独立。
- 入口：https://www.nuochong.net/oa-test/ ，Nginx1.24 TLS前缀代理，后端仅回环127.0.0.1:3080；测试Worker /oa 307跳转，无启动凭据。
- 凭据：原生管理员认证；launch-url文件权限600，启动URL从日志脱敏。用户已明确授权临时传入Actions，验证过程mask、不提交凭据/trace/会话内容。

## AC与证据

| 验收项 | 实测结果/证据 |
| --- | --- |
| 干净安装后真实原生UI可用 | [原生页面CI](https://github.com/insanetoto/nuochong-page/actions/runs/40987341394)，[真实公网验证](https://github.com/insanetoto/nuochong-page/actions/runs/40985687925) |
| 官网与OA隔离 | 实际停止测试服务时，生产官网和测试官网均200、品牌正文存在；原生入口502明确不可用 |
| 无旧mock/业务恢复 | 停止期间7个旧业务入口均404；PR39已有10入口E2E，官网受保护源码/素材/锁文件/像素基线hash保持A-02 |
| 启动/停止/健康检查 | 实际stop→start和单独restart成功；匿名401、认证页面和WebSocket恢复通过 |
| 工作区/状态策略 | 合成工作区文件和真实Harness profile配置在启停、重启后SHA256一致；合成文件已清理 |
| 身份/凭据边界 | 未登录401，登录后去token；Cookie Secure/HttpOnly且Path=/oa-test/；launch-url文件600 |
| 独立版本/部署/运维 | 上述实际版本/限额清单、GitHub SSH部署、一次性bootstrap与停止/回滚操作说明均存在；本PR保留test和集成历史 |

本次完整演练：[Actions 40987264983](https://github.com/insanetoto/nuochong-page/actions/runs/40987264983)，源提交ea144aa；脱敏原始结果：[可用性](evidence/oa-01/oa-01-availability.json)、[部署/持久性](evidence/oa-01/oa-01-runtime.json)、[恢复后公网](evidence/oa-01/oa-01-live.json)。always清理步骤恢复服务并删除合成文件，模型调用0。

## 结论与边界

OA-01技术验收项齐备，PR44已合入集成分支c23e938；合并后构建/E2E通过。用户已明确整体验收，关闭#32，仅将OA-02 #33与OA-04 #35设为Ready，不自动开工。

验证的是服务启停/重启后的工作区与原生配置持久性，不是会话执行中断恢复、数据库灾备或虚拟机重启演练。正式会话/运行状态恢复属于OA-02，故障压力/备份回滚属于OA-05。原生owner仅供测试管理员，员工身份与资源权限属于OA-04。未调用模型，不声称真实模型/CLI/MCP联调通过；main未发布。

## 人工验收

状态：Accepted。2026-10-30用户在本会话明确确认：“OA-01 验收通过”。该确认对应PR44所列整体验收证据。OA-02、OA-04仅Ready、未领取/未实现，其余依赖不变；不批准main发布或自动执行后续开发。
