import 'package:flutter_test/flutter_test.dart';
import 'package:custom_search_page/search_logic.dart';

void main() {
  test('each engine preserves special query characters without adding parameters', () {
    const query = '中文🙂 & + # %';
    const hosts = ['www.bing.com', 'www.google.com', 'www.baidu.com'];
    for (var i = 0; i < hosts.length; i++) {
      final uri = searchUri(i, query);
      expect(uri.host, hosts[i]);
      expect(uri.queryParameters, {i == 2 ? 'wd' : 'q': query});
      expect(uri.fragment, isEmpty);
    }
    expect(() => searchUri(0, '  '), throwsFormatException);
    expect(() => searchUri(3, 'test'), throwsFormatException);
  });
  test('invalid stored selections recover to the fallback', () {
    expect(safeOption(2, 3, 0), 2);
    for (final value in [null, -1, 3, '2', 1.5]) {
      expect(safeOption(value, 3, 0), 0);
    }
  });
}
