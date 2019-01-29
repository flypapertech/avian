import * as events from "events"
import * as crypto from "crypto"
import * as cluster from "cluster"
import * as express from "express"
import * as session from "express-session"
import * as redis from "redis"
import * as glob from "glob"
import * as os from "os"
import * as fs from "fs"
import * as path from "path"
import * as webpack from "webpack"
import * as rimraf from "rimraf"
import * as defaultWebpackDev from "./webpack.development"
import * as defaultWebpackProd from "./webpack.production"
import * as ts from "typescript"
import * as signature from "cookie-signature"
import * as history from "connect-history-api-fallback"
import { RequestHandler, Request } from "express"
import mkdirp = require("mkdirp")
import jsonfile = require("jsonfile")
import yargs = require("yargs")
import { json } from "express"

const argv: any = yargs.env("AVIAN_APP")
    .option("n", {
        alias: "name",
        default: process.env.HOSTNAME || "localhost",
        describe: "The name of your application"
    })
    .option("h", {
        alias: "home",
        default: process.cwd(),
        defaultDescription: "current working directory",
        describe: "The directory of your application."
    })
    .option("m", {
        alias: "mode",
        default: process.env.NODE_ENV || "development",
        describe: "Deployment mode to run Avian in.",
        choices: [
            "development",
            "production"
        ]
    })
    .option("p", {
        alias: "port",
        default: 8080,
        describe: "Which port to serve your application on."
    })
    .option("dc", {
        alias: "defaultComponent",
        default: "index",
        describe: "The point of entry to your application."
    })
    .option("spa", {
        default: false,
        describe: "Start Avian in a single-page-application configuration."
    })
    .option("redisHost", {
        default: "127.0.0.1"
    })
    .option("redisPort", {
        default: 6379
    })
    .option("redisSessionDB", {
        default: 1
    })
    .option("redisCacheDB", {
        default: 2
    })
    .option("webpackHome", {
        default: ""
    })
    .option("l", {
        alias: "logger",
        describe: "Which logging framework to use.",
        choices: [
            "bunyan",
            "fluent"
        ]
    })
    .option("lt", {
        alias: "loggerFluentTag",
        default: "debug"
    })
    .option("lh", {
        alias: "loggerFluentHost",
        default: "127.0.0.1"
    })
    .option("lp", {
        alias: "loggerFluentPort",
        default: 24224
    })
    .argv

if (argv.webpackHome === "") {
    argv.webpackHome = argv.home
}

const sessionSecret = process.env.AVIAN_APP_SESSION_SECRET || crypto.createHash("sha512").digest("hex")

const injectArgv: RequestHandler = (req, res, next) => {
    req.argv = Object.assign({}, argv)
    next()
}


class AvianUtils {
    getComponentRoot(component: string): string {
        if (fs.existsSync(`${argv.home}/components/${component}`))
            return `${argv.home}/components/${component}`
        else
            return `${argv.home}/components`
    }

    getComponentViewPath(pathToViewFileWithoutExtension: string): string {
        try {
            let matches = glob.sync(`${pathToViewFileWithoutExtension}.*`)
            return matches.length === 0 ? "" : matches[0]
        }
        catch (err) {
            return ""
        }
    }

    setComponentConfigObjectCache(component: string, req: Request, subcomponent?: string): string {
        let parentComponentRoot = this.getComponentRoot(component)
        let componentPath = (subcomponent) ? `${parentComponentRoot}/${subcomponent}` : `${parentComponentRoot}`
        let configFilePath = (subcomponent) ? `${componentPath}/${subcomponent}.config.json` : `${componentPath}/${component}.config.json`
        let fallbackFilePath = (subcomponent) ? `${componentPath}/${component}.${subcomponent}.config.json` : undefined
        let configStringJSON: string
        try {
            configStringJSON = JSON.stringify(jsonfile.readFileSync(configFilePath))
        } catch (err) {
            if (!fallbackFilePath) {
                configStringJSON = JSON.stringify({})
            }
            else {
                try {
                    configStringJSON = JSON.stringify(jsonfile.readFileSync(fallbackFilePath))
                }
                catch {
                    configStringJSON = JSON.stringify({})
                }
            }
        }

        req.cache.set(component, configStringJSON)
        return configStringJSON
    }

