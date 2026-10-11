{{flutter_js}}
{{flutter_build_config}}

const extension = window.location.protocol === 'chrome-extension:';
const config = {
    canvasKitBaseUrl: 'canvaskit/',
    ...(extension ? { canvasKitVariant: 'chromium', preferWebParagraph: false } : {}),
    // All supported UI glyphs are bundled. Never fetch fonts from a third party.
    fontFallbackBaseUrl: new URL('assets/fonts/fallback/', document.baseURI).href,
};
const fail = error => {
  console.error('频率搜索启动失败', error);
  const loading = document.getElementById('loading');
  if (loading) loading.textContent = '页面未能启动，请重新加载；扩展用户请检查安装目录是否完整。';
};
_flutter.loader.load({
  config,
  onEntrypointLoaded: async initializer => {
    try {
      const engine = await initializer.initializeEngine(config);
      await engine.runApp();
    } catch (error) { fail(error); }
  },
}).catch(fail);
