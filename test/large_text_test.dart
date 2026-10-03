@TestOn('browser')
library;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:custom_search_page/main.dart';
import 'package:custom_search_page/frequency_search.dart';

class _SearchTrace {
  String stage = 'mount';
  String? firstFailureStage;
  SearchPreferences? prefs;
  final frameworkErrors = <FlutterErrorDetails>[];

  String get state => 'stage=$stage firstFailure=$firstFailureStage '
      'initialized=${prefs?.initialized} persistent=${prefs?.persistent}';

  void at(String value) {
    stage = value;
  }

  void failure() {
    firstFailureStage ??= stage;
  }
}

Future<void> withLargeText(
  WidgetTester tester,
  Future<void> Function() checks, {
  required _SearchTrace trace,
}) async {
  tester.view.physicalSize = const Size(320, 800);
  tester.view.devicePixelRatio = 1;
  final previousHandler = FlutterError.onError;
  Object? primaryError;
  FlutterError.onError = (details) {
    trace.frameworkErrors.add(details);
    trace.failure();
    previousHandler?.call(details);
  };
  try {
    await tester.pumpWidget(Builder(builder: (context) {
      final app = const MyApp().build(context) as MaterialApp;
      return MaterialApp(
        title: app.title,
        theme: app.theme,
        darkTheme: app.darkTheme,
        themeMode: app.themeMode,
        home: app.home,
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(2)),
          child: child!,
        ),
      );
    }));
    await tester.pump(const Duration(milliseconds: 100));
    await checks();
    expect(tester.takeException(), isNull,
        reason: '${trace.state}\n${trace.frameworkErrors.map((e) => e.exceptionAsString()).join('\n')}');
  } catch (error) {
    primaryError = error;
    trace.failure();
    rethrow;
  } finally {
    try {
      await tester.pumpWidget(const SizedBox.shrink());
    } catch (error, stack) {
      trace.failure();
      if (primaryError == null && trace.frameworkErrors.isEmpty) {
        Error.throwWithStackTrace(error, stack);
      }
    } finally {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
      FlutterError.onError = previousHandler;
    }
  }
}

void expectScaledText(WidgetTester tester, String label) {
  final text = find.text(label);
  expect(text, findsOneWidget);
  expect(MediaQuery.textScalerOf(tester.element(text)).scale(14), 28);
  final rich = find.descendant(of: text, matching: find.byType(RichText));
  expect(rich, findsOneWidget);
  final paragraph = tester.renderObject<RenderParagraph>(rich);
  expect(paragraph.textScaler.scale(14), 28);
  expect(paragraph.didExceedMaxLines, isFalse, reason: '$label must be complete');
  expect(
    paragraph.getMaxIntrinsicHeight(paragraph.size.width),
    lessThanOrEqualTo(paragraph.size.height + 1),
    reason: '$label must not be clipped vertically',
  );
}

Future<void> tapVisible(WidgetTester tester, Finder control) async {
  await tester.ensureVisible(control);
  await tester.pump(const Duration(milliseconds: 100));
  expect(control.hitTestable(), findsOneWidget);
  final rect = tester.getRect(control);
  expect(rect.left, greaterThanOrEqualTo(-1));
  expect(rect.right, lessThanOrEqualTo(321));
  expect(rect.top, greaterThanOrEqualTo(-1));
  expect(rect.bottom, lessThanOrEqualTo(801));
  expect(MediaQuery.textScalerOf(tester.element(control)).scale(14), 28);
  await tester.tap(control.hitTestable());
  await tester.pump(const Duration(milliseconds: 100));
}

Future<void> finishBrowserWrites(
  WidgetTester tester,
  Future<void> writes,
) async {
  var done = false;
  Object? error;
  StackTrace? stack;
  writes.then<void>((_) {
    done = true;
  }, onError: (Object caught, StackTrace trace) {
    error = caught;
    stack = trace;
    done = true;
  });
  // IndexedDB runs in real time, but the existing Sembast transaction queue
  // and its cooperator timers were created by taps in the fake test zone.
  // Waiting only inside runAsync would never advance those queued timers.
  for (var attempt = 0; attempt < 300 && !done; attempt++) {
    await tester.runAsync(
      () => Future<void>.delayed(const Duration(milliseconds: 10)),
    );
    await tester.pump(const Duration(milliseconds: 10));
  }
  expect(done, isTrue, reason: 'IndexedDB cleanup must finish within 3 seconds');
  if (error != null) Error.throwWithStackTrace(error!, stack!);
}

void main() {
  testWidgets('320px at real 200% text keeps initialized search settings usable',
      (tester) async {
    final trace = _SearchTrace();
    await withLargeText(tester, () async {
      final prefs = (tester.state(find.byType(FrequencySearch)) as dynamic).prefs
          as SearchPreferences;
      trace.prefs = prefs;
      trace.at('prefs-init');
      for (var attempt = 0; attempt < 300 && !prefs.initialized; attempt++) {
        await tester.runAsync(
          () => Future<void>.delayed(const Duration(milliseconds: 10)),
        );
        await tester.pump(const Duration(milliseconds: 10));
      }
      trace.at('initialized');
      expect(prefs.initialized, isTrue,
          reason: 'Wait for the actual IndexedDB initialization before tapping');
      expect(prefs.persistent, isTrue);
      final original = prefs.newTab;
      final originalEngine = prefs.engine;
      Object? flowError;
      try {
        trace.at('Bing');
        expectScaledText(tester, 'Bing');
        final engine = find.widgetWithText(ChoiceChip, 'Bing');
        await tapVisible(tester, engine);
        expect(prefs.engine, 0);
        trace.at('open');
        await tapVisible(tester, find.byTooltip('打开搜索设置'));
        trace.at('toggle');
        expectScaledText(tester, '搜索结果在新标签打开');
        final toggle = find.widgetWithText(SwitchListTile, '搜索结果在新标签打开');
        await tapVisible(tester, toggle);
        expect(prefs.newTab, !original);
        expect(tester.widget<SwitchListTile>(toggle).value, !original);
        expectScaledText(tester, '自定义颜色');
        await tester.ensureVisible(find.widgetWithText(SwitchListTile, '自定义颜色'));
        await tester.pump();
        expect(find.widgetWithText(SwitchListTile, '自定义颜色').hitTestable(),
            findsOneWidget);
        trace.at('close');
        await tapVisible(tester, find.byTooltip('关闭设置'));
        await tester.pump(const Duration(milliseconds: 250));
        expect(find.byType(SearchSettings), findsNothing);
        expect(find.byTooltip('打开搜索设置').hitTestable(), findsOneWidget);
      } catch (error) {
        flowError = error;
        trace.failure();
        rethrow;
      } finally {
        trace.at('cleanup');
        try {
          await finishBrowserWrites(tester, Future.wait<void>([
            prefs.db.put('is_jump_to_new_page', original),
            prefs.db.put('engine_option', originalEngine),
          ]));
          trace.at('cleanup-complete');
        } catch (error, stack) {
          trace.failure();
          if (flowError == null && trace.frameworkErrors.isEmpty) {
            Error.throwWithStackTrace(error, stack);
          }
        }
      }
    }, trace: trace);
  });
}
