import * as cluster from "cluster"
import * as history from "connect-history-api-fallback"
import * as cookie from "cookie"
import * as signature from "cookie-signature"
import * as crypto from "crypto"
import * as events from "events"
import { Request, RequestHandler } from "express"
import * as express from "express"
import { json } from "express"
import * as session from "express-session"
import * as fs from "fs"
import * as glob from "glob"
import * as https from "https"
import jsonfile = require("jsonfile")
import mkdirp = require("mkdirp")
import * as os from "os"
import * as path from "path"
import * as redis from "redis"
import * as rimraf from "rimraf"
import * as webpack from "webpack"
import { argv } from "./avian.lib"

declare global {
    namespace Express {
        interface Request {
        log: any
        }
    }
}

/**
 * Avian Component Job Schedular
 * @description The Avian component job scheduling framework.
 */

if (argv.jobScheduler) {

    setTimeout(() => {

        const componentConfigFiles = glob.sync(argv.home + "/components/**/*.config.json")
        const schedule = require("node-schedule")

        componentConfigFiles.forEach((config) => {

            try {

                if(require(config).jobScheduler) {

                    const jobs = require(config).jobScheduler

                    jobs.forEach((job: any) => {
                        
                        if (job.enabled) {

                            const componentJob = new schedule.Job(job.title, function() {
                                
                                const { spawn } = require("child_process")

                                const shell = spawn(job.command, job.args, { cwd: argv.home, env: process.env, detached: true })

                                componentJob.schedule(job.expression)
                                console.log(schedule.scheduledJobs)

                            })
                        }
                    })
                }
            }
            catch(error) {
                // console.error(error)
            }
        })

    }, 300000)
}

const sessionSecret = process.env.AVIAN_APP_SESSION_SECRET || crypto.createHash("sha512").digest("hex")

const injectArgv: RequestHandler = (req, res, next) => {
    req.argv = {...argv}
    req.sessionSecret = sessionSecret
    next()
}

class AvianUtils {

    public getComponentConfigObject(component: string, req: Request, subcomponent: string | undefined, callback: Function) {
        try {
            const cacheKey = (subcomponent) ? `${component}/${subcomponent}` : component
            const config: any = {}
            req.cache.get(cacheKey, (err, config) => {
                if (config) {
                    callback(JSON.parse(config))
                    return
                }

                const configString = avianUtils.setComponentConfigObjectCache(component, req, subcomponent)
                callback(JSON.parse(configString))
            })

            return config
        } catch (error) {
            console.error(error)
            callback({})
        }
    }
    public getComponentRoot(component: string): string {
        if (fs.existsSync(`${argv.home}/components/${component}`))
            return `${argv.home}/components/${component}`
        else
            return `${argv.home}/components`
    }

    public getComponentViewPath(pathToViewFileWithoutExtension: string): string {
        try {
            const matches = glob.sync(`${pathToViewFileWithoutExtension}.*`)
            return matches.length === 0 ? "" : matches[0]
        } catch (err) {
            return ""
        }
    }

    public isAvianRunning(): boolean {
        return Object.keys(cluster.workers).length > 0
    }

    public killAllWorkers(): boolean {
        let existingWorkers = false
        for (const id in cluster.workers) {
            existingWorkers = true
            const worker = cluster.workers[id]
            if (worker)
                worker.kill()
        }

        return existingWorkers
    }

    public setComponentConfigObjectCache(component: string, req: Request, subcomponent?: string): string {
        const parentComponentRoot = this.getComponentRoot(component)
        const componentPath = (subcomponent) ? `${parentComponentRoot}/${subcomponent}` : `${parentComponentRoot}`
        const configFilePath = (subcomponent) ? `${componentPath}/${subcomponent}.config.json` : `${componentPath}/${component}.config.json`
        const fallbackFilePath = (subcomponent) ? `${componentPath}/${component}.${subcomponent}.config.json` : undefined
        let configStringJSON: string
        try {
            configStringJSON = JSON.stringify(jsonfile.readFileSync(configFilePath))
        } catch (err) {
            if (!fallbackFilePath) {
                configStringJSON = JSON.stringify({})
            } else {
                try {
                    configStringJSON = JSON.stringify(jsonfile.readFileSync(fallbackFilePath))
                } catch {
                    configStringJSON = JSON.stringify({})
                }
            }
        }

        req.cache.set(component, configStringJSON)
        return configStringJSON
    }

