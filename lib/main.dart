import 'package:flutter/material.dart';
import 'frequency_search.dart';
import 'theme/frequency_theme.dart';
void main()=>runApp(const MyApp());
class MyApp extends StatelessWidget{
  const MyApp({super.key});
  @override Widget build(BuildContext context)=>MaterialApp(title:'频率搜索',debugShowCheckedModeBanner:false,theme:FrequencyTheme.dark(),home:const FrequencySearch());
}
