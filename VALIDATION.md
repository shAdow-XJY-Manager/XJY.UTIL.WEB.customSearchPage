# 1.5.0 验证记录

日期：2026-11-06。环境：macOS，Node 22.20.0，系统 Chrome / Edge。

## 实现与交付

- 页面底色 auto / solid / ambient 与五类组件颜色模式独立。
- 色块 input 实时预览，change / blur 提交；失败恢复最后保存颜色，过期异步保存不覆盖较新的预览。颜色行不再使用包裹式 label。
- schema 4 / IndexedDB version 3 原子迁移；保留旧数据快照、颜色值、背景和一次性导入标记，不写旧 shadow._db。
- 原文件保存；MP4 / WebM 限 100 MiB，同时校验容器与实际解码。GIF / APNG / 动态 WebP 使用 ImageDecoder 的小尺寸帧取色，避免 canvas 只采到默认帧。
- 视频静音循环；暂停偏好保留；后台停止播放和采样。减少动态效果默认暂停，明确播放选择优先。动态取色最多 10 FPS。
- 原创代码 MIT；第三方资源保留各自许可。LICENSE 与 NOTICE 随安装包交付。
- ZIP 177352 bytes（173.2 KiB），解压 343305 bytes（335.3 KiB），34 个文件。
- 本地 ZIP SHA256：`7d692e7b529aa4dd91a189fd921ab2c2338be006745f391d30e5298308ad3187`。
- CI 会重新构建，ZIP 文件时间戳可能不同；下载 Release 时应使用随同发布的 SHA256SUMS.txt。
- 网站只生成 build/web，未更新 docs 或部署网站。扩展使用既有 build/extension 路径。

## 自动验收

- npm test：58 项通过。包括原有搜索、存储、布局、恢复确认、语言完整性及新增颜色迁移、模式共存和视频限制。
- 原生扩展：Chrome / Edge 各 31 项通过，包括离线视频与 MV3 CSP、独立颜色、搜索、快捷链接、迁移、原图字节保真、重启与重载、停用和卸载恢复。
- 网站：Chrome / Edge 各 11 项通过，覆盖生产子路径、16 语言、320px / 200% 字号、RTL、快捷链接、图标离线缓存。
- 媒体：10 类检查通过，包括真实 WebM 录制 / 播放、动态环境光变化、颜色 input 即时预览、刷新保留、损坏视频、减少动态效果、采样频率上限、受控 visibilitychange 暂停 / 恢复及窄屏。
- 单独以真实 MP4 录制执行媒体检查通过；Edge 的 WebM 媒体检查通过。
- 额外 5 类检查：静态 PNG 不持续采样；GIF / APNG / WebP 动态取色与保存后 SHA256 一致；颜色保存失败回滚；100 MiB + 1 byte 拒绝并保留旧背景；受控自动播放拒绝后保留首帧并可手动重试。
- npm run build、体积门禁、语法与 git diff --check 通过。没有字体或 WASM 资源。

## 证据与复现

本机证据目录：`/Volumes/SHADOW/Mac-Offload/Outputs/customSearchPage/1.5.0/`。已核实外接卷 UUID 与用户指定值一致。

- `build/qa-native-{chrome,edge}/result.json`、`build/qa-web{,-edge}/result.json`：回归结果。
- `media-chrome/media-result.json`、`media-edges-result.json`：媒体与边界检查。
- `media-chrome/appearance-video.png`、`colors-*-narrow.png`：隔离测试页视觉记录。
- `tool/verify_media.cjs` 在本地 Vite 5173 上运行，生成合成短视频；`tool/verify_media_edges.cjs` 自带合成图片数据，并复用前者生成的 WebM。
- 脚本使用 QA_OUTPUT 指向外盘目录，原生浏览器测试资料也放在该目录，测试结束清理本次创建的临时配置，不修改日常浏览器资料。

## 明确限制

- 本轮电脑 / 内置浏览器控制连续连接超时。因此未完成用户当前页面的 Product Design 交互截图审查，也未在日常 Edge 点击重新加载；不能把隔离自动测试当作日常配置实测。
- 日常 Edge 更新需在 edge://extensions 中为本项目点击“重新加载”，再打开新标签页；目录已保留。之前 1.4.0 的安装记录不作为本轮新验证。
- 截图检查来自隔离的合成测试媒体；字体、布局与可访问操作已自动检查，不宣称全量无障碍合规。原生系统选色弹窗的取消手势仍需人工验收。
- visibilitychange、自动播放拒绝、存储失败使用受控测试；未操作用户的网络或系统辅助功能设置。
- ImageDecoder 不可用时，动态图片仍由浏览器显示，环境光回退到静态取色；视频编码支持取决于浏览器。未测试 Windows / Linux 原生界面。
