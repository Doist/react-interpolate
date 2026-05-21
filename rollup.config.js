import { babel } from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import pkg from './package.json'

const extensions = ['.js', '.jsx', '.ts', '.tsx']

export default {
    input: 'src/index.ts',
    external: [...Object.keys(pkg.peerDependencies || {}), /@babel\/runtime/],
    output: [
        {
            file: pkg.main,
            format: 'cjs',
            exports: 'named',
        },
        {
            file: pkg.module,
            format: 'es',
        },
    ],
    plugins: [
        nodeResolve({ extensions }),
        babel({
            babelHelpers: 'runtime',
            extensions,
            exclude: /node_modules/,
        }),
    ],
}
