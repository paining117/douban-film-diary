# 部署与数据边界

GitHub 上的本仓库是「片刻」网页的公开源码，不包含在线站点的部署标识、访问凭据、用户观影记录或本地测试数据库。本机只维护一个 `douban-film-diary` 工作目录，开发分支保留原站点部署配置。

## 一个目录，两个发布用途

- `main`：日常开发与 Sites 部署，保留原有开发历史和本机 `.openai/hosting.json` 的站点标识。
- `github-public`：GitHub 公开源码历史，延续原 GitHub 仓库提交；不合并开发分支的私有历史。
- `github`：指向原 GitHub 仓库的 remote，默认只把 `github-public` 推送到远端 `main`。

在 `main` 修改并提交后，从项目根目录执行：

```sh
node scripts/prepare-github.mjs --check
node scripts/prepare-github.mjs --write
git diff github/main..github-public --stat
git push github github-public:main
```

前两条命令完全在本机运行，不部署、不联网推送。脚本只导出已提交的源码，用临时 Git 索引移除部署标识，不修改工作目录的部署配置；公开提交只以此前的公开提交为父提交。`--check` 只检查待导出的树，`--write` 更新本机公开分支。最后一条命令才会发布到 GitHub，应在明确要发布时执行；若远端有新提交，先检查并处理分歧，不要强制推送。

本机已安装 `scripts/guard-public-push.sh` 作为 `.git/hooks/pre-push`，阻止将开发分支或包含私有开发历史的提交推到这个 GitHub 仓库。新克隆不会自动安装 Git 钩子。GitHub 发布和 Sites 部署仍是两个独立操作。

本次目录整合未重新部署网站，也未推送 GitHub。原两份仓库的 Git bundle 备份保存在工作区 `Codex/整理记录/2026-10-01/`。

## Sites 部署

公开分支的 `.openai/hosting.json` 保留逻辑 D1 绑定 `DB`，不包含现有网站的 `project_id`；本机开发分支保留该标识。部署为自己的 Sites 网站时，应注册自己的项目、写入新的项目标识，再使用 Sites 发布流程构建与部署。生产迁移位于 `drizzle/`。

## 身份验证

线上登录依赖 Sites 提供的 ChatGPT 登录路由和经过平台验证的 `oai-authenticated-user-id` 请求头。API 按此用户 ID 隔离 D1 记录。

移植到其他托管平台时，必须先实现可靠的服务端认证，并剔除客户端自行提交的身份请求头；不能把未经认证的同名请求头直接当成用户身份。当前源码不是一个自带邮箱密码注册系统。

本地开发登录使用模板的测试身份，仅用于本机预览，不代表真实 ChatGPT 认证。`check_api.py` 中自行设置的身份请求头也仅用于固定本机地址的接口测试。

## 记录模式

- 游客：仅在当前浏览器的 localStorage 保存；清除网站数据会丢失记录。
- 登录：保存在 D1，按账号隔离，同一账号可跨设备读取。
- 游客记录只在用户确认导入后合并到云端，不在登录时自动上传。
- 退出登录不会将账号云端记录复制到游客记录。

## 校验范围

原站点已经完成生产构建、TypeScript 检查、游客存储逻辑检查，以及本地数据库的核心读写、用户隔离和导入保护检查。连续本地接口测试曾遇到模拟运行时等待和重启，因此不宣称整个接口脚本一次全部通过。

浏览器视觉验收、真实手机交互与两台真实设备的登录同步验收尚未完成。
