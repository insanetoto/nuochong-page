# 受限 OA MCP 适配器

OA-03：通过官方 MCP SDK 的 stdio 连接调用已有的控制 API。工具的输入/输出 schema 和 commandId 源于 CLI 清单；身份、资源权限、幂等和运行状态仍由 API 判定。管理员身份/配置写入、原生 owner 管理面、任意命令均不暴露。默认只开放只读工具；操作者可用 `NUOCHONG_MCP_COMMANDS` 逗号分隔明确指定允许的能力，写操作仍受服务端权限、幂等约束。运行流式事件暂由 CLI `runs events` 提供，MCP 不将其伪装为已实现。

需要完整仓库、Node 22.13+ 和已部署或隔离运行的控制 API：

```sh
npm ci --prefix apps/control-api --ignore-scripts
npm ci --prefix tools/nuochong-mcp --ignore-scripts
# 设置 NUOCHONG_API_URL 和受限主体的 NUOCHONG_ACCESS_TOKEN，勿将令牌写入命令行参数
node tools/nuochong-mcp/src/server.mjs
```

客户端启动上述命令并通过环境提供凭据，进程 stdout 专供 MCP 协议；远程 API 必须 HTTPS，本机测试可使用 loopback HTTP。默认工具清单不承诺当前凭据拥有所有权限，实际调用以 API 返回为准。超时或取消仅停止跟随，不假称远端操作已撤销；写入不自动重试。

## 验证

```sh
TEST_DATABASE_URL=... npm test --prefix tools/nuochong-mcp
# 仅本机显式执行，DeepSeek 密钥和模型调用不传入 CI
TEST_DATABASE_URL=... DEEPSEEK_API_KEY=... node tools/nuochong-mcp/test/verify-deepseek.mjs
```

本机真实 DeepSeek `deepseek-flash` 已经调用 `auth.me` 和 `models.list`，通过 MCP stdio、真实控制 API 与隔离 PostgreSQL 返回；模型调用费用未知。CI 使用真实隔离 PostgreSQL，模型请求不在 CI 执行。测试使用合成身份，无公司私有数据。DeepSeek 直连示例是测试用的最小 MCP host，不代表已交付完整通用 AI 客户端或发布外部服务。
