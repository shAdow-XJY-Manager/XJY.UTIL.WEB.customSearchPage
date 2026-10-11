import 'package:sembast/sembast.dart';
import 'package:sembast_web/sembast_web.dart';

class IndexDB {
  IndexDB({String databaseName = 'shadow._db'}) : _dbName = databaseName;
  final String _dbName;
  Database? _db;
  final _store = StoreRef<String, Object?>('search_records');
  final Map<String, Object?> _cacheDB = {};

  Future<void> init() async {
    _db = await databaseFactoryWeb.openDatabase(_dbName);
    final records = await _store.find(_db!);
    _cacheDB
      ..clear()
      ..addEntries(records.map((r) => MapEntry(r.key, r.value)));
  }

  Future<void> put(String key, Object? value) => putAll({key: value});

  Future<void> putAll(Map<String, Object?> values) async {
    await _db!.transaction((transaction) async {
      for (final entry in values.entries) {
        await _store.record(entry.key).put(transaction, entry.value);
      }
    });
    // Update the cache only after the complete transaction commits.
    _cacheDB.addAll(values);
  }

  Object? get(String key) {
    if (_cacheDB.containsKey(key)) {
      return _cacheDB[key];
    }
    return null;
  }

  Future<void> delete(String key) => deleteKeys([key]);

  Future<void> deleteKeys(Iterable<String> keys) async {
    final removed = keys.toList();
    await _db!.transaction((transaction) async {
      for (final key in removed) {
        await _store.record(key).delete(transaction);
      }
    });
    removed.forEach(_cacheDB.remove);
  }

  Future<void> deleteAll() async {
    await _store.delete(_db!);
    _cacheDB.clear();
  }

  Future<void> close() async => _db?.close();
}
