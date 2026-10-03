import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:custom_search_page/main.dart';
import 'package:custom_search_page/frequency_search.dart';

void main() {
  testWidgets('search settings open and close without losing the search page', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1200, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MyApp());
    final prefs =
        (tester.state(find.byType(FrequencySearch)) as dynamic).prefs
            as SearchPreferences;
    for (var i = 0; i < 300 && !prefs.initialized; i++) {
      await tester.runAsync(
        () => Future<void>.delayed(const Duration(milliseconds: 10)),
      );
      await tester.pump(const Duration(milliseconds: 10));
    }
    expect(
      prefs.initialized,
      isTrue,
      reason:
          'Browser preferences must finish initialization before settings interactions.',
    );
    await tester.pumpAndSettle();
    expect(find.text('频率搜索'), findsOneWidget);
    await tester.tap(find.byTooltip('打开搜索设置'));
    await tester.pumpAndSettle();
    expect(find.text('搜索设置'), findsOneWidget);
    final originalCustomColor = prefs.customColor;
    final customColors = find.widgetWithText(SwitchListTile, '自定义颜色');
    if (!prefs.customColor) {
      await tester.ensureVisible(customColors);
      await tester.tap(customColors);
      await tester.pumpAndSettle();
    }
    final colorInput = find.byWidgetPredicate(
      (widget) =>
          widget is TextField &&
          widget.decoration?.labelText == 'ARGB / #AARRGGBB',
    );
    final originalColors = Map<String, int>.from(prefs.colors);
    final originalNotice = prefs.notice;
    prefs.notice = '本地背景已更新';
    await tester.ensureVisible(colorInput);
    await tester.enterText(colorInput, 'FF#F4F2E9');
    await tester.ensureVisible(find.text('应用颜色'));
    await tester.tap(find.text('应用颜色'));
    await tester.pump();
    expect(prefs.colors, originalColors);
    expect(find.text('请输入 8 位 ARGB，如 #FFF4F2E9。'), findsOneWidget);
    expect(find.text('本地背景已更新'), findsNothing);
    prefs.notice = originalNotice;
    if (!originalCustomColor) {
      await tester.ensureVisible(customColors);
      await tester.tap(customColors);
      await tester.pumpAndSettle();
    }
    await tester.tap(find.byTooltip('关闭设置'));
    await tester.pumpAndSettle();
    expect(find.text('搜索设置'), findsNothing);
    expect(find.text('频率搜索'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
