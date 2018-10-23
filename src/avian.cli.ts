import * as events from "events"
import * as crypto from "crypto"
import * as cluster from "cluster"
import * as express from "express"
import * as session from "express-session"
import * as glob from "glob"
import * as parser from "body-parser"
import * as os from "os"
import * as fs from "fs"
import * as path from "path"
import * as webpack from "webpack"
import { RedisClient } from "redis"
import * as rimraf from "rimraf"
import * as defaultWebpackDev from "./webpack.development"
import * as defaultWebpackProd from "./webpack.production"
import * as ts from "typescript"
import { RequestHandler, Response, Request } from "express"
import * as signature from "cookie-signature"
const mkdirp = require("mkdirp")
const jsonfile = require("jsonfile")

const argv = require("yargs").argv
argv.name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost"
argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd()
argv.port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080
argv.mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development"
argv.webpack = argv.webpack || process.env.AVIAN_APP_WEBPACK || argv.home
argv.sessionSecret = argv.sessionSecret || process.env.AVIAN_APP_SESSION_SECRET || crypto.createHash("sha512").digest("hex")

// import after argv so they can us it
class AvianUtils {
    getComponentRoot(component: string): string {
        if (fs.existsSync(`${argv.home}/components/${component}`))
            return `${argv.home}/components/${component}`
        else
            return `${argv.home}/components`
    }

    setComponentConfigObjectCache(component: string, reqWithCache: RequestWithCache, subcomponent?: string): Promise<string> {
        return new Promise(() => {
            let parentComponentRoot = this.getComponentRoot(component)
            let componentPath = (subcomponent) ? `${parentComponentRoot}/${subcomponent}` : `${parentComponentRoot}`
            let configFilePath = (subcomponent) ? `${componentPath}/${subcomponent}.config.json` : `${componentPath}/${component}.config.json`
            let fallbackFilePath = (subcomponent) ? `${componentPath}/${component}.${subcomponent}.config.json` : undefined
            let configStringJSON: string
            try {
                console.log(configFilePath)
                configStringJSON = JSON.stringify(jsonfile.readFileSync(configFilePath))
            } catch (err) {
                if (!fallbackFilePath) {
                    console.log("no fall back config file returning empty")
                    configStringJSON = JSON.stringify({})
                }
                else {
                    try {
                        console.log("falling back")
                        console.log(fallbackFilePath)
                        configStringJSON = JSON.stringify(jsonfile.readFileSync(fallbackFilePath))
                    }
                    catch {
                        console.log("fall back config file failed returning empty")
                        configStringJSON = JSON.stringify({})
                    }
                }
            }

            reqWithCache.cache.set(component, configStringJSON)
            return configStringJSON
        })
    }

    getComponentConfigObject(component: string, reqWithCache: RequestWithCache, subcomponent?: string): object {
        try {
            let cacheKey = (subcomponent) ? `${component}/${subcomponent}` : component
            reqWithCache.cache.get(cacheKey, (err, config) => {
                if (config) {
                    console.log(config)
                    return JSON.parse(config)
                }

                let updateCachePromise = avianUtils.setComponentConfigObjectCache(component, reqWithCache)

                updateCachePromise.then(configString => {
                    console.log(configString)
                    return JSON.parse(configString)
                }).catch(error => {
                    console.error(error)
                    return {}
                })
            })
        }
        catch (error) {
            console.error(error)
            return {}
        }
    }

    killAllWorkers(): boolean {
        let existingWorkers = false
        for (const id in cluster.workers) {
            existingWorkers = true
            let worker = cluster.workers[id]
            worker.kill()
        }

        return existingWorkers
    }

    setWorkersToAutoRestart() {
        cluster.on("exit", worker => {
            cluster.fork()
        })
    }
}

const avianEmitter = new events.EventEmitter()
let runningBuilds = []
let completedBuilds = []
avianEmitter.on("buildStarted", (buildName) => {
    completedBuilds = completedBuilds.filter((item) => {
        item !== buildName
    })

    runningBuilds.push(buildName)
})

avianEmitter.on("buildCompleted", (buildName) => {
    runningBuilds = runningBuilds.filter((item) => {
        item !== buildName
    })

    completedBuilds.push(buildName)
    if (completedBuilds.length === 2) {
        console.log("Avian - Restarting server")
        avianUtils.killAllWorkers()
        let cores = os.cpus()
        for (let i = 0; i < cores.length; i++) {
            cluster.fork()
        }
    }
})

