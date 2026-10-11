import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import '../app_target.dart';
import '../search_logic.dart';
import 'index_db.dart';

class SearchPreferences extends ChangeNotifier {
  SearchPreferences({IndexDB? database}) : db = database ?? IndexDB();

  bool _disposed = false;
  final IndexDB db;
  bool initialized = false, persistent = true;
  bool newTab = defaultSearchNewTab, customColor = false;
  int engine = 0, alignment = 4, width = 1, fit = 3;
  double overlay = defaultOverlay;
  String background = '', notice = '';

  static const defaultOverlay = 0.45;
  static const overlayKey = 'background_overlay_opacity';
  static const _defaults = {
    'page_back_color_value': 0xFF111315,
    'setting_btn_color_value': 0xFFD6EF36,
    'search_btn_color_value': 0xFFFFB23F,
    'search_bar_text_color_value': 0xFFF4F2E9,
    'search_bar_border_color_value': 0xFF41484B,
    'search_bar_back_color_value': 0xFF1B1E20,
  };
  final colors = Map<String, int>.from(_defaults);

  void _notify() {
    if (!_disposed) notifyListeners();
  }

  Future<void> init() async {
    try {
      await db.init();
      engine = safeOption(db.get('engine_option'), 3, 0);
      alignment = safeOption(db.get('search_bar_align_option'), 9, 4);
      width = safeOption(db.get('search_bar_length_option'), 3, 1);
      fit = safeOption(db.get('box_fit_option'), 7, 3);
      final storedNewTab = db.get('is_jump_to_new_page');
      newTab = storedNewTab is bool ? storedNewTab : defaultSearchNewTab;
      customColor = db.get('lock_or_custom_color') == true;
      final storedOverlay = db.get(overlayKey);
      if (storedOverlay is num &&
          storedOverlay.isFinite &&
          storedOverlay >= 0 &&
          storedOverlay <= 1) {
        overlay = storedOverlay.toDouble();
      }
      for (final key in colors.keys) {
        final value = db.get(key);
        if (value is int && value >= 0 && value <= 0xFFFFFFFF) {
          colors[key] = value;
        }
      }
      final encoded = db.get('custom_back_img_encode');
      if (db.get('is_custom_back_img') == true) {
        if (encoded is String &&
            encoded.isNotEmpty &&
            encoded.length <= 3 * 1024 * 1024) {
          try {
            base64Decode(encoded);
            background = 'data:image/jpeg;base64,$encoded';
          } catch (_) {
            notice = '旧背景无法读取，已恢复默认背景。';
          }
        } else {
          notice = '旧背景无法读取，已恢复默认背景。';
        }
      }
    } catch (_) {
      persistent = false;
      notice = '浏览器存储暂不可用，本次设置仅在当前页面保留。';
    }
    initialized = true;
    if (_disposed) {
      await db.close();
    } else {
      _notify();
    }
  }

  @override
  void dispose() {
    _disposed = true;
    if (initialized) unawaited(db.close());
    super.dispose();
  }

  Color color(String key) =>
      Color(customColor ? colors[key]! : _defaults[key]!);

  Future<void> save(String key, Object value) async {
    _notify();
    if (!persistent) {
      notice = '设置未保存，仅在当前页面生效。';
      _notify();
      return;
    }
    try {
      await db.put(key, value);
    } catch (_) {
      persistent = false;
      notice = '设置未保存，仅在当前页面生效。';
      _notify();
    }
  }

  void previewOverlay(double value) {
    overlay = value.clamp(0.0, 1.0);
    _notify();
  }

  Future<void> saveOverlay(double value) {
    previewOverlay(value);
    return save(overlayKey, overlay);
  }

  Future<void> setBackground(String value) async {
    if (persistent) {
      try {
        await db.putAll({
          'custom_back_img_encode': value.split(',').last,
          'is_custom_back_img': value.isNotEmpty,
        });
        background = value;
        notice = value.isEmpty ? '已恢复默认背景。' : '本地背景已保存。';
      } catch (_) {
        notice = '背景未保存，已保留原背景。请检查浏览器存储后重试。';
      }
    } else {
      background = value;
      notice = '背景未保存，仅在当前页面生效。';
    }
    _notify();
  }

  Future<void> reset() async {
    if (persistent) {
      try {
        await db.deleteKeys([
          'engine_option',
          'search_bar_align_option',
          'search_bar_length_option',
          'box_fit_option',
          'is_jump_to_new_page',
          'lock_or_custom_color',
          'custom_back_img_encode',
          'is_custom_back_img',
          overlayKey,
          ...colors.keys,
        ]);
      } catch (_) {
        notice = '未能恢复默认设置，已保留当前设置。请检查浏览器存储后重试。';
        _notify();
        return;
      }
    }
    engine = 0;
    alignment = 4;
    width = 1;
    fit = 3;
    newTab = defaultSearchNewTab;
    customColor = false;
    background = '';
    overlay = defaultOverlay;
    colors.addAll(_defaults);
    notice = persistent ? '已恢复默认设置。' : '已恢复默认设置，仅在当前页面生效。';
    _notify();
  }
}