    getComponentConfigObject(component: string, req: Request, subcomponent: string | undefined, callback: Function) {
        try {
            let cacheKey = (subcomponent) ? `${component}/${subcomponent}` : component
            let config = undefined
            req.cache.get(cacheKey, (err, config) => {
                if (config) {
                    callback(JSON.parse(config))
                    return
                }

                let configString = avianUtils.setComponentConfigObjectCache(component, req)
                callback(JSON.parse(configString))
            })

            return config
        }
        catch (error) {
            console.error(error)
            callback({})
        }
    }

    killAllWorkers(): boolean {
        let existingWorkers = false
        for (const id in cluster.workers) {
            existingWorkers = true
            let worker = cluster.workers[id]
            if (worker)
                worker.kill()
        }

        return existingWorkers
    }

    isAvianRunning(): boolean {
        return Object.keys(cluster.workers).length > 0
    }

    setWorkersToAutoRestart() {
        cluster.on("exit", worker => {
            cluster.fork()
        })
    }
}

const avianEmitter = new events.EventEmitter()
let runningBuilds = {
    services: false,
    components: false
}

avianEmitter.on("buildStarted", (name: string) => {
    if (name === "services") {
        runningBuilds.services = true
    }
    else if (name === "components") {
        runningBuilds.components = true
    }
})

let pendingChunks: string[] = []
avianEmitter.on("buildCompleted", (name: string, changedChunks: string[]) => {
    pendingChunks.push(...changedChunks)
    if (name === "services") {
        runningBuilds.services = false
    }
    else if (name === "components") {
        runningBuilds.components = false
    }
    if (runningBuilds.components === false && runningBuilds.services === false) {
        console.log("Avian - Compilation Complete")
        if (!avianUtils.isAvianRunning() || pendingChunks.find(chunk => chunk.indexOf("service") !== -1)) {
            console.log("Avian - Restarting server")
            avianUtils.killAllWorkers()
            let cores = os.cpus()
            for (let i = 0; i < cores.length; i++) {
                cluster.fork()
            }
        }

        pendingChunks = []
    }
})

function startDevWebpackWatcher(webpackDev: any) {
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
    }, watcherCallback("components"))

    servicesCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.component.*", "node_modules", "serverless"]
    }, watcherCallback("services"))
}

