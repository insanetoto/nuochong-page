# 现有腾讯云服务器上的 Harness 测试服务

复用GitHub的DEPLOY_HOST/DEPLOY_SSH_KEY，以deploy用户连接；不导出密钥。官网test仍为Cloudflare Worker，原生Harness运行于现有Ubuntu服务器的独立目录。暂采用已有证书覆盖的 https://www.nuochong.net/oa-test/，不修改官网文案/静态目录，也不新增DNS记录。

## 已核实的环境与权限

2026-10-29通过Actions只读验证：Ubuntu24.04.4/x86_64、约2GB内存、Nginx1.24，无Node/Docker；deploy可写自己的home和官网静态目录，不能写/etc/nginx或管理系统服务，sudo需要密码。现有Cloudflare凭据可读Tunnel列表，但Workers VPC目录返回403，且账户没有nuochong.net DNS Zone，不能据此假称已有私有入口。

因此使用独立Node24.21.0与锁定Harness0.2.1-rc.2，首次需管理员初始化HTTPS路由和用户后台服务；日常更新由GitHub继续完成。不需要为deploy长期开放全部sudo。

## 自动准备与更新

`.github/workflows/oa-server-prepare.yml`在Linux干净安装，并用真实Nginx、HTTPS和/oa-test/前缀检查官方页面、认证cookie及WebSocket。通过后打包Node二进制、锁定依赖与自有启动器，SSH上传至：

- 版本：`/home/deploy/.local/share/nuochong-oa-test/releases/<SHA>`
- 当前版本：`/home/deploy/.local/share/nuochong-oa-test/current`（原子切换）
- 状态与会话：`/home/deploy/.local/state/nuochong-oa-test`（权限0700，更新不覆盖）
- 用户单元：`/home/deploy/.config/systemd/user/nuochong-oa-test.service`

服务只监听127.0.0.1:3080，Nginx移除URL前缀，转发WebSocket且不缓冲流；Cookie限定/oa-test/、Secure/HttpOnly/SameSite，启动token不进入Nginx访问日志或Actions报告。systemd限制768MB、1核CPU配额和256任务，异常自动重启。启动URL仅存于服务器私有launch-url文件，日志中的URL会被脱敏。

## 一次性管理员初始化

确认GitHub准备任务成功后，在服务器上由管理员执行（可先阅读脚本）：

```bash
sudo bash /home/deploy/.local/share/nuochong-oa-test/current/apps/oa/deploy/bootstrap-root.sh
```

脚本校验既有Nginx配置，备份`/etc/nginx/sites-available/nuochong`，仅向唯一的www HTTPS server加入独立测试location；`nginx -t`失败则恢复原文件。随后启用deploy用户linger，加载并启动独立用户服务。不会授予deploy无限sudo或重发官网生产构建。若服务器路由不符合已验证的布局，脚本明确停止，不猜测改写其他vhost。

## 管理员进入页面与模型配置

```bash
# 以deploy登录服务器后执行，不把输出粘贴到公开日志/Issue
cat ~/.local/state/nuochong-oa-test/launch-url
systemctl --user status nuochong-oa-test.service
```

打开该私有URL，原生认证交换Cookie后会移除query。该入口是测试管理员owner，不是全员OA身份方案；OA-04仍需实现员工授权。模型可由管理员在原生Settings中配置，或仅在服务器私有`model.env`写入DEEPSEEK_API_KEY并chmod600后重启用户服务；不从历史实验文件自动复制凭据。

## 验证、停止与回滚

```bash
systemctl --user is-active nuochong-oa-test.service
systemctl --user stop nuochong-oa-test.service
systemctl --user start nuochong-oa-test.service
```

上线必须检查：HTTPS页面与真实WebSocket、Cookie作用域、未授权请求拒绝、重启后新启动凭据/状态保留、官网与原业务404、测试Worker的/oa跳转。无模型凭据时不声称真实对话通过。

回滚：停止用户服务，将current原子切换到已核验的上一版本目录再启动；保留状态目录，不用代码回滚代替数据恢复。删除服务时先禁用用户单元，再由管理员撤销测试location并nginx -t/reload；不要删除官网静态目录或证书。

运行环境准备、管理员初始化、真实公网验收分别登记；Actions准备成功不等于已上线。

增量传输使用SSH内的rsync校验和检查与上一版本link-dest，复用内容相同的依赖文件；不在既有版本文件上inplace写入。当前symlink切换后，既有运行进程保持旧版本直至用户服务重启；保留旧版本供回滚。
