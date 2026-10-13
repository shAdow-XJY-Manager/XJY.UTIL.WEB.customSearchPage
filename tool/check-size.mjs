import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? files(file) : [file];
  });
}
export function checkSize(directory, zip) {
  const entries = files(directory);
  const bytes = entries.reduce((sum, file) => sum + fs.statSync(file).size, 0);
  const forbidden = entries.filter(file => /\.(ttf|otf|woff2?|wasm|map)$/i.test(file) || /flutter|canvaskit/i.test(path.relative(directory, file)));
  if (forbidden.length) throw new Error(`Forbidden runtime resources: ${forbidden.join(', ')}`);
  if (bytes > 400 * 1024) throw new Error(`Extension exceeds 400 KiB: ${bytes} bytes`);
  const zipped = fs.statSync(zip).size;
  if (zipped > 200 * 1024) throw new Error(`ZIP exceeds 200 KiB: ${zipped} bytes`);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.manifest_version !== 3 || manifest.chrome_url_overrides?.newtab !== 'index.html' ||
      JSON.stringify(manifest.permissions) !== '["favicon"]' || JSON.stringify(manifest.optional_permissions) !== '["topSites"]' ||
      manifest.host_permissions?.length || manifest.optional_host_permissions?.length || /unsafe-eval|wasm/.test(manifest.content_security_policy.extension_pages)) {
    throw new Error('Unexpected extension capabilities');
  }
  console.log(`Extension ${(bytes / 1024).toFixed(1)} KiB; ZIP ${(zipped / 1024).toFixed(1)} KiB (${entries.length} files)`);
  return { bytes, zipped, files: entries.length };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
  checkSize(path.join(root, 'build/extension'), path.join(root, `build/releases/frequency-search-${version}.zip`));
}
