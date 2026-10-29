# A-04 Harness 运行版本验证

候选固定版本：`@deepseek-ai/dsh` 与 `@deepseek-ai/dsh-sdk-client` 均为 `0.2.1-rc.2`；完整传递依赖由本目录package-lock.json锁定。目录与官网依赖独立，不修改根package.json/锁文件。

## 复现

仓库根目录执行：

```bash
npm ci --prefix experiments/phase-a/runtime --no-audit --no-fund
node experiments/phase-a/runtime/verify-runtime.mjs
node experiments/phase-a/runtime/verify-sdk.mjs
```

验证环境为macOS arm64、Node v24.21.0、npm11.19.0；两个直接发布包未声明engines，不代表任意Node版本兼容。官网当前Node22构建不等于Host可沿用Node22；Host暂以已实测Node24环境为候选，其他环境需单独验证。

所有运行使用独立DSH_HOME，SDK子进程只继承PATH/语言/终端类型白名单，不读取个人Harness配置或继承GitHub/模型凭据。`node_modules/`、`.dsh-home/`、`outputs/`和`.env*`忽略，不进入提交。

## 验证范围

1. verify-runtime：真实官方CLI分别解析sdk/sdk-minimal具名Profile；记录退出码、配置字节数和哈希，不保存原始配置。
2. verify-sdk：官方SDK分别启动两个Profile的真实子进程，完成initialize并close；没有prompt或工具执行。
3. 执行npm ci后重复以上两项，确认锁文件可干净安装。结果记录在outputs，审查用脱敏结果复制到results。

锁定SDK默认provider为`deepseek-official`，model为`deepseek-v4-flash`，从所安装版本类型声明与实际默认初始化核实。A-06再验证真实调用；不使用未发布的臆测包名`@deepseek-ai/dsh-sdk`。

## 限制与异常

- 首轮安装出现registry空闲超时；使用缓存、降低maxsockets后成功。网络重试不改变依赖版本。
- npm11提示若干依赖的安装脚本未批准；本次初始化成功，不代表PTY、原生工具或Office等运行能力可用。A-06只读工具原型应逐项验证所需脚本和能力，不批量默认启用。
- 初始化不是模型推理、流式回答、工具权限、故障恢复或生产就绪测试。没有模型请求，也没有模型费用。
- 未修改上游核心；正式架构选择在ADR-004及A-05冻结，不能以本原型直接替代B阶段Host。

## 升级

升级CLI与SDK必须同版本，在独立PR中修改本目录依赖和锁文件，重做干净安装、Profile和SDK启停，再由A-06契约/执行测试确认。上游master与npm发布可能不同，研究文档不能覆盖锁定产物实测结论。

## 依据

- 官方发布包的package.json/LICENSE、SDK类型声明与实际运行结果。
- [官方SDK说明](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sdk/client/README.md)（滚动文档，仅作解释；实际接口以本目录锁定产物为准）。
