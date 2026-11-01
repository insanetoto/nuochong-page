# 公司模型演示交付记录

2026-11-01 · DEMO-01 · 已实施，人工验收留待下一轮。

用户要求登录后不再弹 DeepSeek 登录或个人 API Key 页面，使用公司服务端凭据演示。本轮通过官方 Profile 和官方私有凭据文档配置，不改上游核心：关闭账号、模型/搜索 Key 及插件安装界面，禁用非公司模型 provider，保留 DeepSeek 官方模型。凭据不进入源码、官网和浏览器。

实现 PR：https://github.com/insanetoto/nuochong-page/pull/70 。管理员配置工具与工作流操作见 apps/oa/deploy/README.md。

## 实际检查

- 5 项配置/账号网关测试通过；独立状态的真实 Harness 无引导检查通过。
- 用户指定测试账号从正式官网登录，在实际管理员测试服务上无模型登录/Key 对话框。
- 通过官方界面注册服务器已有隔离 workspace，解决 Linux 没有默认工作区时编辑器锁定的问题；未直接修改内部数据库。
- 实际账号登录后发送合成提示，收到精确的 `DEMO_MODEL_READY` 回答；编辑器可用、对话框 0。
- DeepSeek 官方模型目录接口鉴权返回 200，不输出 Key。
- [最终公网完整验证](https://github.com/insanetoto/nuochong-page/actions/runs/41290916955)通过：managedDemoNoOnboarding=true、真实模型回复、HTTPS Cookie、认证 WebSocket、官网表单/跳转及页面异常 0。
- Linux 独立浏览器首次初始化、编辑器可用性及完整必需 CI 门禁通过；配置显式指定隔离工作区目录，避免依赖操作系统 Documents 目录。早期失败保留，不冒充一次通过。
- 临时 OA_DEMO_API_KEY Secret 已删除，核对仓库只剩原部署 Secrets；公司模型凭据保留在服务器官方私有存储。
- 上述早期报告 modelCalls=1 表示一次合成提示的测试路径，未测量自动标题等底层请求次数；当前脚本已分离 modelSmokePrompts 与 modelCalls=not-measured，模型费用仍未测量。

## 边界

此配置针对现有原生管理员演示。原生 owner 和同 OS 用户不是员工权限沙箱；员工产品壳、业务插件、SSO 和受控外部集成仍按新任务计划交付。知识库原型没有调用模型；上述真实模型测试仅验证演示基座，不代表企业知识库问答已实现。
