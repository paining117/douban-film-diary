# 片刻 · Top250 观影手记

完整的豆瓣 Top250 电影打卡网页，React + Vinext + Cloudflare D1。

## 使用

- 首页按排名展示 250 部电影及本地海报；可按片名/导演/年份搜索，按类型、榜单范围、观看状态筛选。
- 勾选「看过」立即保存；点击电影打开详情，填写可选观看年份或年月、1–10 分个人评分及观影感受。
- 「我的已看」里可取消打卡。取消后保留日期、评分、笔记，但不计入观影统计。
- 统计包括 Top50/Top100/Top250 观影率和本月已看部数。点击「本月观影」弹出本月已看电影小窗，右上角 × 关闭；不改变主页筛选、排序或当前页签。
- 日期支持 `YYYY` 或 `YYYY-MM`，只填年份不计入具体月份。旧的日级日期在读取游客记录、读取当前账号云端记录或导入备份时自动转换为年月；保留评分、笔记和更新时间。
- 想看清单、随机选择未看电影、JSON 导入导出。

## 账号与存储

通过 Sites 的 ChatGPT 账号登录。服务器从平台提供的身份信息取稳定用户 ID，D1 使用 `(user_id, film_id)` 复合主键隔离记录。电影 ID 使用豆瓣 subject ID，后续排名变化不影响记录归属。

生产 API 不提供匿名读写，所有查询和更新均带用户 ID。账号的云端数据不存入 localStorage。切回网页或聚焦窗口时自动刷新，也可在「我的账号」手动刷新。并发编辑同一部电影采用最后一次保存的内容。

网站允许游客免登录访问。游客数据仅在当前浏览器的 localStorage 中保存，清除网站数据将丢失记录；不上传游客记录，也不在退出账号时把云端数据复制到游客模式。游客可导出/导入 JSON 备份。

登录后可以在「我的账号」选择导入游客记录，确认覆盖范围后再合并到云端，不自动覆盖云端已有数据。

## 开发与检查

```sh
npm run install:ci
npm run db:generate
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_colossal_vector.sql
npm run dev
```

Windows 上如系统 npm shim 不能解析路径，可使用 `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" run build`。数据库迁移每个本地数据库只应用一次。

本地 `vinext dev` 登录使用模板提供的测试身份；不会写入线上用户数据。接口验收脚本 `scripts/check-api.mjs` 仅访问固定 localhost:8787，在本地生产 Worker/D1 中检查未登录拒绝、账号隔离、保存/读取、取消已看保留笔记、输入校验和导入失败的原子性。

榜单为 2026-09-24 抓取快照，非实时更新。详情演职员来自豆瓣榜单摘要，可能含省略号；完整详情通过豆瓣链接打开。数据与海报来源说明见 SOURCES.md。
