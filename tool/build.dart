import 'dart:io';

// Compatibility entry point. The native production build requires Node.js, not Flutter.
Future<void> main(List<String> args) async {
  final root = File.fromUri(Platform.script).parent.parent.path;
  try {
    final process = await Process.start('node', ['tool/build.mjs', ...args],
        workingDirectory: root, mode: ProcessStartMode.inheritStdio);
    exitCode = await process.exitCode;
  } on ProcessException catch (error) {
    stderr.writeln('Install Node.js 22.12+ and run npm ci first. $error');
    exitCode = 1;
  }
}