function startDevWebpackWatcher(webpackDev) {
    let componentsCompiler: webpack.Compiler
    componentsCompiler = webpack(
        webpackDev.ComponentsConfig
    )
    componentsCompiler.hooks.watchRun.tap("Starting", () => {
        avianEmitter.emit("buildStarted", "components")
    })

    let servicesCompiler: webpack.Compiler
    servicesCompiler = webpack(
        webpackDev.ServicesConfig
    )
    servicesCompiler.hooks.watchRun.tap("Starting", () => {
        avianEmitter.emit("buildStarted", "services")
    })

    console.log("Avian - Starting Webpack Watchers")
    const watching = componentsCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.service.*", "node_modules", "serverless"]
    }, (err, stats) => watcherCallback(err, stats, "components"))

    servicesCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.component.*", "node_modules", "serverless"]
    }, (err, stats) => watcherCallback(err, stats, "services"))
}

function watcherCallback(err, stats, buildName) {
    if (err || stats.hasErrors()) {
        if (err) {
            console.error(err)
        }
        else if (stats) {
            stats.toJson().errors.forEach((err) => {
                console.error(err)
            })
        }

        console.error("Avian - Encountered compile errors, stopping server")
        avianUtils.killAllWorkers()
        console.error("Avian - Waiting for you to fix compile errors")
        return
    }

    if (stats.hasWarnings()) {
        stats.toJson().warnings.forEach((warning) => {
            console.log(warning)
        })
    }

    avianEmitter.emit("buildCompleted", buildName)
}

function startProdWebpackCompiler(webpackProd) {
    let webpackCompiler: webpack.MultiCompiler
    webpackCompiler = webpack([
        webpackProd.ComponentsConfig,
        webpackProd.ServicesConfig
    ])

    console.log("Avian - Starting Webpack")
    webpackCompiler.run((err, stats) => {
        if (err || stats.hasErrors()) {
            if (err) {
                console.error(err)
            }
            else if (stats) {
                stats.toJson().errors.forEach((err) => {
                    console.error(err)
                })
            }

            console.error("Avian - Encountered compile errors, please fix and restart")
            avianUtils.killAllWorkers()
            return
        }

        let cores = os.cpus()
        for (let i = 0; i < cores.length; i++) {
            cluster.fork()
        }

        avianUtils.setWorkersToAutoRestart()
    })

}

function loadUserServiesIntoAvian(avian: express.Express) {
    let compiledServices = glob.sync(`${argv.home}/private/**/*service.js`)
    for (let i = 0; i < compiledServices.length; i++) {
        let dirname = path.dirname(compiledServices[i])
        let directories = dirname.split("/")
        let routeArray = []
        for (let j = directories.length - 1; j >= 0; j--) {
            if (directories[j] !== "private") {
                routeArray.unshift(directories[j])
            }
            else {
                break
            }
        }

        let routeBase = "/" + routeArray.join("/")
        import (`${compiledServices[i]}`).then(service => {
            try {
                let compiledService: express.Router
                if (service.default) {
                    compiledService = service.default
                }
                else {
                    compiledService = service
                }

                avian.use(`${routeBase}`, compiledService)
            }
            catch (err) {
                console.error(err)
            }
        })
    }
}

