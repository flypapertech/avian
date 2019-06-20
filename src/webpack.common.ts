import * as webpack from "webpack"
import * as VueLoader from "vue-loader"
import * as path from "path"
import nodeExternals = require("webpack-node-externals")
import { argv } from "./avian.lib"

const WebpackWatchedGlobEntries = require("webpack-watched-glob-entries-plugin")

function srcPath(subdir: string) {
    return path.join(argv.home, subdir)
}

const componentsCommonConfig: webpack.Configuration = {
    entry: WebpackWatchedGlobEntries.getEntries([
        `${argv.home}/components/**/*.client.*`
        ]
    ),
    output: {
        path: `${argv.home}/public`,
        filename: "[name].bundle.js",
        publicPath: "/"
    },
    resolve: {
        extensions: [`.${argv.mode}.ts`, ".ts", ".js", ".vue", ".json", ".pug", ".less"],
        alias: {
            vue$: "vue/dist/vue.js",
            "components": srcPath("components")
        }
    },
    plugins: [
        new WebpackWatchedGlobEntries(),
        new VueLoader.VueLoaderPlugin()
    ],
    module : {
        rules: [
            {
                test: /\.jsx$/,
                exclude: /node_modules/,
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
                test: /\.pug$/,
                oneOf: [
                    // this applies to `<template lang="pug">` in Vue components
                    {
                        resourceQuery: /^\?vue/,
                        use: ["pug-plain-loader"]
                    }
                ]
            },
            {
                test: /\.css$/,
                use: [
                    "css-loader"
                ]
            },
            {
                test: /\.less$/,
                use: [
                    "css-loader",
                    "less-loader"
                ]
            },
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: "babel-loader",
                    options: {
                        presets: ["@babel/preset-env"],
                        plugins: [require("@babel/plugin-syntax-dynamic-import").default]
                    }
                }
            },
            {
                test: /\.tsx?$/,
                exclude: /node_modules/,
                loaders: [
                    {
                        loader: "babel-loader",
                        options: {
                            presets: ["@babel/preset-env"],
                            plugins: [require("@babel/plugin-syntax-dynamic-import").default]
                        }
                    },
                    {
                        loader: "ts-loader",
                        options: {
                            appendTsSuffixTo: [/\.vue$/]
                        }
                    }
                ]
            }
        ]
    }
}

const servicesCommonConfig: webpack.Configuration = {
    target: "node",
    entry: WebpackWatchedGlobEntries.getEntries([
            `${argv.home}/components/**/*.service.*`
        ]
    ),
    output: {
        path: `${argv.home}/private`,
        filename: "[name].js",
        libraryTarget: "commonjs2"
    },
    resolve: {
        extensions: [`.${argv.mode}.ts`, ".ts", ".js", ".json"],
        alias: {
            "components": srcPath("components")
        }
    },
    plugins: [
        new WebpackWatchedGlobEntries()
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
