## 1.5.0 · 外观与动态背景 / Appearance and motion

- 页面底色与组件颜色独立，环境光可同时搭配自定义搜索框颜色；色块实时预览、单项重置。
- 本地 MP4/WebM 视频最大 100 MiB，原文件保存；静音循环、后台暂停、减少动态效果适配。编码是否可用取决于浏览器。
- 动态图片与视频环境光最多 10 FPS；图片原文件不压缩。
- 保留 16 种语言、旧数据迁移与一次性导入标记。
- 原创代码采用 MIT；第三方图标、商标与旧资源保留各自许可，见 NOTICE.md。

Unzip the extension archive, then load its directory in Chrome/Edge developer
mode. For updates, replace files in the same installed directory and reload the
extension. Keep a copy of your original local media. Disabling restores the
browser new-tab page; uninstalling removes extension-local data.

Independent page/control colors with live preview and per-control reset. Local
MP4/WebM videos up to 100 MiB are saved unchanged and play muted in a loop.
Background tabs pause playback; reduced motion defaults to paused. Animated
ambient sampling is capped at 10 FPS. Codec support depends on the browser.
Original code is MIT; third-party assets retain their own terms.
