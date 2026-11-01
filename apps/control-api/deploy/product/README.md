# 隔离知识库测试运行

入口：`https://www.nuochong.net/oa-test/product/`。公司测试账号由操作者授权的一次性 Secret 初始化（登录账号沿用已指定演示账号）；不会为访客公开 owner 能力或模型 Key。普通 CI 不需要模型凭据。手动派发 `oa-server-prepare.yml`，`target=knowledge`，使用已有部署 SSH Secrets；工作流不会发布 main 或官网。

服务：用户级 `nuochong-knowledge-db/api/worker.service`；数据库仅回环 55437，实际应用使用私有 Unix socket，TCP 未设可用口令；API 仅回环 3081，Native 网关仅将 `/product/` 代理给它。原生会话不转换为公司身份。公网前缀仍由既有 Nginx 提供，无新增 root 配置。该代理会改写 Cookie path，因此服务端显式设置 `PRODUCT_COOKIE_PATH=/product/`，公网最终路径为 `/oa-test/product/`；公网继承 Nginx 的 Secure/HttpOnly/SameSite=Lax，写请求仍强制同源 Origin，不能靠 Cookie 绕过 CSRF。官网内容未改。

代码：`~/.local/share/nuochong-knowledge-test/releases/<sha>`、原子 `current`，PostgreSQL 17.11 独立运行时；数据/对象/模型环境：`~/.local/state/nuochong-knowledge-test`，仅 deploy 可读。Worker 从既有服务器私有模型配置取 Key，不将 Key 传到 Actions。Linux 24.04 编译 PG 运行时与服务器同平台；不依赖服务器 sudo 或 Docker。

本轮在已有 Native release 的两个网关文件上增加独立前缀代理，原文件备份在知识库 state。后续重新发布 Native 时须同步该提交的 gateway/service 文件并保留 systemd drop-in；否则产品入口会退回 Native。应在下一轮整合到同一版本化发布包。

运行检查：`systemctl --user is-active nuochong-knowledge-{db,api,worker}.service`。日志默认仅启动信息，勿复制模型原始输出；API、Worker、数据库异常先检查用户服务与磁盘，再查最小错误码。

配对备份：`bash <current>/apps/control-api/deploy/product/backup.sh`；先停止 API/Worker，保持数据库可用，备份 schema 与对象、版本 SHA、校验和，再恢复服务。私有 `backups/` 目录不上传 CI。恢复须停写，校验 SHA256，用 `pg_restore` 恢复到独立新数据库/新实例并复制匹配对象后验证；不得直接覆盖正在运行的数据库。初版尚未实现一键恢复/自动定时备份，需下一轮演练。

代码回退：停 API/Worker，将 current 切回 state/previous-release 指向的已验证 release 后重启；数据库迁移为追加校验，先确认旧代码兼容现 schema，不能自动回退 schema。若要移除入口，删除 `nuochong-oa-test.service.d/knowledge.conf`，还原 state 内 gateway/service 备份，daemon-reload 后重启 Native；停知识库服务，保留数据以供恢复，不删除数据库目录。

CLI：`NUOCHONG_API_URL=https://www.nuochong.net NUOCHONG_API_PREFIX=/oa-test`，先通过 `identity login --input -` 获得个人受限 Bearer，后续设置 `NUOCHONG_ACCESS_TOKEN`。密码 JSON 用 stdin，勿写入 shell 历史。MCP 使用同样配置，仅显式启用实际实现命令。公司身份不能用于原生 Harness owner 管理。

测试数据仅有标为“合成演示制度”的样本，不能当作公司正式制度。`verify-live.mjs` 真实执行两项模型任务，明确用授权演示身份做工程审校，不代表负责人产品验收。无 API Key 表单。

公网仅代理知识库 `/product/` 路径；22 项基座 API 不通过该路径开放。外部 MCP 请显式配置知识库命令白名单，不将原生 Web 作为 API。`verify-knowledge-live.mjs` 在真实公网验证 API/CLI/MCP 同一发布内容和身份伪造拒绝，不调用模型。
