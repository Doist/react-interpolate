import babel from 'rollup-plugin-babel'
import pkg from './package.json'
import copy from 'rollup-plugin-copy'

export default {
    input: 'src/index.js',
    output: [
        {
            file: pkg.main,
            format: 'cjs',
        },
        {
            file: pkg.module,
            format: 'es',
        },
    ],
    plugins: [
        babel({ runtimeHelpers: true }),
        copy({
            targets: [{ src: 'src/react-interpolate.d.ts', dest: 'dist' }],
        }),
    ],
}
