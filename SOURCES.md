# 豆瓣 Top250 数据与素材来源

- 来源：https://movie.douban.com/top250
- 抓取时间：2026-09-24T02:11:21.969164+00:00（北京时间 2026-09-24 10:11）
- 范围：每页 25 条，start=0、25、50、75、100、125、150、175、200、225，共 10 页。
- 实测结果：250 条电影；250 个唯一 subject id；排名按 1–250 连续排列；所有约定必需字段非空。
- 榜单是抓取时点快照，排名、评分及评分人数后续可能变化。

## 文件

- `movies.json`：顶层 `{ source: string, fetchedAt: string, movies: Movie[] }`。
- `source-pages/`：10 个原始榜单页面的 HTML 快照。
- `source-pages.json`：页面 URL、快照路径、响应内容摘要及实测条目数。
- `poster-validation.json`：250 个海报的原始 URL、本地路径、图像尺寸、JPEG 格式、字节数和 SHA-256 摘要。
- `poster-initial-attempt.json`：首次未携带来源 Referer 的请求记录，保留便于追溯。
- `validation.json`：榜单数量、ID 唯一性、排名连续性及海报实际结果。
- `fetch_assets.py`：获取和校验脚本；后续运行遇到访问限制会停止继续请求图片，不自动重试。

## Movie 字段

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| id | string | 豆瓣 subject id |
| rank | number | 页面显示的排名 |
| title | string | 页面主要片名 |
| originalTitle | string | 第二个标题字段；该字段缺省时沿用页面主要片名 |
| year | string | 页面显示的年份文本 |
| countries | string | 页面显示的国家或地区文本 |
| genres | string[] | 页面显示的类型 |
| credits | string | 页面导演/主演信息，保留原始省略号 |
| rating | number | 页面显示的评分 |
| ratingCount | number | 页面显示的评分人数 |
| poster | string | 预期站点路径 `/posters/{id}.jpg`，仅在 posterAvailable=true 时可作为本地图片使用 |
| posterAvailable | boolean | 是否成功下载并通过 Pillow 完整性/解码检查 |
| posterUrl | string | 页面上原样提取的真实远端海报 URL |
| url | string | 豆瓣电影详情链接 |

额外保留 `otherTitles`、`metadata`、`metadataLines`、`regions`、`quote`、`posterPath`、`doubanUrl`、`sourcePage` 方便追溯。`credits` 来自榜单摘要，部分内容被原网站截断，不能当作完整演职员表。

## 海报结果

250 个真实海报 URL 均已从对应电影的榜单条目提取。最终成功下载和校验 **250 张 JPEG 海报**，全部 `posterAvailable=true`。每张图片都通过 Pillow `verify()` 和完整像素解码检查；记录尺寸、字节数和 SHA-256 摘要。另目视核对《肖申克的救赎》《霸王别姬》《千与千寻》三张图片，均为对应电影海报。

初次请求只携带简略 `User-Agent: Mozilla/5.0`、未携带来源 Referer，图片均返回 HTTP 418。随后按照任务要求，先进行一次正常浏览器来源诊断，获得 HTTP 200 和有效 JPEG；再使用同一正常来源请求头完成 250 张图片下载。请求使用原始域名、原始 URL，未改写地址，未使用代理轮换或其它反限制方式。最终请求头：`User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36`；`Referer: https://movie.douban.com/top250`。下载脚本遇到 401、403、418、429 时会停止后续图片请求。

海报和电影相关素材版权属于原权利人；这些链接和事实数据用于电影信息展示及来源归属，不代表获得素材所有权或额外授权。
