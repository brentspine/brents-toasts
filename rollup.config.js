import { readFileSync } from 'node:fs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url)));

// Inlines `import css from './file.css'` as a plain string export, so the
// library can ship CSS as JS-injected <style> content without a runtime CSS loader.
function css() {
    return {
        name: 'css-to-string',
        transform(code, id) {
            if (!id.endsWith('.css')) return null;
            return { code: `export default ${JSON.stringify(code)};`, map: { mappings: '' } };
        }
    };
}

// Inlines `import x from './file.json'` as a plain JS object-literal export
// (JSON text is already valid as a JS expression, unlike CSS text) — the
// same "no bundler-specific import support needed downstream" contract
// css() gives the CJS/UMD outputs, applied to the bundled locale data.
function json() {
    return {
        name: 'json-to-module',
        transform(code, id) {
            if (!id.endsWith('.json')) return null;
            return { code: `export default ${code};`, map: { mappings: '' } };
        }
    };
}

// Resolves `import version from 'virtual:version'` to package.json's version,
// so the published version doesn't need to be duplicated in source.
function version() {
    return {
        name: 'version-virtual-module',
        resolveId(id) {
            return id === 'virtual:version' ? id : null;
        },
        load(id) {
            if (id === 'virtual:version') return `export default ${JSON.stringify(pkg.version)};`;
        }
    };
}

export default [
    {
        input: 'src/index.ts',
        output: [
            { file: 'dist/index.esm.js', format: 'esm', exports: 'named' },
            { file: 'dist/index.esm.min.js', format: 'esm', exports: 'named', plugins: [terser()] },
            { file: 'dist/index.cjs',    format: 'cjs', exports: 'named' },
            { file: 'dist/index.umd.js', format: 'umd', exports: 'named', name: 'BrentsToasts' },
            { file: 'dist/index.umd.min.js', format: 'umd', exports: 'named', name: 'BrentsToasts', plugins: [terser()] }
        ],
        plugins: [css(), json(), version(), typescript({ compilerOptions: { declaration: false, noEmit: false } })]
    },
    {
        input: 'src/index.ts',
        output: { file: 'dist/index.d.ts', format: 'es' },
        plugins: [css(), json(), version(), dts()]
    }
];
