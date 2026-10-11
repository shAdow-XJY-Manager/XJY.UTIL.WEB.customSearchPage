@TestOn('browser')
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sembast_web/sembast_web.dart';
import 'package:custom_search_page/app_target.dart';
import 'package:custom_search_page/service/index_db.dart';
import 'package:custom_search_page/service/search_preferences.dart';

class FailingIndexDB extends IndexDB {
  FailingIndexDB({required super.databaseName});
  bool failWrites = false;
  @override
  Future<void> putAll(Map<String, Object?> values) async {
    if (failWrites) throw StateError('storage unavailable');
    await super.putAll(values);
  }
}

void main() {
  late String name;
  final databases = <IndexDB>[];
  setUp(() {
    name = 'frequency-test-${DateTime.now().microsecondsSinceEpoch}';
    databases.clear();
  });
  tearDown(() async {
    for (final database in databases) {
      await database.close();
    }
    await databaseFactoryWeb.deleteDatabase(name);
  });
  IndexDB database() {
    final db = IndexDB(databaseName: name);
    databases.add(db);
    return db;
  }

  test(
    'target default, saved choice, and reset use the right navigation',
    () async {
      final prefs = SearchPreferences(database: database());
      await prefs.init();
      expect(prefs.persistent, isTrue);
      expect(prefs.newTab, !isExtension);
      expect(prefs.overlay, 0.45);
      prefs.newTab = isExtension;
      await prefs.save('is_jump_to_new_page', prefs.newTab);
      final reloaded = SearchPreferences(database: database());
      await reloaded.init();
      expect(reloaded.newTab, isExtension);
      await reloaded.reset();
      expect(reloaded.newTab, !isExtension);
      expect(reloaded.overlay, 0.45);
    },
  );

  test(
    'preview does not persist until release; image reset preserves overlay',
    () async {
      final prefs = SearchPreferences(database: database());
      await prefs.init();
      prefs.previewOverlay(0.7);
      expect(prefs.overlay, 0.7);
      expect(prefs.db.get(SearchPreferences.overlayKey), isNull);
      await prefs.saveOverlay(0.7);
      await prefs.setBackground('data:image/jpeg;base64,YWJj');
      final reloaded = SearchPreferences(database: database());
      await reloaded.init();
      expect(reloaded.overlay, 0.7);
      expect(reloaded.background, prefs.background);
      expect(reloaded.db.get('is_custom_back_img'), isTrue);
      await reloaded.setBackground('');
      expect(reloaded.background, isEmpty);
      expect(reloaded.overlay, 0.7);
      await reloaded.db.put('unrelated_key', 'keep');
      await reloaded.reset();
      expect(reloaded.db.get('unrelated_key'), 'keep');
      final reset = SearchPreferences(database: database());
      await reset.init();
      expect(reset.background, isEmpty);
      expect(reset.overlay, 0.45);
    },
  );

  test(
    'transaction failure rolls back both stored values and the cache',
    () async {
      final db = database();
      await db.init();
      await db.putAll({
        'is_custom_back_img': true,
        'custom_back_img_encode': 'old',
      });
      await expectLater(
        db.putAll({
          'is_custom_back_img': false,
          'custom_back_img_encode': Object(),
        }),
        throwsA(anything),
      );
      expect(db.get('is_custom_back_img'), isTrue);
      expect(db.get('custom_back_img_encode'), 'old');
      final reopened = database();
      await reopened.init();
      expect(reopened.get('is_custom_back_img'), isTrue);
      expect(reopened.get('custom_back_img_encode'), 'old');
    },
  );

  test(
    'background save failure retains old image and can be retried',
    () async {
      final db = FailingIndexDB(databaseName: name);
      databases.add(db);
      final prefs = SearchPreferences(database: db);
      await prefs.init();
      await prefs.setBackground('data:image/jpeg;base64,YWJj');
      db.failWrites = true;
      await prefs.setBackground('data:image/jpeg;base64,ZGVm');
      expect(prefs.background, 'data:image/jpeg;base64,YWJj');
      expect(prefs.notice, contains('背景未保存'));
      expect(db.get('custom_back_img_encode'), 'YWJj');
      db.failWrites = false;
      await prefs.setBackground('data:image/jpeg;base64,ZGVm');
      expect(prefs.background, 'data:image/jpeg;base64,ZGVm');
      expect(prefs.notice, '本地背景已保存。');
    },
  );

  test(
    'invalid stored values use safe defaults and report damaged background',
    () async {
      final db = database();
      await db.init();
      await db.putAll({
        SearchPreferences.overlayKey: 7,
        'engine_option': -1,
        'is_custom_back_img': true,
        'custom_back_img_encode': 'not base64!',
      });
      final prefs = SearchPreferences(database: database());
      await prefs.init();
      expect(prefs.engine, 0);
      expect(prefs.overlay, 0.45);
      expect(prefs.background, isEmpty);
      expect(prefs.notice, contains('旧背景无法读取'));
    },
  );

  test('unavailable storage does not report a successful save', () async {
    final prefs = SearchPreferences(database: database());
    await prefs.init();
    prefs.persistent = false;
    await prefs.setBackground('data:image/jpeg;base64,YWJj');
    expect(prefs.notice, '背景未保存，仅在当前页面生效。');
    await prefs.saveOverlay(0.1);
    expect(prefs.notice, '设置未保存，仅在当前页面生效。');
  });
}
