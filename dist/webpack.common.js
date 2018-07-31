"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const WebpackWatchedGlobEntries = require("webpack-watched-glob-entries-plugin");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");
const VueLoader = require("vue-loader");
const chalk_1 = require("chalk");
const nodeExternals = require("webpack-node-externals");
const argv = require("yargs").argv;
argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd();
const componentsCommonConfig = {
    entry: WebpackWatchedGlobEntries.getEntries(`${argv.home}/components/**/*.component.*`),
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
            format: "Compiling Component Files [:bar] " + chalk_1.default.green.bold(" :percent"),
            clear: false
        }),
        new VueLoader.VueLoaderPlugin()
    ],
    module: {
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
                loaders: [
                    {
                        loader: "babel-loader"
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
};
const servicesCommonConfig = {
    target: "node",
    entry: WebpackWatchedGlobEntries.getEntries(`${argv.home}/components/**/*.service.*`),
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
            format: "Compiling Service Files [:bar] " + chalk_1.default.green.bold(" :percent"),
            clear: false
        })
    ],
    // externals: [nodeExternals(), /\.pug$/, /\.less$/, /\.css$/],
    externals: [nodeExternals()],
    module: {
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
};
exports.ComponentsCommmonConfg = componentsCommonConfig;
exports.ServicesCommonConfig = servicesCommonConfig;
