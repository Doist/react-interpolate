module.exports = function(api) {
    api.cache(true)

    const presets = [
        [
            "@babel/preset-env",
            {
                targets: {
                    browsers: ["IE 11"]
                }
            }
        ],
        "@babel/react"
    ]

    return {
        presets
    }
}
