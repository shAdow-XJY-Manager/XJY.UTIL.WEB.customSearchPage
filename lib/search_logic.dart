const engineNames = ['Bing', 'Google', '百度'];
Uri searchUri(int engine, String query) {
  if (query.trim().isEmpty) throw const FormatException('先写下想寻找的内容。');
  if (engine < 0 || engine >= engineNames.length) throw const FormatException('请选择有效搜索引擎。');
  return switch (engine) {
    0 => Uri.https('www.bing.com', '/search', {'q': query.trim()}),
    1 => Uri.https('www.google.com', '/search', {'q': query.trim()}),
    _ => Uri.https('www.baidu.com', '/s', {'wd': query.trim()}),
  };
}
int safeOption(Object? raw, int count, int fallback) => raw is int && raw >= 0 && raw < count ? raw : fallback;
