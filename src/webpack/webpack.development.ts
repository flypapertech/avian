import * as webpack from "webpack"
import * as merge from "webpack-merge"
import { ComponentsCommmonConfig, ServicesCommonConfig } from "./webpack.common"

const componentsDevSpecificConfig: webpack.Configuration = {
    devtool: "inline-source-map",
    mode: "development"
}

const servicesDevSpecificConfig: webpack.Configuration = {
    mode: "development"
}

export let ComponentsConfig = merge(ComponentsCommmonConfig, componentsDevSpecificConfig)
export let ServicesConfig = merge(ServicesCommonConfig, servicesDevSpecificConfig)
