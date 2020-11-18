import * as webpack from "webpack"
import { merge } from "webpack-merge"
import { ComponentsCommmonConfig, ServerCommonConfig } from "./webpack.common"

const componentsDevSpecificConfig: webpack.Configuration = {
    devtool: "inline-source-map",
    mode: "development"
}

const serverDevSpecificConfig: webpack.Configuration = {
    mode: "development"
}

export let ComponentsConfig = merge(ComponentsCommmonConfig, componentsDevSpecificConfig)
export let ServerConfig = merge(ServerCommonConfig, serverDevSpecificConfig)
