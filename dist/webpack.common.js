"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const VueLoader = require("vue-loader");
const chalk_1 = require("chalk");
const path = require("path");
const nodeExternals = require("webpack-node-externals");
const yargs = require("yargs");
const ProgressBarPlugin = require("progress-bar-webpack-plugin");
const WebpackWatchedGlobEntries = require("webpack-watched-glob-entries-plugin");
const argv = yargs.argv;
argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd();
argv.mode = argv.mode || process.env.AVIAN_APP_MODE || "development";
function srcPath(subdir) {
    return path.join(argv.home, subdir);
}
const componentsCommonConfig = {
    entry: WebpackWatchedGlobEntries.getEntries([
        `${argv.home}/components/**/*.component.*`
    ]),
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
};
const servicesCommonConfig = {
    target: "node",
    entry: WebpackWatchedGlobEntries.getEntries([
        `${argv.home}/components/**/*.service.*`
    ]),
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
        new WebpackWatchedGlobEntries(),
        new ProgressBarPlugin({
            format: "Compiling Service Files [:bar] " + chalk_1.default.green.bold(" :percent"),
            clear: false
        })
    ],
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
