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
        ],
        plugins: ['@babel/plugin-transform-runtime'],
    }
}
