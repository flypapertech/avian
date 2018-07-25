import * as webpack from "webpack"
import * as WebpackWatchedGlobEntries from "webpack-watched-glob-entries-plugin"
import * as ProgressBarPlugin from "progress-bar-webpack-plugin"
import chalk from "chalk"

const nodeExternals = require("webpack-node-externals")
const argv = require("yargs").argv
argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd()

const componentsCommonConfig: webpack.Configuration = {
    entry: WebpackWatchedGlobEntries.getEntries(
        `${argv.home}/components/**/*.component.*`
    ),
    output: {
        path: `${argv.home}/public`,
        filename: "[name].bundle.js",
    },
    resolve: {
        extensions: [".ts", ".js", ".vue", ".json"],
        alias: {
            vue$: "vue/dist/vue.js"
        }
    },
    plugins: [
        new WebpackWatchedGlobEntries(),
        new ProgressBarPlugin({
            format: "Compiling Component Files [:bar] " + chalk.green.bold(" :percent"),
            clear: false
        })
    ],
    externals: {
        vue: "Vue",
        vuetify: "Vuetify",
        ajv: "Ajv",
        axios: "axios"
    },
    module : {
        rules: [
            {
                test: /\.jsx$/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-react"]
                    }
                }
            },
            {
                test: /\.vue$/,
                use: {
                    loader: "vue-loader"
                }
            },
            {
                test: /\.js$/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"]
                    }
                }
            },
            {
                test: /\.tsx?$/,
                loaders: ["babel-loader", "ts-loader"]
            }
        ]
    }
}

const servicesCommonConfig: webpack.Configuration = {
    target: "node",
    entry: WebpackWatchedGlobEntries.getEntries(
        `${argv.home}/components/**/*.service.*`
    ),
    output: {
        path: `${argv.home}/private`,
        filename: "[name].js",
        libraryTarget: "commonjs2"
    },
    resolve: {
        extensions: [".ts", ".js", ".json"],
    },
    plugins: [
        new WebpackWatchedGlobEntries(),
        new ProgressBarPlugin({
            format: "Compiling Service Files [:bar] " + chalk.green.bold(" :percent"),
            clear: false
        })
    ],
    // externals: [nodeExternals(), /\.pug$/, /\.less$/, /\.css$/],
    externals: [nodeExternals()],
    module : {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"]
                    }
                }
            },
            {
                test: /\.tsx?$/,
                loaders: ["babel-loader", "ts-loader"]
            }
        ]
    }
}

export let ComponentsCommmonConfg = componentsCommonConfig
export let ServicesCommonConfig = servicesCommonConfig