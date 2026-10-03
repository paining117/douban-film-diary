# 片刻 · Top250 观影手记

一个支持游客模式和账号云端同步的豆瓣 Top250 电影打卡网页。

**在线使用：[打开片刻](https://screen-diary-250.gatsbyleonardo117.chatgpt.site)**

## 功能

- 按排名展示 250 部电影、海报、年份、地区、类型、豆瓣评分和详情链接。
- 一键标记「已看」，观看日期为空时自动填入勾选时的当前年月；已有日期保留，仍可修改或清空。可选填写 1–10 分个人评分和观影感受。
- 已看页面支持取消打卡；原有日期、评分和笔记保留，但不计入统计。
- 首页展示 Top50 / Top100 / Top250 观影进度；点击「本月观影」弹出当月已看影片小窗，点击右上角 × 关闭，不影响主页筛选和排序。
- 搜索片名、导演和年份；按榜单范围、电影类型、观看状态筛选和排序。
- 想看清单、随机选择未看电影、JSON 备份导出与导入。
- 游客免登录使用，记录保存在当前浏览器。
- 同一 ChatGPT 账号的记录保存在云端，可跨设备使用；不同账号的数据相互隔离。
- 登录后可确认导入当前浏览器的游客记录，不会自动覆盖云端已有记录。

日期支持只填年份（如 2024）或年月（如 2024-06），只填年份不计入具体月份。旧日级日期在读取记录或导入备份时自动转换为年月，评分、笔记和更新时间保留。

采用深色影院底色、柔和绿色控件和电影手账排版，统一首页、观影记录及本月已看弹窗的外观；海报上的「已看」标识使用实心墨绿底、暖白文字和清晰边框。

## 技术栈

React 19、TypeScript、Vinext / Vite、Tailwind CSS、Radix UI / shadcn、Cloudflare Workers / D1、Drizzle 数据库迁移。

## 本地开发

需要 Node.js **22.13.0 或更高版本**和 npm。

```sh
git clone https://github.com/paining117/douban-film-diary.git
cd douban-film-diary
npm run install:ci
npm run build
```

首次创建本地测试数据库时应用已提交的迁移（同一个数据库只执行一次）：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_colossal_vector.sql
npm run dev
```

打开终端显示的本地地址，默认 `http://127.0.0.1:5173/`。本地登录为开发测试身份，不会访问线上用户记录。

## 检查

```sh
npx tsc --noEmit
node scripts/check-guest.mjs
node scripts/check-watch-dates.mjs
npm run build
```

本地 API 测试需要先在固定端口启动构建后的 Worker，并已应用本地数据库迁移：

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js dev --config dist/server/wrangler.json --local --persist-to .wrangler/state --ip 127.0.0.1 --port 8787 --inspector-port 0
```

在另一个终端中安装 Python `requests` 后运行 `python scripts/check_api.py`。测试只访问 localhost，并使用临时测试用户；不会写入线上数据库。运行 Worker 时不要同时重新构建，以免本地服务重载中断请求。

## 目录

| 目录 | 内容 |
| --- | --- |
| `app/` | 页面、交互和观影记录 API |
| `lib/` | 记录校验、游客存储 |
| `db/`、`drizzle/` | D1 模型、访问辅助函数和迁移 |
| `public/movies.json`、`public/posters/` | 电影快照和 250 张海报 |
| `data-provenance/` | 电影数量、来源及海报完整性校验记录 |
| `scripts/` | 开发、构建、素材采集和验证脚本 |

## 部署与数据

GitHub 公开版本没有在线站点的部署标识、用户记录或登录凭据。本机开发分支保留 Sites 部署配置，通过独立公开分支发布源码。云端账号登录依赖 Sites 提供的认证，迁移到其他托管平台需要接入可信的服务端认证，不能直接信任客户端提交的身份请求头。具体说明见 [PUBLISHING.md](PUBLISHING.md)。

榜单来自 [豆瓣电影 Top250](https://movie.douban.com/top250)，采集日期为 **2026-09-24**，不是实时排名。详细来源和校验信息见 [SOURCES.md](SOURCES.md)。

电影海报版权归原权利人，本项目不代表豆瓣官方。第三方组件和构建代码保留其原有许可声明；仓库公开不意味着海报或第三方素材获得额外再授权。
