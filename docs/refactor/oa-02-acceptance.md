# OA-02 核心运行与会话验收

2026-10-30；Issue #33。技术实现/验证已完成，整体人工验收待负责人确认。实现位于apps/control-api；访问策略基础与OA-04共享，OA-04的完整角色/撤权验收单独记录。

| 任务要求 | 实现与实测 |
| --- | --- |
| 官方SDK/公开协议适配 | dsh-sdk-client0.2.1-rc.2、公开resumeSession与Hook/JSON-RPC流桥；未修改上游核心 |
| 正式运行API | create/get/cancel/events，创建幂等、取消确认与终态区分、持久事件cursor、瞬态token无cursor；与CLI同契约 |
| 会话与历史 | 按服务端主体归属隔离，创建/列表/get/history；数据库精确时间/id游标，不重复遗漏；单history页5项避免超CLI响应限额 |
| 模型/工具配置 | 固定已验收deepseek-official/deepseek-v4-flash、CAS版本化配置；仅只读current_time可开关，无任意URL/密钥/插件写入接口 |
| 权威状态与恢复 | PostgreSQL17.11，独立API/Worker，租约+会话锁+fencing；实际API进程重启保留运行，实际Worker强杀后未知dispatch停重试 |
| 正确终态 | 根session completed且SDK清理确认才成功；idle、子会话完成、耗尽、错误、清理失败不能冒充成功 |
| 取消/断连/重启 | 合成取消/超时/租约/断流游标验证；真实模型首token后取消，后续新Host恢复中断会话成功 |
| 默认只读与副作用 | 无文件/目录/shell工具，只有可选只读clock；dispatch前写入意图，结果未知不自动重放；过期/旧lease无法结算 |

## 证据

本机darwin/Node24.21.0使用临时编译的真实PostgreSQL17.11，身份/HTTP/CLI/状态/恢复测试19项通过，既有CLI协议18项和独立离线安装包通过；实际受限SDK启动/关闭通过、0次模型调用。

真实默认模型单独验证，见[darwin-real-model.json](../../apps/control-api/results/darwin-real-model.json)：5个提交轮次，真实只读工具审计、不同SDK进程的会话恢复、真实流式取消、中断会话恢复、token经PostgreSQL进入正式SSE均通过。provider HTTP请求数未逐一计量（工具续调用可能更多），费用金额unknown；没有把合成故障或0凭据CI当成真实模型。

Linux CI使用隔离PostgreSQL17.11服务，分别运行正式HTTP/CLI/Worker故障与真实无模型SDK启动；具体最终运行链接回填PR，不读取/传输本机DeepSeek密钥。

## 使用与发布边界

API/Worker只监听本机控制面，使用专用数据库、主体与运行home，不共享Native Web owner会话。迁移/管理员初始化/服务单元/部署边界详见[控制API手册](../../apps/control-api/README.md)，决策见[ADR-011](../adr/ADR-011-oa-control-and-access.md)。

本次完成代码与隔离真实环境验收，未新增公网控制API或改动现有Native测试入口、main/test及生产Nginx；公网推广仍须实际数据库、入口与服务凭据配置。MCP/真实外部AI集成属于OA-03，压力/灾备属于OA-05，不列为已完成。

整体人工验收：待负责人明确确认；不提前关闭#33或解锁OA-03。
