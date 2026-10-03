import 'dart:js_interop';
@JS('frequencySearchOpen') external void _open(JSString url, JSBoolean newTab);
@JS('frequencySearchBackground') external JSPromise<JSString> _pick();
void openSearch(String url, bool newTab) => _open(url.toJS, newTab.toJS);
Future<String> pickBackground() async => (await _pick().toDart).toDart;
