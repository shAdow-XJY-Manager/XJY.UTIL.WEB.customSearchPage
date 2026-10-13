# 搜索目录与来源

2026-10-12 整理。内置 35 项：21 个网页搜索入口（含地区版本及 AI 搜索）、8 个知识／技术入口、4 个视频／社区入口、2 个购物入口；不是 35 个独立通用搜索引擎。运行数据在 `native/engines.js`，无联盟分成、厂商推广或追踪参数。

| 分组 | 内置项 |
| --- | --- |
| 网页 | Bing、Google、百度、DuckDuckGo、Brave Search、Startpage、Qwant、Ecosia、Yahoo、Yahoo! JAPAN、Yandex、搜狗、360 搜索、Naver、Daum、Seznam、Cốc Cốc、Mojeek、Swisscows、Kagi、Perplexity |
| 知识与技术 | 中文／英文维基百科、GitHub、Stack Overflow、MDN、Google 学术、PubMed、arXiv |
| 视频与社区 | YouTube、哔哩哔哩、知乎、豆瓣电影 |
| 购物 | Amazon、eBay |

## 核对依据

- [Mozilla 的浏览器搜索配置](https://github.com/mozilla/gecko-dev/blob/master/services/settings/dumps/main/search-config-v2.json)：参考 Bing、Google、百度、DuckDuckGo、Ecosia、Qwant、Yahoo! JAPAN、Naver、Daum、Seznam、Cốc Cốc、Perplexity、维基百科、YouTube、Amazon、eBay 的公开搜索网址和参数。该仓库配置是参考快照，不是实时可用性承诺。百度保留项目已有 `/s?wd=`，eBay 使用其公开 `_nkw` 查询入口；删除浏览器合作和联盟参数。
- [Brave 官方配置说明](https://support.brave.com/hc/en-us/articles/4403568397837-Brave-Search-FAQ)、[Startpage 搜索字符串](https://support.startpage.com/hc/en-us/articles/4520913488148-Search-strings)、[Kagi 默认引擎说明](https://help.kagi.com/kagi/getting-started/setting-default.html)、[Mojeek 官方 Chrome 设置说明](https://www.mojeek.com/support/browsers/chrome.html)：直接核对 URL 模板。
- [搜狗首页](https://www.sogou.com/)、[360 首页](https://www.so.com/)、[Swisscows 网页搜索](https://swisscows.com/en/web)：读取官方 HTML 的表单 action 和查询字段。
- [Yahoo 搜索](https://search.yahoo.com/search?p=browser)、[Yandex 搜索](https://yandex.com/search/?text=browser)：检查公开查询入口；此环境分别遇到访问限制和验证码，未绕过。
- 站内搜索参考各站公开入口：[GitHub](https://github.com/search?q=browser)、[Stack Overflow](https://stackoverflow.com/search?q=browser)、[MDN](https://developer.mozilla.org/zh-CN/search?q=browser)、[Google 学术](https://scholar.google.com/scholar?q=browser)、[PubMed](https://pubmed.ncbi.nlm.nih.gov/?term=browser)、[arXiv](https://arxiv.org/search/?query=browser&searchtype=all)、[哔哩哔哩](https://search.bilibili.com/all?keyword=browser)、[知乎](https://www.zhihu.com/search?type=content&q=browser)、[豆瓣电影](https://search.douban.com/movie/subject_search?search_text=browser)。部分站点有登录／访问限制，未绕过。

单元测试覆盖全部模板的中文、Emoji、空格和保留字符编码；浏览器集成拦截导航验证查询与打开方式。未宣称所有服务在所有网络、地区和登录状态下都可用。Kagi 需账号，服务可能收费；AI 搜索、地区入口和站内搜索的结果范围由对应网站决定。

## 自定义

设置 → 搜索 → 自定义搜索引擎，添加名称和包含一个 `%s` 或 `{query}` 的 HTTP／HTTPS URL。查询词会整体编码后替换，可用于查询参数或路径；不接受脚本网址、文件网址、嵌入凭据或主机名占位符。可编辑／删除自定义项；删除当前选中的自定义项时回到 Bing。内置项随本地版本更新，不从远端下载配置。
