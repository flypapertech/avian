"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const merge = require("webpack-merge");
const webpack_common_1 = require("./webpack.common");
const componentsDevSpecificConfig = {
    devtool: "inline-source-map",
    mode: "development"
};
const servicesDevSpecificConfig = {
    mode: "development"
};
exports.ComponentsDevConfig = merge(webpack_common_1.ComponentsCommmonConfg, componentsDevSpecificConfig);
exports.ServicesDevConfig = merge(webpack_common_1.ServicesCommonConfig, servicesDevSpecificConfig);
