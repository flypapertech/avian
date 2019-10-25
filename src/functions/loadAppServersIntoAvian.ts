import * as express from "express"
import * as path from "path"
import * as glob from "fast-glob"
import * as fs from "graceful-fs"
import { argv } from "../avian.lib"

/**
 * Loads app services into avian
 * @param avian 
 */
export default async function loadAppServersIntoAvian(avian: express.Express) {

    const compiledServerFiles = glob.sync([`${argv.home}/private/**/*.service.js`, "!avian.service.js"])

    if (fs.existsSync(`${argv.home}/private/avian.service.js`)) {
        compiledServerFiles.unshift(`${argv.home}/private/avian.service.js`)
    }

    for (let i = 0 ; i < compiledServerFiles.length ; i++) {
        const dirname = path.dirname(compiledServerFiles[i])
        const directories = dirname.split("/")
        const routeArray = []
        for (let j = directories.length - 1 ; j >= 0 ; j--) {
            if (directories[j] !== "private") {
                routeArray.unshift(directories[j])
            } else {
                break
            }
        }

        if (routeArray.length === 0) {
            const basename = path.basename(compiledServerFiles[i])
            if (basename !== "avian.service.js") {
                const nameArray = basename.split(".")
                for (let j = 0 ; j < nameArray.length ; j++) {
                    if (nameArray[j] !== "service") {
                        routeArray.push(nameArray[j])
                    } else {
                        break
                    }
                }
            }
        }

        const routeBase = "/" + routeArray.join("/")
        try {
            const service = await import (`${compiledServerFiles[i]}`)
            let compiledService: any
            if (service.default) {
                compiledService = service.default
            } else {
                compiledService = service
            }
            if (Object.getPrototypeOf(compiledService) === express.Router) {
                avian.use(routeBase, compiledService)
            } else if (typeof compiledService === "function") {
                try {
                    avian.use(routeBase, compiledService(avian))
                } catch (error) {
                    console.log("Skipping service file " + compiledServerFiles[i] + " it's default export isn't an express.Router")
                }
            }
        } catch (err) {
            console.error(err)
        }
    }
}