function watcherCallback(name: string) {
    let chunkVersions = {} as any
    const watcherCallback: webpack.ICompiler.Handler = (err, stats) => {
        if (err || stats.hasErrors()) {
            if (err) {
                console.error(err)
            }
            else if (stats) {
                stats.toJson().errors.forEach((err: any) => {
                    console.error(err)
                })
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

        let changedChunks = stats.compilation.chunks.filter(chunk => {
            let oldVersion = chunkVersions[chunk.name]
            chunkVersions[chunk.name] = chunk.hash
            return chunk.hash !== oldVersion
          }).map(chunk => chunk.name)

        avianEmitter.emit("buildCompleted", name, changedChunks)
        return
    }

    return watcherCallback
}

function startProdWebpackCompiler(webpackProd: any) {
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
                stats.toJson().errors.forEach((err: any) => {
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

class ServerEvent {
    private data: string = ""
    constructor() {
    }

    addData(data: string) {
        let lines = data.split(/\n/)

        for (let i = 0; i < lines.length; i++) {
            let element = lines[i]
            this.data += "data:" + element + "\n"
        }
    }
    payload() {
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
    let compiledServices = glob.sync(`${argv.home}/private/**/*.service.js`)
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

        if (routeArray.length === 0) {
            let basename = path.basename(compiledServices[i])
            if (basename !== "avian.service.js") {
                let nameArray = basename.split(".")
                for (let j = 0; j < nameArray.length; j++) {
                    if (nameArray[j] !== "service") {
                        routeArray.push(nameArray[j])
                    }
                    else {
                        break
                    }
                }
            }
        }

        let routeBase = "/" + routeArray.join("/")
        try {
            let service = await import (`${compiledServices[i]}`)
            let compiledService: any
            if (service.default) {
                compiledService = service.default
            }
            else {
                compiledService = service
            }
            if (Object.getPrototypeOf(compiledService) === express.Router) {
                avian.use(routeBase, compiledService)
            }
            else if (typeof compiledService === "function") {
                try {
                    avian.use(routeBase, compiledService(avian))
                }
                catch (error) {
                    console.log("Skipping service file " + compiledServices[i] + " it's default export isn't an express.Router")
                }
            }
        }
        catch (err) {
            console.error(err)
        }
    }
}

const avianUtils = new AvianUtils()
if (cluster.isMaster) {
    rimraf.sync(`${argv.home}/private/*`)
    rimraf.sync(`${argv.home}/public/*`)

    let webpackConfigs = glob.sync(`${argv.webpackHome}/webpack.development.*`)
    webpackConfigs.push(...glob.sync(`${argv.webpackHome}/webpack.production.*`))
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
    avian.engine("html", require("ejs").renderFile)
    avian.use(injectArgv)
    let cookieParser = require("cookie-parser")
    avian.use(cookieParser())

    avian.locals.argv = argv
    let redisStore = require("connect-redis")(session)
    const enableAuthHeadersForExpressSession: RequestHandler = (req, res, next) => {
        if (req.headers.authorization) {
            let authParts = req.headers.authorization.split(" ")
            if (authParts[0].toLowerCase() === "bearer" && authParts.length > 1) {
                // We need to sign this exactly like how express-session signs cookies
                let signed = "s:" + signature.sign(authParts[1], sessionSecret)
                req.cookies["connect.sid"] = signed
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
            maxAge: 2592000000
        }
    }))

    avian.use(require("express-redis")(argv.redisPort, argv.redisHost, {db: argv.redisCacheDB}, "cache"))
    const server = avian.listen(argv.port, () => {
        console.log("Avian - Process: %sd, Name: %s, Home: %s, Port: %d, Mode: %s",
            process.pid,
            argv.name,
            argv.home,
            argv.port,
            argv.mode
        )
    })

    avian.get("/sse", (req, res) => {
        subscribe((channel: any, message: any) => {
            let messageEvent = new ServerEvent()
            messageEvent.addData(message)
            res.write(messageEvent.payload())
        })

        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
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
                index: `/${argv.defaultComponent}`
            }))
        }

        avian.set("view engine", "pug")
        avian.set("view engine", "ejs")
        avian.set("views", argv.home)

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
                            count: 365
                        }
                    ],
                }))
                break

            case "fluent":

                avian.use(require("express-fluent-logger")(argv.loggerFluentTag, {
                    host: argv.loggerFluentHost, port: argv.loggerFluentPort, timeout: 3.0, responseHeaders: ["x-userid", "status", "content-length"]
                }))
                break
        }

        if (argv.mode === "production") {

            mkdirp.sync(argv.home + "/cache/")
            avian.use(require("express-minify")({cache: argv.home + "/cache"}))
            avian.enable("view cache")
        }

        avian.get("/:component/:subcomponent", express.urlencoded({ extended: true }), (req, res, next) => {
            let componentRoot = avianUtils.getComponentRoot(req.params.component)
            let subComponentPath = `${componentRoot}/${req.params.subcomponent}`

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
            }
            catch (err) {
                console.error(err)
                res.redirect("/errors")
            }
        })

        avian.get("/:component", express.urlencoded({ extended: true }), (req, res, next) => {
            let componentRoot = avianUtils.getComponentRoot(req.params.component)

            try {
                res.setHeader("X-Powered-By", "Avian")

                let viewPath = avianUtils.getComponentViewPath(`${componentRoot}/${req.params.component}.view`)
                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                avianUtils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
                    res.locals.req = req
                    res.render(viewPath, config)
                })
            }
            catch (err) {
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
            }
            catch (err) {
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
            }
            catch (err) {
                res.setHeader("X-Powered-By", "Avian")
                res.sendStatus(404)
            }
        })

        avian.post("/logger", json(), (req, res, next) => {
            if (req.query && req.body) {

                if (argv.logger) {

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
                            req.logger.emit(req.query.level, req.body, `${new Date().getTime()}.0`)
                            break
                    }
                }
            }
        })


        avian.all("/", (req, res, next) => {
            res.redirect(`/${argv.defaultComponent}`)
        })

    })
}
