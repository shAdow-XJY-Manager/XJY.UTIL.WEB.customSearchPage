import 'dart:async';
import 'dart:html' as html;

import 'package:event_bus/event_bus.dart';
import 'package:flutter/material.dart';

import '../service/app_get_it.dart';
import '../service/events.dart';
import '../service/index_db.dart';
import '../service/store_key.dart';
import '../service/website_link.dart';

class CustomSearchBar extends StatefulWidget {
  const CustomSearchBar({super.key});

  @override
  State<CustomSearchBar> createState() => _CustomSearchBarState();
}

class _CustomSearchBarState extends State<CustomSearchBar> {
  final IndexDB indexDB = appGetIt.get(instanceName: "IndexDB");
  final EventBus eventBus = appGetIt.get(instanceName: "EventBus");
  late StreamSubscription subscription_1;
  late StreamSubscription subscription_2;
  late StreamSubscription subscription_3;
  late StreamSubscription subscription_4;
  late StreamSubscription subscription_5;

  final TextEditingController _searchTextController = TextEditingController();

  // 搜索引擎URL
  List<String> engineUrl = [
    'https://www.bing.com/search?q=',
    'https://www.google.com/search?q=',
    'https://baidu.com/s?wd=',
  ];
  List<String> engineName = [
    'bing',
    'google',
    'baidu',
  ];

  bool isJumpToNewPage = false;
  int engineOption = 0;

  int searchBtnColorValue = Colors.deepPurpleAccent.value;
  int searchBarTextColorValue = Colors.black.value;
  int searchBarBorderColorValue = Colors.deepPurpleAccent.value;
  int searchBarBackColorValue = Colors.white.withOpacity(0.3).value;

  void _search(String query) {
    if (isJumpToNewPage) {
      html.AnchorElement anchorElement = html.AnchorElement(href: engineUrl[engineOption] + query);
      anchorElement.target = '_blank';
      anchorElement.click();
    } else {
      html.window.location.href = engineUrl[engineOption] + query;
    }
  }

  @override
  void initState() {
    super.initState();
    engineOption = indexDB.get(StoreKey.engineOption) as int? ?? 0;
    isJumpToNewPage = indexDB.get(StoreKey.isJumpToNewPage) as bool? ?? false;
    searchBtnColorValue = indexDB.get(StoreKey.searchBtnColorValue) as int? ?? Colors.deepPurpleAccent.value;
    searchBarTextColorValue = indexDB.get(StoreKey.searchBarTextColorValue) as int? ?? Colors.black.value;
    searchBarBorderColorValue = indexDB.get(StoreKey.searchBarBorderColorValue) as int? ?? Colors.deepPurpleAccent.value;
    searchBarBackColorValue = indexDB.get(StoreKey.searchBarBackColorValue) as int? ?? Colors.white.withOpacity(0.3).value;

    subscription_1 = eventBus.on<ChangeIsJumpToNewPageEvent>().listen((event) {
      isJumpToNewPage = event.isJumpToNewPage;
    });
    subscription_2 = eventBus.on<ChangeSearchBtnColorEvent>().listen((event) {
      setState(() {
        searchBtnColorValue = event.colorValue;
      });
    });
    subscription_3 = eventBus.on<ChangeSearchBarTextColorEvent>().listen((event) {
      setState(() {
        searchBarTextColorValue = event.colorValue;
      });
    });
    subscription_4 = eventBus.on<ChangeSearchBarBorderColorEvent>().listen((event) {
      setState(() {
        searchBarBorderColorValue = event.colorValue;
      });
    });
    subscription_5 = eventBus.on<ChangeSearchBarBackColorEvent>().listen((event) {
      setState(() {
        searchBarBackColorValue = event.colorValue;
      });
    });
  }

  @override
  void dispose() {
    _searchTextController.dispose();
    subscription_1.cancel();
    subscription_2.cancel();
    subscription_3.cancel();
    subscription_4.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: TextFormField(
        controller: _searchTextController,
        cursorColor: Color(searchBarTextColorValue),
        style: TextStyle(color: Color(searchBarTextColorValue)),
        decoration: InputDecoration(
          hintText: 'Enter your search query',
          hintStyle: TextStyle(color: Color(searchBarTextColorValue)),
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: 10.0, right: 15.0),
            child: IconButton(
              tooltip: engineName[engineOption],
              hoverColor: Colors.transparent,
              icon: Image.network(
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
              ),
              onPressed: () {
                setState(() {
                  engineOption = (engineOption + 1) % 3;
                });
                indexDB.put(StoreKey.engineOption, engineOption);
              },
            ),
          ),
          suffixIcon: Padding(
            padding: const EdgeInsets.only(left: 10.0, right: 15.0), // Adjust the right padding here
            child: IconButton(
              tooltip: 'search',
              icon: Icon(
                Icons.search_rounded,
                color: Color(searchBtnColorValue),
              ),
              onPressed: () {
                _search(_searchTextController.text);
              },
            ),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: const BorderRadius.all(Radius.circular(30)),
            borderSide: BorderSide(
              color: Color(searchBarBorderColorValue),
              width: 2.5,
            ),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: const BorderRadius.all(Radius.circular(30)),
            borderSide: BorderSide(
              color: Color(searchBarBorderColorValue),
              width: 2.5,
            ),
          ),
          filled: true,
          fillColor: Color(searchBarBackColorValue),
          contentPadding: EdgeInsets.zero,
        ),
        onFieldSubmitted: (String inputQuery) {
          _search(inputQuery);
        },
      ),
    );
  }
}