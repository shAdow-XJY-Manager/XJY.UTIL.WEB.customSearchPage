# 极简新标签页

网站与 Chrome／Microsoft Edge 扩展共用的原生网页。主页面只有搜索框和右上角设置入口；使用系统字体，默认纯色背景，不包含字体包、内置壁纸、Flutter 或 WASM 运行资源。

## 运行与构建

需要 Node.js 22.12+ 和系统 `zip` 命令。

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
npm run build
npm test
npm run check:size

# 单独构建网站或扩展
npm run build -- web
npm run build -- extension

# 网站部署到根目录或其他子路径
npm run build -- web --base-href=/
```

- 网站产物：`build/web/`，默认部署路径 `/XJY.UTIL.WEB.customSearchPage/`。
- 扩展目录：`build/extension/`。
- 扩展 ZIP：`build/releases/frequency-search-1.2.0.zip`，版本以 `package.json` 为准。
- 体积报告：`build/releases/size-report.json`。构建强制 ZIP ≤200 KiB、解压资源 ≤400 KiB，并拒绝字体、WASM、Flutter 资源和额外浏览器权限。
- 当前版本压缩包约 81 KiB，解压资源约 105 KiB；开发工具和旧 Flutter 源码均不进入交付包。
- 已有 Dart 环境仍可使用 `dart run tool/build.dart [all|web|extension] [--base-href=/path/]`，该入口转交 Node 构建。

`native/` 是当前运行实现，`lib/`、旧 `web/` 和 Dart 测试保留作历史参考。生产构建不使用 Flutter SDK。现有 Pages 发布可将网站产物复制到 `docs/`，保留 `.nojekyll`；本轮不会自动覆盖或发布 `docs/`。

## 安装与更新扩展

1. 解压 ZIP 到长期保留的目录，或直接使用 `build/extension/`。
2. Chrome 打开 `chrome://extensions`；Edge 打开 `edge://extensions`。
3. 开启「开发者模式」，选择「加载已解压的扩展」，选中含 `manifest.json` 的目录。
4. 点击「＋」或按 `⌘T`（Windows/Linux 为 `Ctrl+T`）。若浏览器询问是否保留新标签页变更，选择保留。

更新时覆盖同一目录，并到扩展管理页点击「重新加载」；已经打开的页面也需刷新。不要先卸载或移动目录，以保留扩展 ID 和本地设置。

停用后新标签恢复浏览器默认页，数据仍保留；卸载会移除扩展数据。多个新标签页扩展可能相互覆盖。本项目面向桌面普通窗口，无痕窗口不接管新标签页。

## 搜索与设置

- 点击搜索框左侧的引擎图标，在 Bing、Google、百度之间切换。菜单支持方向键、Enter、Escape；切换保留输入内容并返回输入焦点。
- Enter 或右侧搜索按钮提交。中文输入法组合期间的 Enter 不会提前搜索；页面首次打开不抢占地址栏焦点。
- 扩展默认在当前标签打开结果，网站默认另开标签，保存过的选择优先。
- 右上角设置打开右侧抽屉，包含搜索、背景、外观和布局。主题支持跟随系统、浅色、深色；自定义颜色在折叠区。
- 本地图片最大 32 MB、1600 万像素，需浏览器能够解码。最长边缩至 1920 px，转成静态 JPEG，压缩后的保存数据最大 2 MB。
- 图片适配与遮罩仅作用于图片背景。「恢复纯色」只移除图片；「恢复全部默认设置」重置全部偏好。
- 保存失败时会在设置中提示。图片保存失败保留原背景；存储不可用时只在当前页面临时生效。

## 自由布局

在设置中选择「编辑布局」：

- 拖动搜索框移动位置；拖四条边或四个角调整宽高。
- 框体获得焦点后，方向键移动；缩放手柄获得焦点后，方向键调整对应边缘。Shift 每次调整 10px，普通方向键每次 1px。
- 「重置」只重置本次布局草稿；「取消」或 Escape 恢复进入编辑前的布局；「完成」统一保存。
- 编辑时暂停搜索框内部交互，退出后隐藏手柄及工具条。
- 默认 600×56px，水平居中，中心位于页面高度的 42%。最小尺寸随字号适配，并限制在可用视口内。
- 窗口变窄时临时限制显示范围，恢复较大窗口时恢复保存尺寸，不覆盖原布局。

## 本地数据与旧版兼容

使用原生 IndexedDB 数据库 `frequency_search_v2`。首次启动只读导入同一来源的旧 `shadow._db` 数据，包括引擎、搜索打开方式、本地图片、遮罩、适配、颜色和布局。

迁移结果和完成标记一起提交。迁移读取失败不标记成功，重新加载可重试；恢复默认保留完成标记，避免旧设置再次出现。旧数据库不改写，旧版仍可读取自己的数据；新版修改只写新库。

网站、扩展、不同浏览器分别保存数据，没有账号、同步、导入／导出、统计或上传。照片保存在浏览器存储中，不增加安装包体积；搜索时关键词发送给所选引擎。扩展页面和本地背景可离线使用，实际搜索需要网络。

## 验证

```sh
npm test
npm run build
npm run check:size

# 可选：安装浏览器集成检查，需项目内或全局安装 Playwright
node tool/verify_browser.cjs chrome
node tool/verify_browser.cjs edge
```

集成脚本默认使用 macOS 应用路径，其他系统可用 `BROWSER_EXECUTABLE` 指定可执行文件。使用独立临时配置，结束后删除测试配置；截图和结果保留在 `build/qa-native-chrome/`、`build/qa-native-edge/`。DevTools 加载仅作用于当前会话，重启检查会重新加载同一路径并核对磁盘数据。

界面图标使用 Fluent UI System Icons 的实际 SVG 子集，许可证及固定版本来源随产物放在 `licenses/`。搜索引擎与扩展 PNG 复用本项目已有资源。

详细验证范围见 `VALIDATION.md`。
