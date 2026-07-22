import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import terser from '@rollup/plugin-terser';

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
        plugins: [typescript({ compilerOptions: { declaration: false, noEmit: false } })]
    },
    {
        input: 'src/index.ts',
        output: { file: 'dist/index.d.ts', format: 'es' },
        plugins: [dts()]
    }
];
