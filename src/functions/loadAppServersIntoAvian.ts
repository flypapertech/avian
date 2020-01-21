import * as express from "express"
import * as path from "path"
import * as glob from "fast-glob"
import * as fs from "graceful-fs"
import { argv } from "../avian.lib"

/**
 * Loads app routes into avian
 * @param avian 
 */
export async function loadAppRoutesIntoAvian(avian: express.Express) {

    const compiledServerRouteFiles = glob.sync([`${argv.home}/private/**/*.server.routes.*.js`, "!server.routes.js"]).sort()
    if (fs.existsSync(`${argv.home}/private/server.routes.js`)) {
        compiledServerRouteFiles.unshift(`${argv.home}/private/server.routes.js`)
    }

    for (let i = 0 ; i < compiledServerRouteFiles.length ; i++) {
        const dirname = path.dirname(compiledServerRouteFiles[i])
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
            const basename = path.basename(compiledServerRouteFiles[i])
            const nameArray = basename.split(".")
            for (let j = 0 ; j < nameArray.length ; j++) {
                if (nameArray[j] !== "server") {
                    routeArray.push(nameArray[j])
                } else {
                    break
                }
            }
        }

        const routeBase = "/" + routeArray.join("/")
        try {
            const serverRoutes = await import (`${compiledServerRouteFiles[i]}`)
            let compiledServerRoutes: any
            if (serverRoutes.default) {
                compiledServerRoutes = serverRoutes.default
            } else {
                compiledServerRoutes = serverRoutes
            }
            if (Object.getPrototypeOf(compiledServerRoutes) === express.Router) {
                avian.use(routeBase, compiledServerRoutes)
            } else if (typeof compiledServerRoutes === "function") {
                try {
                    avian.use(routeBase, compiledServerRoutes(avian))
                } catch (error) {
                    console.log("Skipping server routes file " + compiledServerRouteFiles[i] + " it's default export isn't an express.Router")
                }
            }
        } catch (err) {
            console.error(err)
        }
    }
}

/**
 * Loads app server files
 */
export async function loadAppServerFilesIntoAvian() {

    const compiledServerRouteFiles = glob.sync([`${argv.home}/private/**/*.server.*.js`, `!${argv.home}/private/**/*.server.routes.*.js`])

    for (let i = 0 ; i < compiledServerRouteFiles.length ; i++) {
        try {
            const server = await import (`${compiledServerRouteFiles[i]}`)
            // TODO what to do after this import?
        } catch (err) {
            console.error(err)
        }
    }
}
