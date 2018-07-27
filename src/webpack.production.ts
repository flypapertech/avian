import * as webpack from "webpack"
import * as merge from "webpack-merge"
import {ComponentsCommmonConfg, ServicesCommonConfig} from "./webpack.common"

const componentsProdSpecificConfig: webpack.Configuration = {
    mode: "production"
}

const servicesProdSpecificConfig: webpack.Configuration = {
    mode: "production"
}

export let ComponentsConfig = merge(ComponentsCommmonConfg, componentsProdSpecificConfig)
export let ServicesConfig = merge(ServicesCommonConfig, servicesProdSpecificConfig)