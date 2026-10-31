# OA临时首页：官方DeepSeek Harness Web

以原生Harness页面作为公司OA第一版首页，不恢复旧员工/培训/工单演示，不修改上游UI或核心。依赖单独锁定于本包，官网构建不加载它。

```sh
# Node24.21.0
npm ci --prefix apps/oa --ignore-scripts --no-audit --no-fund
npm run oa:start
# 指定端口/工作目录，或主动打开浏览器
npm run oa:start -- --port 3080 --workspace /path/to/oa-workspace --open
```

默认监听127.0.0.1，使用apps/oa/.state中的独立DSH_HOME/HOME/临时目录，默认工作目录也在该隔离状态下；.state/.env不进入Git。可用NUOCHONG_OA_HOME指定数据目录。启动器只传递所需环境和显式DEEPSEEK_API_KEY，不继承GitHub/产品CLI凭据。

使用官方 `--profile web`，启动URL进行原生认证cookie交换，随后去除URL中的启动token。终端URL是管理员临时凭据，不写入公开首页、报告或版本库；不要把带token的URL设置为NUOCHONG_OA_URL。

模型配置由管理员通过原生Settings或服务端环境完成；未配置模型时页面仍可打开，但不能宣称已完成模型对话。页面冒烟使用全新临时状态，不继承实验密钥，不发送提示词。

## 官网与OA地址

- 公开官网 `/` 保持原内容；不在原首页加新的浮动入口或业务面板。
- Worker的 `/oa` 只按服务端NUOCHONG_OA_URL跳转，无配置503；HTTPS或本机回环HTTP、无内嵌凭据/query/hash，不接受访客参数覆盖。
- 原生页面独立于Worker/静态托管。公网/公司访问需要真实服务地址、身份边界及入口配置；当前启动器不发布公网，也不代替生产部署。

## 当前权限边界

这是本机管理员的原生预览。上游页面有模型/插件/工具等owner管理能力，不能直接向所有员工复制该权限。OA-04在正式员工访问前实现公司身份、资源归属和管理员边界；具体业务以后规划。

保留上游会话/运行/模型/工具原生能力，不包装成已建成的多用户OA。后续CLI/MCP通过受控OA能力接入，不能用通用shell接口绕过授权。

## 验证

```sh
node apps/oa/verify-home.mjs
```

测试真实官方Web启动、私有URL换cookie后去token、标题/根组件/按钮渲染及页面异常，保存脱敏JSON和新鲜空工作区截图到outputs。截图不是修改官网原像素基线。Node/浏览器/平台记录在报告；测试结束清理进程与临时状态。

## 服务器测试部署

现有腾讯云连接与HTTPS服务准备见[部署手册](deploy/README.md)。`--public-url`或NUOCHONG_OA_PUBLIC_URL只配置官方公开URL和可信authority，监听仍为回环；反向代理负责前缀、TLS、Cookie和WebSocket。测试环境准备与真实上线分别记录，首次管理员初始化完成前不宣称公网原生页面已可用。