    public setWorkersToAutoRestart() {
        cluster.on("exit", (worker) => {
            cluster.fork()
        })
    }

    public startAllWorkers() {
        const cores = os.cpus()
        for (let i = 0 ; i < cores.length ; i++) {
            cluster.fork()
        }
    }
}

const avianEmitter = new events.EventEmitter()
const runningBuilds = {
    services: false,
    components: false,
}

avianEmitter.on("buildStarted", (name: string) => {
    console.log(`Avian - Started Bundling ${capitalizeFirstLetter(name)}`)
    if (name === "services") {
        runningBuilds.services = true
    } else if (name === "components") {
        runningBuilds.components = true
    }
})

function capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
}

let pendingChunks: string[] = []
avianEmitter.on("buildCompleted", (name: string, changedChunks: string[]) => {
    pendingChunks.push(...changedChunks)
    console.log(`Avian - Finished Bundling ${capitalizeFirstLetter(name)}`)
    if (name === "services") {
        runningBuilds.services = false
    } else if (name === "components") {
        runningBuilds.components = false
    }
    if (runningBuilds.components === false && runningBuilds.services === false) {
        if (argv.bundleOnly) {
            console.log("Avian - Bundle Only Enabled Shutting Down")
            process.exit()
            return
        }

        if (!avianUtils.isAvianRunning()) {
            console.log("Avian - Starting Server")
            avianUtils.startAllWorkers()
        } else if (pendingChunks.some((chunk) => chunk.includes("service"))) {
            console.log("Avian - Restarting Server")
            avianUtils.killAllWorkers()
            avianUtils.startAllWorkers()
        }

        pendingChunks = []
    }
})

function startDevWebpackWatcher(webpackDev: any) {
    let componentsCompiler: webpack.Compiler
    componentsCompiler = webpack(
        webpackDev.ComponentsConfig,
    )
    componentsCompiler.hooks.watchRun.tap("Starting", () => {
        avianEmitter.emit("buildStarted", "components")
    })

    let servicesCompiler: webpack.Compiler
    servicesCompiler = webpack(
        webpackDev.ServicesConfig,
    )
    servicesCompiler.hooks.watchRun.tap("Starting", () => {
        avianEmitter.emit("buildStarted", "services")
    })

    console.log("Avian - Watching For Changes")
    const watching = componentsCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.service.*", "node_modules", "serverless"],
    }, watcherCallback("components"))

    servicesCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.client.*", "node_modules", "serverless"],
    }, watcherCallback("services"))
}

function watcherCallback(name: string) {
    const chunkVersions = {} as any
    const watcherCallback: webpack.ICompiler.Handler = (err, stats) => {
        if (err || stats.hasErrors()) {
            if (err) {
                console.error(err)
            } else if (stats) {
                stats.toJson().errors.forEach((err: any) => {
                    console.error(err)
                })
            }

            if (argv.bundleOnly) {
                console.error("Avian - Bundling Failed Due To Compilation Errors")
                console.log("Avian - Shutting Down")
                process.exit(1)
                return
            }

            console.error("Avian - Encountered compile errors, stopping server")
            avianUtils.killAllWorkers()
            console.error("Avian - Waiting for you to fix compile errors")
            return
        }

        if (stats.hasWarnings()) {
            stats.toJson().warnings.forEach((warning: any) => {
                console.log(warning)
            })
        }

        const changedChunks = stats.compilation.chunks.filter((chunk) => {
            const oldVersion = chunkVersions[chunk.name]
            chunkVersions[chunk.name] = chunk.hash
            return chunk.hash !== oldVersion
          }).map((chunk) => chunk.name)

        avianEmitter.emit("buildCompleted", name, changedChunks)
        return
    }

    return watcherCallback
}

