# custom_search_page

A web Flutter project, for import different search engine

## deploy
[https://shadowplusing.cn/XJY.UTIL.WEB.customSearchPage/#/](https://shadowplusing.cn/XJY.UTIL.WEB.customSearchPage/#/)

## support
<details>
<summary>dependencies</summary>
1. [sembast](https://pub.dev/packages/sembast)<br>
2. [sembast_web](https://pub.dev/packages/sembast_web)<br>
3. [get_it](https://pub.dev/packages/get_it)<br>
4. [cached_network_image](https://pub.dev/packages/cached_network_image)<br>
5. [event_bus](https://pub.dev/packages/event_bus)<br>
6. [loading_animations](https://pub.dev/packages/loading_animations)<br>
7. [flutter_colorpicker](https://pub.dev/packages/flutter_colorpicker)<br>
8. [http](https://pub.dev/packages/http)
</details>
<details>
<summary>dev_dependencies</summary>
1. [crypto](https://pub.dev/packages/crypto)<br>
</details>

## Getting Started
solve flutter web font download event causes bad website speed, change use html render.

flutter run --web-renderer html

1. flutter build web --web-renderer html --release --base-href /custom_search_page/
2. generate version.txt

## flutter web build
index.html
```
    <base href="/">
=>
    <base href="/custom_search_page/">
```

## update
```
    file resource hash generator:
    1. run 'test/version_generator.dart'
    2. check version of 'docs/version.txt'
```

## dev
```
    热重载（Hot Reload）：在开发过程中，如果您使用了热重载来快速查看更改的效果，那么在每次热重载时都会触发 build 方法执行两次。
    这是 Flutter 开发过程中的正常行为，并不代表 Flutter Web release。
```