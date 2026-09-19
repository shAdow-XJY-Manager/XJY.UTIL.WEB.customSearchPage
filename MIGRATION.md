# customSearchPage 依赖迁移记录

## 问题描述

`customSearchPage` 项目在 Flutter 3.35.7 环境下构建失败，原因是依赖包版本过旧，与当前 Flutter 版本不兼容。

## 主要问题

### 1. cached_network_image 不兼容
- **旧版本**: `cached_network_image: ^3.2.3`
- **问题**: 该版本使用了已废弃的 Flutter 内部 API，在 Flutter 3.35.7 中无法编译
- **错误信息**: `Type 'DecoderCallback' not found`, `Method not found: 'webOnlyInstantiateImageCodecFromUrl'`

### 2. flutter_colorpicker 版本过旧
- **旧版本**: `flutter_colorpicker: ^1.0.3`
- **问题**: 使用了已废弃的 Material Design 属性 `bodyText1` 和 `bodyText2`
- **错误信息**: `The getter 'bodyText1' isn't defined for the type 'TextTheme'`

## 解决方案

### 1. 移除 cached_network_image，使用内置 Image.network

**文件**: `lib/page/custom_search_bar.dart` 和 `lib/page/home_page.dart`

**改动**:
- 移除 `import 'package:cached_network_image/cached_network_image.dart';`
- 将 `CachedNetworkImageProvider` 替换为 `Image.network`
- 将 `CachedNetworkImage` 组件替换为 `Image.network`

**优势**:
- `Image.network` 是 Flutter 内置组件，无需额外依赖
- 自带图片缓存功能（虽然不如 cached_network_image 强大，但对于该项目足够）
- 完全兼容最新 Flutter 版本

**代码示例**:

```dart
// 旧代码
Image(
  image: CachedNetworkImageProvider('${WebSiteLink.baseResourceLink}/assets/icon/${engineName[engineOption]}.png',),
)

// 新代码
Image.network(
  '${WebSiteLink.baseResourceLink}/assets/icon/${engineName[engineOption]}.png',
  errorBuilder: (context, error, stackTrace) => const Icon(Icons.search),
  loadingBuilder: (context, child, loadingProgress) {
    if (loadingProgress == null) return child;
    return const SizedBox(
      width: 24,
      height: 24,
      child: CircularProgressIndicator(strokeWidth: 2),
    );
  },
)
```

### 2. 升级 flutter_colorpicker

**改动**:
```yaml
# pubspec.yaml
dependencies:
  flutter_colorpicker: ^1.1.0  # 从 ^1.0.3 升级
```

**说明**:
- `1.1.0` 版本适配了 Material3 和 Flutter 3.x
- 移除了对已废弃的 `bodyText1` 和 `bodyText2` 的引用

## 构建结果

✅ 构建成功
- 编译时间: 23.0s
- 输出目录: `docs/`
- Tree-shaking: 
  - CupertinoIcons.ttf: 283452 → 1564 bytes (99.4% reduction)
  - MaterialIcons-Regular.otf: 1645184 → 8996 bytes (99.5% reduction)

## 注意事项

1. **dart:html 警告**: 项目使用了 `dart:html` 和 `dart:js`，这些在 WebAssembly 模式下不支持。目前不影响 JavaScript 编译，但未来可能需要迁移到 `package:web`。

2. **主题已应用**: 该项目已应用统一的主题色 (`seedColor: Color(0xFF685BFF)`)，与其他 Flutter Web 项目保持一致。

3. **GitHub Pages 部署**: 构建产物已正确输出到 `docs/` 文件夹，`--base-href /customSearchPage/` 参数已正确配置。

## 依赖变更总结

| 依赖包 | 旧版本 | 新版本 | 变更类型 |
|--------|--------|--------|----------|
| cached_network_image | ^3.2.3 | 移除 | 替换为内置组件 |
| flutter_colorpicker | ^1.0.3 | ^1.1.0 | 版本升级 |

## 迁移日期

2026-09-19
