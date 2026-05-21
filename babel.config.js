module.exports = function (api) {
    api.cache(true)

    return {
        presets: [
            [
                '@babel/preset-env',
                {
                    targets: {
                        browsers: ['IE 11'],
                    },
                },
            ],
            '@babel/react',
            '@babel/preset-typescript',
        ],
        plugins: ['@babel/plugin-transform-runtime'],
    }
}
