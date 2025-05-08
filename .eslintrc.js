module.exports = {
    root: true,
    env: {
        browser: true,
        es2021: true,
        webextensions: true,
        worker: true,
    },
    extends: [
        'eslint:recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:prettier/recommended',
    ],
    parserOptions: {
        ecmaVersion: 12,
        sourceType: 'module',
    },
    plugins: ['import', 'prettier'],
    rules: {
        'no-unused-vars': 'warn',
        'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
        'prettier/prettier': 'warn',
        'import/no-unresolved': 'off',
        'import/named': 'off',
    },
    settings: {
        'import/resolver': {},
    },
};
