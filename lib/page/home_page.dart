import 'dart:async';
import 'dart:convert';
import 'package:custom_search_page/component/animation_opacity.dart';
import 'package:custom_search_page/page/custom_search_bar.dart';
import 'package:custom_search_page/page/setting_dialog.dart';
import 'package:event_bus/event_bus.dart';
import 'package:flutter/material.dart';
import 'package:loading_animations/loading_animations.dart';
import '../service/app_get_it.dart';
import '../service/events.dart';
import '../service/index_db.dart';
import '../service/store_key.dart';
import '../service/website_link.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  final EventBus eventBus = appGetIt.get(instanceName: "EventBus");
  final IndexDB indexDB = appGetIt.get(instanceName: "IndexDB");
  late StreamSubscription subscription_1;
  late StreamSubscription subscription_2;
  late StreamSubscription subscription_3;
  late StreamSubscription subscription_4;
  late StreamSubscription subscription_5;
  late StreamSubscription subscription_6;
  late StreamSubscription subscription_7;

  final ValueNotifier<bool> openDialogNotifier = ValueNotifier<bool>(false);

  final ValueNotifier<bool> isCustomBackImgNotifier =
      ValueNotifier<bool>(false);
  final ValueNotifier<String> customBackImgEncodeNotifier =
      ValueNotifier<String>('');

  final ValueNotifier<int> boxFitOptionNotifier = ValueNotifier<int>(3);
  final List<BoxFit> boxFitList = [
    BoxFit.none,
    BoxFit.fill,
    BoxFit.scaleDown,
    BoxFit.cover,
    BoxFit.contain,
    BoxFit.fitWidth,
    BoxFit.fitHeight
  ];

  final ValueNotifier<int> searchBarAlignOptionNotifier = ValueNotifier<int>(4);
  final List<Alignment> searchBarAlignOptions = [
    Alignment.topLeft,
    Alignment.topCenter,
    Alignment.topRight,
    Alignment.centerLeft,
    Alignment.center,
    Alignment.centerRight,
    Alignment.bottomLeft,
    Alignment.bottomCenter,
    Alignment.bottomRight,
  ];

  final ValueNotifier<int> searchBarLengthOptionNotifier = ValueNotifier<int>(1);
  final List<double> searchBarLengthOptions = [
    500.0,
    800.0,
    1000.0,
  ];

  final ValueNotifier<int> pageBackColorValueNotifier = ValueNotifier<int>(Colors.white.value);
  final ValueNotifier<int> settingBtnColorValueNotifier = ValueNotifier<int>(Colors.white.value);

  @override
  void initState() {
    super.initState();
    searchBarAlignOptionNotifier.value =
        indexDB.get(StoreKey.searchBarAlignOption) as int? ?? 4;
    boxFitOptionNotifier.value =
        indexDB.get(StoreKey.boxFitOption) as int? ?? 3;
    customBackImgEncodeNotifier.value =
        indexDB.get(StoreKey.customBackImgEncode) as String? ?? '';
    isCustomBackImgNotifier.value =
        indexDB.get(StoreKey.isCustomBackImg) as bool? ?? false;
    pageBackColorValueNotifier.value =
        indexDB.get(StoreKey.pageBackColorValue) as int? ?? Colors.white.value;
    settingBtnColorValueNotifier.value =
        indexDB.get(StoreKey.settingBtnColorValue) as int? ?? Colors.white.value;
    searchBarLengthOptionNotifier.value =
        indexDB.get(StoreKey.searchBarLengthOption) as int? ?? 1;
    subscription_1 = eventBus.on<ChangeBackImgEvent>().listen((event) {
      customBackImgEncodeNotifier.value = event.imgEncode;
    });
    subscription_2 = eventBus.on<ChangeIsCustomBackImgEvent>().listen((event) {
      isCustomBackImgNotifier.value = event.isCustomBackImg;
    });
    subscription_3 = eventBus.on<ChangeBoxFitEvent>().listen((event) {
      boxFitOptionNotifier.value = event.boxFitOption;
    });
    subscription_4 = eventBus.on<ChangeSearchBarAlignOptionEvent>().listen((event) {
      searchBarAlignOptionNotifier.value = event.searchBarAlignOption;
    });
    subscription_5 = eventBus.on<ChangeSearchBarLengthOptionEvent>().listen((event) {
      searchBarLengthOptionNotifier.value = event.searchBarLengthOption;
    });
    subscription_6 = eventBus.on<ChangePageBackColorEvent>().listen((event) {
      pageBackColorValueNotifier.value = event.colorValue;
    });
    subscription_7 = eventBus.on<ChangeSettingBtnColorEvent>().listen((event) {
      settingBtnColorValueNotifier.value = event.colorValue;
    });
  }

  @override
  void dispose() {
    subscription_1.cancel();
    subscription_2.cancel();
    subscription_3.cancel();
    subscription_4.cancel();
    subscription_5.cancel();
    subscription_6.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SizedBox(
          height: double.infinity,
          width: double.infinity,
          child: Stack(
            fit: StackFit.passthrough,
            children: [
              ValueListenableBuilder<int>(
                valueListenable: pageBackColorValueNotifier,
                builder: (context, pageBackColorValue, child) {
                  return Container(
                    color: Color(pageBackColorValue),
                  );
                },
              ),
              ValueListenableBuilder<bool>(
                valueListenable: isCustomBackImgNotifier,
                builder: (context, isCustomBackImg, child) {
                  return Visibility(
                    visible: !isCustomBackImg,
                    maintainState: true,
                    child: ValueListenableBuilder<int>(
                      valueListenable: boxFitOptionNotifier,
                      builder: (context, boxFitOption, child) {
                        return Image.network(
                          '${WebSiteLink.baseResourceLink}/assets/img/background.jpg',
                          fit: boxFitList[boxFitOption],
                          filterQuality: FilterQuality.high,
                          loadingBuilder: (context, child, loadingProgress) {
                            if (loadingProgress == null) return child;
                            return Center(
                              child: LoadingBouncingGrid.square(),
                            );
                          },
                          errorBuilder: (context, error, stackTrace) =>
                              const Center(child: Icon(Icons.error, size: 48)),
                        );
                      },
                    ),
                  );
                },
              ),
              ValueListenableBuilder<bool>(
                valueListenable: isCustomBackImgNotifier,
                builder: (context, isCustomBackImg, child) {
                  return Visibility(
                    visible: isCustomBackImg,
                    maintainState: true,
                    child: ValueListenableBuilder<String>(
                      valueListenable: customBackImgEncodeNotifier,
                      builder: (context, customBackImgEncode, child) {
                        return ValueListenableBuilder<int>(
                          valueListenable: boxFitOptionNotifier,
                          builder: (context, boxFitOption, child) {
                            return AnimationOpacity(
                              isShow: isCustomBackImg,
                              child: Image.memory(
                                base64Decode(customBackImgEncode),
                                fit: boxFitList[boxFitOption],
                                filterQuality: FilterQuality.high,
                                errorBuilder: (context, object, stackTrace) =>
                                    Container(color: Colors.grey),
                              ),
                            );
                          },
                        );
                      },
                    ),
                  );
                },
              ),
              ValueListenableBuilder<int>(
                valueListenable: searchBarAlignOptionNotifier,
                builder: (context, searchBarOption, child) {
                  return Align(
                    alignment: searchBarAlignOptions[searchBarOption],
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(vertical: 130.0, horizontal: 50.0,),
                      child: ValueListenableBuilder<int>(
                        valueListenable: searchBarLengthOptionNotifier,
                        builder: (context, searchBarLengthOption, child) {
                          return SizedBox(
                            width: searchBarLengthOptions[searchBarLengthOption],
                            child: const CustomSearchBar(),
                          );
                        },
                      ),
                    ),
                  );
                },
              ),
              Align(
                alignment: Alignment.topRight,
                child: SingleChildScrollView(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Container(
                        width: 40.0,
                        height: 40.0,
                        margin: const EdgeInsets.all(5.0),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            begin: Alignment.topRight,
                            end: Alignment.bottomLeft,
                            colors: [
                              Colors.black.withOpacity(0.1),
                              Colors.transparent,
                              Colors.black.withOpacity(0.2),
                              Colors.black.withOpacity(0.1),
                              Colors.black.withOpacity(0.2),
                              Colors.transparent,
                              Colors.black.withOpacity(0.1),
                            ],
                          ),
                        ),
                        child: ValueListenableBuilder<int>(
                          valueListenable: settingBtnColorValueNotifier,
                          builder: (context, settingBtnColorValue, child) {
                            return IconButton(
                              color: Color(settingBtnColorValue),
                              tooltip: '设置(Settings)',
                              icon: const Icon(Icons.settings_outlined),
                              onPressed: () {
                                openDialogNotifier.value = !openDialogNotifier.value;
                              },
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              ValueListenableBuilder<bool>(
                valueListenable: openDialogNotifier,
                builder: (context, isOpenDialog, child) {
                  return Visibility(
                    visible: isOpenDialog,
                    maintainState: true, // 保持子组件的状态
                    child: SettingDialog(),
                  );
                },
              ),
            ],
          )),
    );
  }
}
