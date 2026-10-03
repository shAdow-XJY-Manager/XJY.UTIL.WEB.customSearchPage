import 'dart:convert';
import 'package:flutter/material.dart';
import 'browser/browser.dart' as browser;
import 'service/index_db.dart';
import 'search_logic.dart';
import 'theme/frequency_theme.dart';

class SearchPreferences extends ChangeNotifier {
  bool _disposed = false;
  final IndexDB db=IndexDB();
  bool initialized=false,persistent=true,newTab=true,customColor=false;
  int engine=0,alignment=4,width=1,fit=3;
  String background='';
  String notice='';
  final colors=<String,int>{'page_back_color_value':0xFF111315,'setting_btn_color_value':0xFFD6EF36,'search_btn_color_value':0xFFFFB23F,'search_bar_text_color_value':0xFFF4F2E9,'search_bar_border_color_value':0xFF41484B,'search_bar_back_color_value':0xFF1B1E20};
  Future<void> init() async {
    try {
      await db.init();
      engine=safeOption(db.get('engine_option'),3,0);
      alignment=safeOption(db.get('search_bar_align_option'),9,4);
      width=safeOption(db.get('search_bar_length_option'),3,1);
      fit=safeOption(db.get('box_fit_option'),7,3);
      newTab=db.get('is_jump_to_new_page') is bool?db.get('is_jump_to_new_page') as bool:true;
      customColor=db.get('lock_or_custom_color')==true;
      for(final key in colors.keys){final val=db.get(key);if(val is int&&val>=0&&val<=0xFFFFFFFF)colors[key]=val;}
      final encoded=db.get('custom_back_img_encode');
      if(db.get('is_custom_back_img')==true&&encoded is String&&encoded.isNotEmpty&&encoded.length<=3*1024*1024){
        try{base64Decode(encoded);background='data:image/jpeg;base64,$encoded';}catch(_){notice='旧背景无法读取，已恢复默认背景。';}
      }
    }catch(_){persistent=false;notice='浏览器存储暂不可用，本次设置仅在当前页面保留。';}
    initialized=true;if(!_disposed)notifyListeners();
  }
  @override void dispose(){_disposed=true;super.dispose();}
  Color color(String key)=>Color(customColor?colors[key]!:_defaults[key]!);
  static const _defaults={'page_back_color_value':0xFF111315,'setting_btn_color_value':0xFFD6EF36,'search_btn_color_value':0xFFFFB23F,'search_bar_text_color_value':0xFFF4F2E9,'search_bar_border_color_value':0xFF41484B,'search_bar_back_color_value':0xFF1B1E20};
  Future<void> save(String key,Object value) async {
    if(!_disposed)notifyListeners();
    if(!persistent)return;
    try{await db.put(key,value);}catch(_){persistent=false;notice='设置无法保存；当前页面仍可使用。';if(!_disposed)notifyListeners();}
  }
  Future<void> setBackground(String value) async {
    background=value;notice=value.isEmpty?'已恢复默认背景。':'本地背景已更新。';
    await save('custom_back_img_encode',value.split(',').last);
    await save('is_custom_back_img',value.isNotEmpty);
  }
  Future<void> reset() async {
    engine=0;alignment=4;width=1;fit=3;newTab=true;customColor=false;background='';colors.addAll(_defaults);
    notice='已恢复默认设置。';
    if(persistent){try{for(final key in ['engine_option','search_bar_align_option','search_bar_length_option','box_fit_option','is_jump_to_new_page','lock_or_custom_color','custom_back_img_encode','is_custom_back_img',...colors.keys]){await db.delete(key);}}catch(_){notice='页面已恢复默认，但浏览器存储清理失败。';}}
    if(!_disposed)notifyListeners();
  }
}

