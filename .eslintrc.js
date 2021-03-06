const config = {
    extends: [
        "eslint:recommended",
        "plugin:react/recommended",
        "prettier",
        "prettier/react",
        "plugin:compat/recommended"
    ],
    env: {
        browser: true,
        "jest/globals": true
    },
    parserOptions: {
        ecmaFeatures: {
            jsx: true,
            impliedStrict: true
        },
        sourceType: "module"
    },
    plugins: ["react", "prettier", "react-hooks", "jest"],
    parser: "babel-eslint",
    rules: {
        semi: ["error", "never"],
        "arrow-parens": ["error", "as-needed"],
        "prettier/prettier": "error",
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "error"
    },
    settings: {
        react: {
            version: "16.0"
        }
    }
}

module.exports = config
