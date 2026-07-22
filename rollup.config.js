import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';

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
        plugins: [css(), typescript({ compilerOptions: { declaration: false, noEmit: false } })]
    },
    {
        input: 'src/index.ts',
        output: { file: 'dist/index.d.ts', format: 'es' },
        plugins: [css(), dts()]
    }
];