interface RequestWithCache extends express.Request {
    cache: RedisClient
}
const avianUtils = new AvianUtils()
if (cluster.isMaster) {
    rimraf.sync(`${argv.home}/private/*`)
    rimraf.sync(`${argv.home}/public/*`)

    let webpackConfigs = glob.sync(`${argv.webpack}/webpack.development.*`)
    webpackConfigs.push(...glob.sync(`${argv.webpack}/webpack.production.*`))
    let program = ts.createProgram(webpackConfigs, {
        noEmitOnError: true,
        noImplicityAny: true,
        target: ts.ScriptTarget.ES5,
        modules: ts.ModuleKind.CommonJS,
        outDir: `${argv.home}/private`,
        skipLibCheck: true,
        lib: [
            "lib.es2015.d.ts"
        ]
    })
    let emitResult = program.emit()

    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)
    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
            console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
        }
        else {
            console.log(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`)
        }
    })

    if (argv.mode === "development") {
        import(argv.home + "/private/webpack.development").then(webpackDev => {
            startDevWebpackWatcher(webpackDev)
        }).catch(error => {
            console.log("Avian - Falling back to default dev webpack config")
            startDevWebpackWatcher(defaultWebpackDev)
        })
    }
    else {
        import(argv.home + "/private/webpack.production").then(webpackProd => {
            startProdWebpackCompiler(webpackProd)
        }).catch(error => {
            console.log("Avian - Falling back to default prod webpack config")
            startProdWebpackCompiler(defaultWebpackProd)
        })
    }
}
else {
    const avian = express()
    let cookieParser = require("cookie-parser")
    avian.use(cookieParser())

    avian.locals.argv = argv
    let redisStore = require("connect-redis")(session)
    const enableAuthHeadersForExpressSession: RequestHandler = (req: Request, res: Response, next: any) => {
        if (req.headers.authorization) {
            let authParts = req.headers.authorization.split(" ")
            if (authParts[0].toLowerCase() === "bearer" && authParts.length > 1) {
                // We need to sign this exactly like how express-session signs cookies
                let signed = "s:" + signature.sign(authParts[1], argv.sessionSecret)
                req.cookies["connect.sid"] = signed
            }
        }

        next()
    }

    avian.use(enableAuthHeadersForExpressSession)

    avian.use(session({
        store: new redisStore({host: "127.0.0.1"}),
        proxy: true,
        secret: argv.sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            maxAge: 2592000000
        }
    }))

    avian.use(require("express-redis")(6379, "127.0.0.1", {return_buffers: true}, "cache"))

    loadUserServiesIntoAvian(avian)

    avian.use("/static", express.static(argv.home + "/static"))
    avian.use("/assets", express.static(argv.home + "/assets"))
    avian.use("/", express.static(argv.home + "/public"))
    avian.use("/node_modules", express.static(argv.home + "/node_modules"))
    avian.use("/bower_components", express.static(argv.home + "/bower_components"))
    avian.use("/jspm_packages", express.static(argv.home + "/jspm_packages"))

    avian.set("view engine", "pug")
    avian.set("views", argv.home)

    if (argv.mode === "production") {

        mkdirp.sync(argv.home + "/cache/")
        mkdirp.sync(argv.home + "/logs/")

        avian.use(require("express-bunyan-logger")({
            name: argv.name,
            streams: [
                {
                    level: "error",
                    stream: process.stderr
                },
                {
                    level: "info",
                    type: "rotating-file",
                    path: argv.home + `/logs/${argv.name}.${process.pid}.json`,
                    period: "1d",
                    count: 365
                }
            ],
        }))

        avian.use(require("express-minify")({cache: argv.home + "/cache"}))
        avian.enable("view cache")
    }

    avian.get("/:component/:subcomponent", parser.urlencoded({ extended: true }), (req, res, next) => {
        let componentRoot = avianUtils.getComponentRoot(req.params.component)
        let subComponentPath = `${componentRoot}/${req.params.subcomponent}`

        // if the subcomponent directory doesn't exist, move on
        if (!fs.existsSync(`${subComponentPath}`)) {
            next()
            return
        }

        let reqWithCache = req as RequestWithCache
        try {
            let config = avianUtils.getComponentConfigObject(req.params.component, reqWithCache, req.params.subcomponent)
            res.locals.req = req
            res.setHeader("X-Powered-By", "Avian")
            res.render(`${subComponentPath}/${req.params.subcomponent}.view.pug`, config, function(err, html) {
                if (err) {
                    res.render(`${subComponentPath}/${req.params.component}.${req.params.subcomponent}.view.pug`, config)
                }
            })
        }
        catch (err) {
            console.log(err)
            res.redirect("/errors")
        }
    })

    avian.get("/:component", parser.urlencoded({ extended: true }), (req, res, next) => {
        let reqWithCache = req as RequestWithCache
        let componentRoot = avianUtils.getComponentRoot(req.params.component)
        try {
            let config = avianUtils.getComponentConfigObject(req.params.component, reqWithCache)
            res.locals.req = req
            res.setHeader("X-Powered-By", "Avian")
            res.render(`${componentRoot}/${req.params.component}.view.pug`, config)
        }
        catch (err) {
            console.log(err)
            res.redirect("/errors")
        }
    })

    avian.get("/:component/config/objects.json", (req, res, next) => {
        let reqWithCache = req as RequestWithCache
        try {
            let config = avianUtils.getComponentConfigObject(req.params.component, reqWithCache)
            res.setHeader("X-Powered-By", "Avian")
            res.json(config)
        }
        catch (err) {
            res.setHeader("X-Powered-By", "Avian")
            res.sendStatus(404)
        }
    })

    avian.get("/:component/:subcomponent/config/objects.json", (req, res, next) => {
        let reqWithCache = req as RequestWithCache
        try {
            let config = avianUtils.getComponentConfigObject(req.params.component, reqWithCache, req.params.subcomponent)
            res.setHeader("X-Powered-By", "Avian")
            res.json(config)
        }
        catch (err) {
            res.setHeader("X-Powered-y", "Avian")
            res.sendStatus(404)
        }
    })


    avian.all("/", (req, res, next) => {
        res.redirect("/index")
    })

    const server = avian.listen(argv.port, () => {

        console.log("Avian - Worker Id: %s, Process: %sd, Name: %s, Home: %s, Port: %d",
            cluster.worker.id,
            process.pid,
            argv.name,
            argv.home,
            argv.port
        )
    })
}