function startProdWebpackCompiler(webpackProd: any) {
    let webpackCompiler: webpack.MultiCompiler
    webpackCompiler = webpack([
        webpackProd.ComponentsConfig,
        webpackProd.ServicesConfig,
    ])

    console.log("Avian - Started Bundling")
    webpackCompiler.run((err, stats) => {
        if (err || stats.hasErrors()) {
            if (err) {
                console.error(err)
            } else if (stats) {
                stats.toJson().errors.forEach((err: any) => {
                    console.error(err)
                })
            }

            console.error("Avian - Bundling Failed Due To Compilation Errors")
            console.log("Avian - Shutting Down")
            avianUtils.killAllWorkers()
            process.exit(1)
            return
        }

        if (argv.bundleOnly) {
            console.log("Avian - Bundle Only Enabled Shutting Down")
            process.exit()
            return
        } else {
            console.log("Avian - Starting Server")
            avianUtils.startAllWorkers()
        }
    })

}

class ServerEvent {
    private data: string = ""
    constructor() {
    }

    public addData(data: string) {
        const lines = data.split(/\n/)

        for (let i = 0 ; i < lines.length ; i++) {
            const element = lines[i]
            this.data += "data:" + element + "\n"
        }
    }
    public payload() {
        return this.data + "\n"
    }
}

function subscribe(callback: any) {
    const subscriber = redis.createClient()
    subscriber.subscribe("sse")
    subscriber.on("error", (error) => {
        console.log("Redis error: " + error)
    })

    subscriber.on("message", callback)
}

function publish(message: string) {
    const publisher = redis.createClient()
    publisher.publish("sse", message)
}

async function loadUserServicesIntoAvian(avian: express.Express) {
    const compiledServices = glob.sync(`${argv.home}/private/**/*.service.js`)
    for (let i = 0 ; i < compiledServices.length ; i++) {
        const dirname = path.dirname(compiledServices[i])
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
            const basename = path.basename(compiledServices[i])
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
            const service = await import (`${compiledServices[i]}`)
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
                    console.log("Skipping service file " + compiledServices[i] + " it's default export isn't an express.Router")
                }
            }
        } catch (err) {
            console.error(err)
        }
    }
}
if (argv.sslCert && argv.sslKey) {
    if (!path.isAbsolute(argv.sslCert)) {
        argv.sslCert = path.join(argv.home, argv.sslCert)
    }

    if (!path.isAbsolute(argv.sslKey)) {
        argv.sslKey = path.join(argv.home, argv.sslKey)
    }
}

