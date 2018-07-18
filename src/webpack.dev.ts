import * as webpack from "webpack"
import * as merge from "webpack-merge"
import {ComponentsCommmonConfg, ServicesCommonConfig} from "./webpack.common"

const componentsDevSpecificConfig: webpack.Configuration = {
    devtool: "inline-source-map",
    mode: "development"
}

const servicesDevSpecificConfig: webpack.Configuration = {
    mode: "development"
}

export let ComponentsDevConfig = merge(ComponentsCommmonConfg, componentsDevSpecificConfig)
export let ServicesDevConfig = merge(ServicesCommonConfig, servicesDevSpecificConfig)