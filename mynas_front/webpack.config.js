const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    mode: 'development',
    entry: {
        index: './src/js/index/index.js',
        settings: './src/js/settings/index.js'
    },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].bundle.js',
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env']
                    }
                }
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader']
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource',
            }
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/pages/index/index.html',
            filename: 'index.html',
            chunks: ['index']
        }),
        new HtmlWebpackPlugin({
            template: './src/pages/settings/index.html',
            filename: 'settings.html',
            chunks: ['settings']
        })
    ],
    devServer: {
        static: {
            directory: path.join(__dirname, 'dist'),
        },
        compress: true,
        port: 9000,
    }
}; 