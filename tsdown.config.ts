import { defineConfig } from 'tsdown'

export default defineConfig({
    entry: ['./src/index.ts'],
    format: ['esm', 'cjs'],
    platform: 'neutral',
    target: 'es2020',
    outDir: 'dist',
    clean: true,
    dts: true,
    cjsDefault: false,
    inputOptions: {
        transform: {
            jsx: 'react',
        },
    },
})
