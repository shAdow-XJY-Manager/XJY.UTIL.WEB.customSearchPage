# customSearchPage 构建问题修复总结

## 问题回顾

`customSearchPage` 项目在统一主题改造过程中，虽然成功应用了主题代码，但构建失败，错误原因是依赖版本与 Flutter 3.35.7 不兼容。

## 根本原因

### 1. cached_network_image 包不兼容
- **版本**: `3.2.3`
- **症状**: 编译时报错 `Type 'DecoderCallback' not found`、`Method not found: 'webOnlyInstantiateImageCodecFromUrl'`
- **原因**: 该版本使用了 Flutter 内部 API，这些 API 在 Flutter 3.x 中已被移除或重构

### 2. flutter_colorpicker 包版本过旧
- **版本**: `1.0.3`
- **症状**: 编译时报错 `The getter 'bodyText1' isn't defined for the type 'TextTheme'`
- **原因**: Material Design 2 → Material 3 迁移，`bodyText1`/`bodyText2` 已被 `bodyLarge`/`bodyMedium` 替代

## 解决方案

### 方案选择

经过分析，选择了最小化依赖的方案：

1. **移除 cached_network_image** - 使用 Flutter 内置的 `Image.network` 替代
   - 优点：无需外部依赖，完全兼容
   - 缺点：缓存能力较弱（但对本项目需求足够）
   
2. **升级 flutter_colorpicker** - 从 `1.0.3` 升级到 `1.1.0`
   - 该版本已适配 Material 3 和 Flutter 3.x

### 代码改动

#### 1. 移除 cached_network_image 导入

**lib/page/custom_search_bar.dart** 和 **lib/page/home_page.dart**:
```dart
// 删除
import 'package:cached_network_image/cached_network_image.dart';
```

#### 2. 替换图片组件

**搜索引擎图标** (custom_search_bar.dart:124):
```dart
// 旧代码
Image(
  image: CachedNetworkImageProvider(
    '${WebSiteLink.baseResourceLink}/assets/icon/${engineName[engineOption]}.png',
  ),
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

**背景图片** (home_page.dart:152):
```dart
// 旧代码
CachedNetworkImage(
  fit: boxFitList[boxFitOption],
  filterQuality: FilterQuality.high,
  imageUrl: '${WebSiteLink.baseResourceLink}/assets/img/background.jpg',
  progressIndicatorBuilder: (context, str, downloadProgress) => Center(
    child: LoadingBouncingGrid.square(),
  ),
  errorWidget: (context, url, error) => const Icon(Icons.error),
)

// 新代码
Image.network(
  '${WebSiteLink.baseResourceLink}/assets/img/background.jpg',
  fit: boxFitList[boxFitOption],
  filterQuality: FilterQuality.high,
  loadingBuilder: (context, child, loadingProgress) {
    if (loadingProgress == null) return child;
    return Center(child: LoadingBouncingGrid.square());
  },
  errorBuilder: (context, error, stackTrace) =>
      const Center(child: Icon(Icons.error, size: 48)),
)
```

#### 3. 更新 pubspec.yaml

```yaml
dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.2
  # cached_network_image: ^3.2.3  ← 移除
  get_it: ^7.6.0
  sembast: ^3.4.4
  event_bus: ^2.0.0
  sembast_web: ^2.1.3
  loading_animations: ^2.2.0
  flutter_colorpicker: ^1.1.0  # ← 从 ^1.0.3 升级
  http: ^0.13.6
```

## 构建结果

✅ **构建成功**

```
Compiling lib/main.dart for the Web...                             23.0s
✓ Built docs
```

- **编译时间**: 23.0s
- **输出目录**: `docs/`
- **Tree-shaking 优化**:
  - CupertinoIcons.ttf: 283,452 → 1,564 bytes (99.4% 减少)
  - MaterialIcons-Regular.otf: 1,645,184 → 8,996 bytes (99.5% 减少)

## 技术要点

### Image.network vs CachedNetworkImage

| 特性 | Image.network | CachedNetworkImage |
|------|---------------|-------------------|
| 依赖 | Flutter 内置 | 需要外部包 |
| 内存缓存 | ✅ 有 | ✅ 有 |
| 磁盘缓存 | ❌ 无 | ✅ 有 |
| 兼容性 | ✅ 完全兼容 | ⚠️ 版本依赖 |
| 加载指示器 | ✅ loadingBuilder | ✅ progressIndicatorBuilder |
| 错误处理 | ✅ errorBuilder | ✅ errorWidget |

对于 `customSearchPage` 这样的轻量级搜索页面，`Image.network` 的内存缓存已经足够。

### Material 2 → Material 3 迁移

Material 3 中文本主题的变化：

| Material 2 | Material 3 |
|------------|------------|
| headline1 | displayLarge |
| headline2 | displayMedium |
| headline3 | displaySmall |
| headline4 | headlineMedium |
| headline5 | headlineSmall |
| headline6 | titleLarge |
| subtitle1 | titleMedium |
| subtitle2 | titleSmall |
| bodyText1 | bodyLarge |
| bodyText2 | bodyMedium |
| caption | bodySmall |

## 注意事项

1. **dart:html 警告**: 项目使用了 `dart:html` 和 `dart:js`，在 WebAssembly 模式下不支持。这是已知限制，未来可能需要迁移到 `package:web`。

2. **主题已集成**: 项目已应用统一主题 (`seedColor: Color(0xFF685BFF)`)。

3. **GitHub Pages 就绪**: 构建产物已正确输出到 `docs/`，`--base-href /customSearchPage/` 已配置。

## 提交记录

**子模块提交** (customSearchPage):
```
cc570fd fix: 移除 cached_network_image 依赖，升级 flutter_colorpicker
```

**主仓库提交**:
```
e2417d6 chore: 更新 customSearchPage 子模块（修复构建问题）
```

## 经验总结

1. **最小化依赖原则**: 优先使用 Flutter 内置组件，减少外部依赖带来的兼容性问题
2. **依赖版本管理**: 定期检查和更新依赖包，确保与 Flutter SDK 版本兼容
3. **渐进式迁移**: Material 2 → Material 3 的迁移应尽早进行，避免依赖包不兼容
4. **构建前验证**: 在大规模改造前，应先验证关键依赖的兼容性

---

修复日期: 2026-09-19  
修复人: Claude Code  
Flutter 版本: 3.35.7 (stable)
