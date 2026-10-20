/* Build-time compiler tooling is not a runtime package dependency. */
/* eslint-disable import/no-extraneous-dependencies */
const { execFileSync } = require('node:child_process');
const {
  copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync
} = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const ts = require('typescript');

const root = resolve(__dirname, '..');
const dist = join(root, 'dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// Keep the established CommonJS files and declarations at their existing paths.
execFileSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--module', 'commonjs'], {
  cwd: root, stdio: 'inherit'
});

const config = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root, {
  module: ts.ModuleKind.ES2020, outDir: join(dist, 'esm')
});

// Node ESM requires explicit file extensions, including imports in declarations.
// Transform while emitting so the generated source maps remain correct.
function explicitExtensions(context) {
  return sourceFile => {
    const specifier = original => {
      const value = original.text;
      // These specification packages expose files directly, without an exports map.
      // Their deep declaration imports also need a .js suffix under NodeNext.
      if (value.startsWith('@iqbspecs/') && value.split('/').length > 2 && !value.endsWith('.js')) {
        require.resolve(`${value}.js`);
        return ts.factory.createStringLiteral(`${value}.js`);
      }
      if (!value.startsWith('.')) return original;
      const target = resolve(dirname(sourceFile.fileName), value);
      if (existsSync(`${target}.ts`)) return ts.factory.createStringLiteral(`${value}.js`);
      if (existsSync(join(target, 'index.ts'))) return ts.factory.createStringLiteral(`${value}/index.js`);
      throw new Error(`Unresolved relative ESM import: ${sourceFile.fileName}: ${value}`);
    };
    const visit = node => {
      if (ts.isImportDeclaration(node)) {
        return ts.factory.updateImportDeclaration(
          node,
          node.modifiers,
          node.importClause,
          specifier(node.moduleSpecifier),
          node.attributes
        );
      }
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        return ts.factory.updateExportDeclaration(
          node,
          node.modifiers,
          node.isTypeOnly,
          node.exportClause,
          specifier(node.moduleSpecifier),
          node.attributes
        );
      }
      return ts.visitEachChild(node, visit, context);
    };
    return ts.visitNode(sourceFile, visit);
  };
}

const program = ts.createProgram(parsed.fileNames, parsed.options);
const emitted = program.emit(undefined, undefined, undefined, undefined, {
  before: [explicitExtensions], afterDeclarations: [explicitExtensions]
});
const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program), ...emitted.diagnostics];
if (diagnostics.length || emitted.emitSkipped) {
  process.stderr.write(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: path => path,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n'
  }));
  process.exitCode = 1;
} else {
  writeFileSync(join(dist, 'esm/package.json'), `${JSON.stringify({ type: 'module' }, null, 2)}\n`);
  const manifest = JSON.parse(readFileSync(join(root, 'package_npm.json'), 'utf8'));
  copyFileSync(join(root, 'README.md'), join(dist, 'README.md'));
  writeFileSync(join(dist, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
}
