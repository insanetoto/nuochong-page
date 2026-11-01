# 项目协作约束

## 开始任务

阅读对应GitHub Issue、`docs/refactor/README.md`、适用ADR和任务验收标准。每个任务使用独立分支/工作目录，先确认依赖已验收。不要覆盖其他人的改动。

## 架构与数据

- 官网内容、视觉、URL和SEO保持已批准的A-02基线；修改基线必须独立说明理由并取得产品确认。
- 调用方身份和资源权限来自服务端；模型/客户端不能提权，Harness owner不能直接授予普通OA用户。
- 运行/任务权威状态由服务端持久层负责，Harness事件幂等映射；通过公开Profile/窄适配层集成，不修改上游核心。
- 使用合成测试夹具，不提交密钥、客户原始资料或可识别日志。

## 验证与交付

当前使用npm锁文件。代码改动运行相应构建/测试，明确报告通过、失败、未运行及原因。官网基线说明在`tests/visual/README.md`；macOS截图不能冒充Linux视觉检查。

任务实现、人工验收、合并和发布分别记录。人工验收不得由代理伪造；用户在会话中的明确确认可作为证据回填Issue。

当前main/test推送会部署旧生产/测试系统；重构任务目标为`refactor/integration`（建立后使用）。没有发布授权，不向main/test推送或改变生产配置。

## 审查要点

检查官网基线、权限隔离、任务终态与幂等、失败恢复、凭据脱敏和契约兼容。CODEOWNERS只是审查路由；未启用仓库保护时，不声称CI或审批已经强制阻止合并。

## CLI优先交付

所有新增/变更的产品能力必须提供版本化commandId、输入/输出schema及CLI映射；更新能力清单并验证API/CLI同权和负例。UI、CLI、未来MCP复用业务API/领域服务，不复制授权或状态机，不直连数据库或开放dsh owner接口。写操作的审批/幂等不能被--yes或dry-run绕过。尚未实现的能力显式标记planned，不能mock成功；规范见docs/refactor/cli-native.md。

## 当前产品范围（覆盖旧业务迁移要求）

以DeepSeek Harness为公司OA基座，先保留官方原生Web页面作为OA首页，官网独立。旧业务演示与旧B—E产品路线已撤销，不能按历史盘点自动恢复员工、知识、培训或工单；具体业务以后独立规划。当前任务以docs/refactor/roadmap.md、tasks.md和ADR-010为准，A阶段历史证据保留。

## 2026-11-01 产品规划更新

负责人明确三产品：企业知识库、企业 AI 工具、培训和考试，共用 DeepSeek Harness，业务通过插件扩展。先完成整体规划与知识库详细设计/任务拆分，具体成果见 docs/product/README.md；当前路线以 docs/refactor/roadmap.md 为准，新增业务任务仍 planned，ADR-011 为 Proposed。原生 owner 不向普通员工下放，旧业务演示不自动恢复。演示统一使用服务端公司模型凭据，访客无需 DeepSeek 登录/自带 API Key。用户要求本轮自主形成完整成果，澄清项集中留待下一轮；不得据此伪造人工验收。

部门、人员与角色权限管理按 docs/product/shared-access/design.md 规划为三产品共用插件；产品不能重复维护人员/部门/角色主库，身份验证和最终授权始终由可信核心执行。知识库及共享管理页面主题参考官网，见 docs/product/knowledge/pages.md；本轮不改官网基线。这些共享业务能力仍为 planned。