class FrequencySearch extends StatefulWidget {
  const FrequencySearch({super.key});
  @override State<FrequencySearch> createState()=>_FrequencySearchState();
}
class _FrequencySearchState extends State<FrequencySearch>{
  final prefs=SearchPreferences(),query=TextEditingController();final focus=FocusNode();String error='';
  static const alignments=[Alignment.topLeft,Alignment.topCenter,Alignment.topRight,Alignment.centerLeft,Alignment.center,Alignment.centerRight,Alignment.bottomLeft,Alignment.bottomCenter,Alignment.bottomRight];
  static const fits=[BoxFit.none,BoxFit.fill,BoxFit.scaleDown,BoxFit.cover,BoxFit.contain,BoxFit.fitWidth,BoxFit.fitHeight];
  @override void initState(){super.initState();prefs.addListener(refresh);prefs.init();}
  void refresh(){if(mounted)setState((){});}
  @override void dispose(){prefs.removeListener(refresh);prefs.dispose();query.dispose();focus.dispose();super.dispose();}
  void search(){try{final uri=searchUri(prefs.engine,query.text);browser.openSearch(uri.toString(),prefs.newTab);setState(()=>error='');}catch(e){setState(()=>error=e is FormatException?e.message:'无法打开搜索，请重试。');focus.requestFocus();}}
  Future<void> settings()async{await showDialog<void>(context:context,builder:(_)=>SearchSettings(prefs:prefs));if(mounted)focus.requestFocus();}
  @override Widget build(BuildContext context)=>Scaffold(backgroundColor:prefs.color('page_back_color_value'),body:Stack(children:[
    Positioned.fill(child:prefs.background.isEmpty?Image.asset('assets/img/background.jpg',fit:fits[prefs.fit],errorBuilder:(_,__,___)=>const SizedBox()):Image.memory(base64Decode(prefs.background.split(',').last),fit:fits[prefs.fit],errorBuilder:(_,__,___)=>const SizedBox())),
    Positioned.fill(child:ColoredBox(color:FrequencyPalette.background.withValues(alpha:0.82))),
    SafeArea(child:Column(children:[
      Padding(padding:const EdgeInsets.all(20),child:Row(children:[const Icon(Icons.search_rounded,color:FrequencyPalette.accent),const SizedBox(width:12),const Expanded(child:Text('频率搜索',style:TextStyle(fontSize:20,fontWeight:FontWeight.w700))),IconButton(onPressed:prefs.initialized?settings:null,tooltip:'打开搜索设置',icon:Icon(Icons.tune_rounded,color:prefs.color('setting_btn_color_value')))])),
      if(!prefs.initialized) const LinearProgressIndicator(),
      if(prefs.notice.isNotEmpty) Padding(padding:const EdgeInsets.symmetric(horizontal:20),child:Text(prefs.notice,style:const TextStyle(color:FrequencyPalette.amber))),
      Expanded(child:LayoutBuilder(builder:(context,c)=>SingleChildScrollView(child:ConstrainedBox(constraints:BoxConstraints(minHeight:c.maxHeight<480?480:c.maxHeight),child:Align(alignment:alignments[prefs.alignment],child:Padding(padding:const EdgeInsets.all(24),child:ConstrainedBox(constraints:BoxConstraints(maxWidth:[500.0,800.0,1000.0][prefs.width]),child:Column(mainAxisSize:MainAxisSize.min,crossAxisAlignment:CrossAxisAlignment.start,children:[
        const Text('FIND YOUR FREQUENCY',style:TextStyle(fontSize:12,color:FrequencyPalette.accent,letterSpacing:2)),const SizedBox(height:16),
        Text('下一段探索，\n从这里开始。',style:TextStyle(fontSize:c.maxWidth<700?36:60,height:1.15,fontWeight:FontWeight.w800)),const SizedBox(height:24),
        Wrap(spacing:12,runSpacing:8,children:List.generate(engineNames.length,(i)=>ChoiceChip(label:Text(engineNames[i]),selected:prefs.engine==i,onSelected:prefs.initialized?(_){prefs.engine=i;prefs.save('engine_option',i);}:null,selectedColor:FrequencyPalette.selected))),const SizedBox(height:16),
        TextField(controller:query,focusNode:focus,enabled:prefs.initialized,style:TextStyle(fontSize:18,color:prefs.color('search_bar_text_color_value')),textInputAction:TextInputAction.search,onSubmitted:(_)=>search(),onChanged:(_){if(error.isNotEmpty)setState(()=>error='');},decoration:InputDecoration(labelText:'你想寻找什么？',errorText:error.isEmpty?null:error,fillColor:prefs.color('search_bar_back_color_value'),enabledBorder:OutlineInputBorder(borderRadius:BorderRadius.circular(8),borderSide:BorderSide(color:prefs.color('search_bar_border_color_value'))),suffixIcon:IconButton(onPressed:prefs.initialized?search:null,tooltip:'开始搜索',icon:Icon(Icons.arrow_forward_rounded,color:prefs.color('search_btn_color_value'))))),const SizedBox(height:16),
        Text('Enter 搜索 · ${prefs.newTab?'在新标签打开':'在当前页面打开'} · 关键词交给 ${engineNames[prefs.engine]}',style:const TextStyle(color:FrequencyPalette.muted)),
      ])))))))),
      const Padding(padding:EdgeInsets.all(20),child:Text('一个入口，三种寻找方式。背景和偏好只存于本机。',textAlign:TextAlign.center,style:TextStyle(color:FrequencyPalette.muted))),
    ])),
  ]));
}

