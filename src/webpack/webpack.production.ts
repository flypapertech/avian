import * as webpack from "webpack"
import { merge }  from "webpack-merge"
import { ComponentsCommmonConfig, ServerCommonConfig } from "./webpack.common"

const componentsProdSpecificConfig: webpack.Configuration = {
    mode: "production"
}

const serverProdSpecificConfig: webpack.Configuration = {
    mode: "production"
}

export let ComponentsConfig = merge(ComponentsCommmonConfig, componentsProdSpecificConfig)
export let ServerConfig = merge(ServerCommonConfig, serverProdSpecificConfig)
