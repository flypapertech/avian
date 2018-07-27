"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const merge = require("webpack-merge");
const webpack_common_1 = require("./webpack.common");
const componentsProdSpecificConfig = {
    mode: "production"
};
const servicesProdSpecificConfig = {
    mode: "production"
};
exports.ComponentsConfig = merge(webpack_common_1.ComponentsCommmonConfg, componentsProdSpecificConfig);
exports.ServicesConfig = merge(webpack_common_1.ServicesCommonConfig, servicesProdSpecificConfig);
