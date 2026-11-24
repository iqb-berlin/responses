const { execFileSync } = require('node:child_process');
const { copyFileSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');

const root = resolve(__dirname, '..');
const dist = join(root, 'dist');
const compiler = join(dirname(require.resolve('typescript/package.json')), 'bin/tsc');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

for (const args of [
  ['--module', 'NodeNext', '--moduleResolution', 'NodeNext'],
  ['--outDir', join(dist, 'esm')]
]) {
  execFileSync(process.execPath, [compiler, '--project', 'tsconfig.json', ...args], {
    cwd: root, stdio: 'inherit'
  });
}

writeFileSync(join(dist, 'esm/package.json'), JSON.stringify({ type: 'module' }) + '\n');
copyFileSync(join(root, 'README.md'), join(dist, 'README.md'));
copyFileSync(join(root, 'package_npm.json'), join(dist, 'package.json'));
