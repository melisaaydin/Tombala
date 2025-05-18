module.exports = {
    webpack: {
        configure: {
            entry: './src/main.jsx',
        },
    },
    babel: {
        presets: [
            '@babel/preset-env',
            ['@babel/preset-react', { runtime: 'automatic' }],
        ],
        plugins: [],
    },
};