class SearchSettings extends StatefulWidget{final SearchPreferences prefs;const SearchSettings({super.key,required this.prefs});@override State<SearchSettings> createState()=>_SearchSettingsState();}
class _SearchSettingsState extends State<SearchSettings>{bool busy=false;String error='';int colorOption=0;final hex=TextEditingController();SearchPreferences get p=>widget.prefs;
  static const alignNames=['左上','顶部居中','右上','左中','居中','右中','左下','底部居中','右下'];static const fitNames=['原始大小','拉伸','缩小','覆盖','包含','适应宽度','适应高度'];
  static const colorNames=['页面背景','设置按钮','搜索按钮','搜索文字','搜索边框','搜索背景'];
  @override void initState(){super.initState();p.addListener(refresh);setHex();}
  void refresh(){if(mounted)setState((){});}
  void setHex()=>hex.text='#${p.colors.values.elementAt(colorOption).toRadixString(16).padLeft(8,'0').toUpperCase()}';
  @override void dispose(){p.removeListener(refresh);hex.dispose();super.dispose();}
  Future<void> pick()async{setState((){busy=true;error='';});try{final response=jsonDecode(await browser.pickBackground()) as Map<String,dynamic>;if(response['error']!=null)throw FormatException(response['error'] as String);if(response['cancelled']!=true)await p.setBackground(response['data'] as String);}catch(e){if(mounted)setState(()=>error=e is FormatException?e.message:'无法读取背景图片。');}finally{if(mounted)setState(()=>busy=false);}}
  Widget dropdown(String label,int value,List<String> names,void Function(int) change)=>DropdownButtonFormField<int>(initialValue:value,decoration:InputDecoration(labelText:label),isExpanded:true,items:List.generate(names.length,(i)=>DropdownMenuItem(value:i,child:Text(names[i]))),onChanged:(v){if(v!=null)change(v);});
  @override Widget build(BuildContext context)=>Dialog(insetPadding:const EdgeInsets.all(16),child:ConstrainedBox(constraints:const BoxConstraints(maxWidth:520,maxHeight:720),child:Column(children:[
    Padding(padding:const EdgeInsets.fromLTRB(24,16,16,8),child:Row(children:[const Expanded(child:Text('搜索设置',style:TextStyle(fontSize:24,fontWeight:FontWeight.w700))),IconButton(onPressed:()=>Navigator.pop(context),tooltip:'关闭设置',icon:const Icon(Icons.close_rounded))])),
    Expanded(child:SingleChildScrollView(padding:const EdgeInsets.all(24),child:Column(crossAxisAlignment:CrossAxisAlignment.start,children:[
      SwitchListTile(contentPadding:EdgeInsets.zero,title:const Text('搜索结果在新标签打开'),value:p.newTab,onChanged:(v){p.newTab=v;p.save('is_jump_to_new_page',v);}),const SizedBox(height:16),
      dropdown('搜索区域位置',p.alignment,alignNames,(v){p.alignment=v;p.save('search_bar_align_option',v);}),const SizedBox(height:16),dropdown('搜索区域宽度',p.width,['紧凑','标准','宽阔'],(v){p.width=v;p.save('search_bar_length_option',v);}),const SizedBox(height:24),
      const Text('你的背景',style:TextStyle(fontSize:18,fontWeight:FontWeight.w700)),const SizedBox(height:8),const Text('自动缩小至最长边 1920 px。图片只保存在此浏览器。',style:TextStyle(color:FrequencyPalette.muted)),const SizedBox(height:12),
      Wrap(spacing:12,runSpacing:12,children:[OutlinedButton.icon(onPressed:busy?null:pick,icon:const Icon(Icons.image_outlined),label:Text(busy?'读取中…':'选择本地背景')),TextButton(onPressed:busy?null:(){setState(()=>error='');p.setBackground('');},child:const Text('恢复默认背景'))]),const SizedBox(height:16),dropdown('背景适配',p.fit,fitNames,(v){p.fit=v;p.save('box_fit_option',v);}),const SizedBox(height:24),
      SwitchListTile(contentPadding:EdgeInsets.zero,title:const Text('自定义颜色'),subtitle:const Text('关闭时使用频率站默认配色'),value:p.customColor,onChanged:(v){p.customColor=v;p.save('lock_or_custom_color',v);}),
      if(p.customColor)...[const SizedBox(height:16),dropdown('颜色对象',colorOption,colorNames,(v)=>setState((){colorOption=v;setHex();})),const SizedBox(height:16),TextField(controller:hex,decoration:const InputDecoration(labelText:'ARGB / #AARRGGBB')),const SizedBox(height:12),OutlinedButton(onPressed:(){final raw=hex.text.trim().replaceFirst(RegExp(r'^#'),'');if(!RegExp(r'^[0-9a-fA-F]{8}$').hasMatch(raw)){setState(()=>error='请输入 8 位 ARGB，如 #FFF4F2E9。');return;}final key=p.colors.keys.elementAt(colorOption);p.colors[key]=int.parse(raw,radix:16);p.save(key,p.colors[key]!);setState(()=>error='');},child:const Text('应用颜色'))],
      if(error.isNotEmpty) Padding(padding:const EdgeInsets.only(top:16),child:Text(error,style:const TextStyle(color:FrequencyPalette.error))),
      if(error.isEmpty&&p.notice.isNotEmpty) Padding(padding:const EdgeInsets.only(top:16),child:Text(p.notice,style:const TextStyle(color:FrequencyPalette.amber))),const SizedBox(height:24),
      const Text('恢复默认仅清除此搜索页的偏好，不清理其他应用缓存。',style:TextStyle(color:FrequencyPalette.muted)),const SizedBox(height:12),TextButton.icon(onPressed:busy?null:()async{await p.reset();if(mounted)setState((){setHex();error='';});},icon:const Icon(Icons.restart_alt_rounded),label:const Text('恢复全部默认设置')),
    ]))),
  ])));
}