const avianUtils = new AvianUtils()
if (cluster.isMaster) {
    const packageJson = require("../package.json")
    console.log(`Avian - Version ${packageJson.version}`)
    if (argv.sslCert && argv.sslKey) {
        console.log("Avian - SSL Enabled")
        console.log(`Avian - Cert Path ${argv.sslCert}`)
        console.log(`Avian - Key Path ${argv.sslKey}`)
    }

    if (argv.bundleSkip) {
        console.log("Avian - Skipped Bundling")
        avianUtils.startAllWorkers()
        avianUtils.setWorkersToAutoRestart()
    } else {
        import("typescript").then((ts) => {
            rimraf.sync(`${argv.home}/private/*`)
            rimraf.sync(`${argv.home}/public/*`)

            const webpackConfigs = glob.sync(`${argv.webpackHome}/webpack.development.*`)
            webpackConfigs.push(...glob.sync(`${argv.webpackHome}/webpack.production.*`))
            const program = ts.createProgram(webpackConfigs, {
                allowJs: true,
                noEmitOnError: true,
                noImplicityAny: true,
                target: ts.ScriptTarget.ES5,
                modules: ts.ModuleKind.CommonJS,
                outDir: `${argv.home}/private`,
                skipLibCheck: true,
                lib: [
                    "lib.es2015.d.ts",
                ],
            })
            const emitResult = program.emit()

            const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)
            allDiagnostics.forEach((diagnostic) => {
                if (diagnostic.file) {
                    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!)
                    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")
                    console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`)
                } else {
                    console.log(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`)
                }
            })

            if (argv.mode === "development") {
                import(argv.home + "/private/webpack.development").then((webpackDev) => {
                    startDevWebpackWatcher(webpackDev)
                }).catch((error) => {
                    console.log("Avian - Falling back to default dev webpack config")
                    import("./webpack.development").then((defaultWebpackDev) => {
                        startDevWebpackWatcher(defaultWebpackDev)
                    }).catch((error) => {
                        console.log("Avian - Failed to load default development webpack config")
                    })
                })
            } else {
                import(argv.home + "/private/webpack.production").then((webpackProd) => {
                    startProdWebpackCompiler(webpackProd)
                }).catch((error) => {
                    console.log("Avian - Falling back to default prod webpack config")
                    import("./webpack.production").then((defaultWebpackProd) => {
                        startProdWebpackCompiler(defaultWebpackProd)
                    }).catch((error) => {
                        console.log("Avian - Failed to load default production webpack config")
                    })
                })
            }
        })
    }
} else {
    const avian = express()
    /**
     * Logging Framework
     */
    switch (argv.logger) {

        case "bunyan":

            mkdirp.sync(argv.home + "/logs/")
            avian.use(require("express-bunyan-logger")({
                name: argv.name,
                streams: [
                    {
                        level: "debug",
                        type: "rotating-file",
                        path: argv.home + `/logs/${argv.name}.${process.pid}.json`,
                        period: "1d",
                        count: 365,
                    },
                ],
            }))
            break

        case "fluent":

            avian.use(require("@flypapertech/fluentd-logger-middleware")({
                level: "info",
                mode: argv.mode,
                tag: argv.loggerFluentTag,
                label: "server.avian",
                source: "Access",
                configure: {
                    host: argv.loggerFluentHost,
                    port: argv.loggerFluentPort,
                    timeout: 3.0,
                },
            }))
            break
    }

    /**
     * Template / View File Engines
     */

    avian.engine("html", require("ejs").renderFile)
    avian.use(injectArgv)

    avian.locals.argv = argv
    const redisStore = require("connect-redis")(session)
    const enableAuthHeadersForExpressSession: RequestHandler = (req, res, next) => {
        if (req.headers.authorization) {
            const authParts = req.headers.authorization.split(" ")
            if (authParts[0].toLowerCase() === "bearer" && authParts.length > 1) {
                // TODO We need to sign this exactly like how express-session signs cookies
                const signed = "s:" + signature.sign(authParts[1], sessionSecret)

                if (!req.headers.cookie) {
                    req.headers.cookie = `connect.sid=${signed}`
                    next()
                    return
                }

                const cookies = cookie.parse(req.headers.cookie)
                const updatedCookies: any = {...cookies,
                                        "connect.sid": signed}

                const cookieKeys = Object.keys(updatedCookies)
                const updatedCookieArray = cookieKeys.map((key) => {
                    return `${key}=${encodeURIComponent(updatedCookies[key])}`
                })

                req.headers.cookie = updatedCookieArray.join("")
            }
        }

        next()
    }

    avian.use(enableAuthHeadersForExpressSession)

    avian.use(session({
        store: new redisStore({host: argv.redisHost, db: argv.redisSessionDB}),
        proxy: true,
        secret: sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            maxAge: 2592000000,
        },
    }))

    avian.use(require("express-redis")(argv.redisPort, argv.redisHost, {db: argv.redisCacheDB}, "cache"))
    if (argv.sslCert && argv.sslKey) {
        https.createServer({
            cert: fs.readFileSync(argv.sslCert),
            key: fs.readFileSync(argv.sslKey),
        }, avian).listen(argv.port, () => {
            console.log("Avian - Process: %sd, Name: %s, Home: %s, Port: %d, Mode: %s",
                process.pid,
                argv.name,
                argv.home,
                argv.port,
                argv.mode,
            )
        })
    } else {
        avian.listen(argv.port, () => {
            console.log("Avian - Process: %sd, Name: %s, Home: %s, Port: %d, Mode: %s",
                process.pid,
                argv.name,
                argv.home,
                argv.port,
                argv.mode,
            )
        })
    }

    avian.get("/sse", (req, res) => {
        subscribe((channel: any, message: any) => {
            const messageEvent = new ServerEvent()
            messageEvent.addData(message)
            res.write(messageEvent.payload())
        })

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        })

        res.write("retry: 10000\n\n")

        // heartbeat
        setInterval(() => {
            res.write(": \n\n")
        }, 5000)
    })

    loadUserServicesIntoAvian(avian).then(() => {
        avian.use("/static", express.static(argv.home + "/static"))
        avian.use("/assets", express.static(argv.home + "/assets"))
        avian.use("/", express.static(argv.home + "/public"))
        avian.use("/node_modules", express.static(argv.home + "/node_modules"))
        avian.use("/bower_components", express.static(argv.home + "/bower_components"))
        avian.use("/jspm_packages", express.static(argv.home + "/jspm_packages"))
        if (argv.spa) {
            avian.use(history({
                index: `/${argv.defaultComponent}`,
            }))
        }

        avian.set("view engine", "pug")
        avian.set("view engine", "ejs")
        avian.set("views", argv.home)

        if (argv.mode === "production") {

            mkdirp.sync(argv.home + "/cache/")
            avian.use(require("express-minify")({cache: argv.home + "/cache"}))
            avian.enable("view cache")
        }

        avian.get("/:component/:subcomponent", express.urlencoded({ extended: true }), (req, res, next) => {
            const componentRoot = avianUtils.getComponentRoot(req.params.component)
            const subComponentPath = `${componentRoot}/${req.params.subcomponent}`

            // if the subcomponent directory doesn't exist, move on
            if (!fs.existsSync(`${subComponentPath}`)) {
                next()
                return
                // TODO: Support non-scaffolded sub components, e.g. index.subname.view.ext
            }

            try {
                res.setHeader("X-Powered-By", "Avian")
                let viewPath = avianUtils.getComponentViewPath(`${subComponentPath}/${req.params.subcomponent}.view`)
                if (viewPath === "") {
                    viewPath = avianUtils.getComponentViewPath(`${subComponentPath}/${req.params.component}.${req.params.subcomponent}.view`)
                }

                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                avianUtils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config: any) => {
                    res.locals.req = req
                    res.render(viewPath, config)
                })
            } catch (err) {
                console.error(err)
                res.redirect("/errors")
            }
        })

        avian.get("/:component", express.urlencoded({ extended: true }), (req, res, next) => {
            const componentRoot = avianUtils.getComponentRoot(req.params.component)

            try {
                res.setHeader("X-Powered-By", "Avian")

                const viewPath = avianUtils.getComponentViewPath(`${componentRoot}/${req.params.component}.view`)
                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                avianUtils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
                    res.locals.req = req
                    res.render(viewPath, config)
                })
            } catch (err) {
                console.error(err)
                res.redirect("/errors")
            }
        })

        avian.get("/:component/config/objects.json", (req, res, next) => {
            try {
                avianUtils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
                    res.setHeader("X-Powered-By", "Avian")
                    res.json(config)
                })
            } catch (err) {
                res.setHeader("X-Powered-By", "Avian")
                res.sendStatus(404)
            }
        })

        avian.get("/:component/:subcomponent/config/objects.json", (req, res, next) => {
            try {
                avianUtils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config: any) => {
                    res.setHeader("X-Powered-By", "Avian")
                    res.json(config)
                })
            } catch (err) {
                res.setHeader("X-Powered-By", "Avian")
                res.sendStatus(404)
            }
        })

        avian.post("/logger", json(), (req, res, next) => {
            if (!req.query || !req.body) {
                res.sendStatus(400)
                return
            }

            if (!argv.logger) {
                res.sendStatus(404)
                return
            }

            switch (argv.logger) {
                case "bunyan":
                    if (req.query.level === "debug") {
                        req.log.debug(req.body)
                    }
                    if (req.query.level === "info") {
                        req.log.info(req.body)
                    }
                    if (req.query.level === "error") {
                        req.log.error(req.body)
                    }
                    if (req.query.level === "warn") {
                        req.log.warn(req.body)
                    }
                    if (req.query.level === "fatal") {
                        req.log.fatal(req.body)
                    }
                    if (req.query.level === "trace") {
                        req.log.trace(req.body)
                    }
                    break
                case "fluent":
                    req.logger.emit(
                        req.query.label || "client", 
                        { source: req.query.source || null, level: req.query.level || "info", mode: argv.mode, record: req.body })
                    break
                }

            res.sendStatus(200)
        })

        avian.all("/", (req, res, next) => {
            res.redirect(`/${argv.defaultComponent}`)
        })
    })
}
