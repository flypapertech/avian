"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const merge = require("webpack-merge");
const webpack_common_1 = require("./webpack.common");
const componentsProdSpecificConfig = {
    output: {
        filename: "[name].bundle.[chunkhash].js"
    },
    mode: "production"
};
const servicesProdSpecificConfig = {
    mode: "production"
};
exports.ComponentsProdConfig = merge(webpack_common_1.ComponentsCommmonConfg, componentsProdSpecificConfig);
exports.ServicesProdConfig = merge(webpack_common_1.ServicesCommonConfig, servicesProdSpecificConfig);
