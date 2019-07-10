import * as cluster from "cluster"
import * as history from "connect-history-api-fallback"
import * as cookie from "cookie"
import * as signature from "cookie-signature"
import * as crypto from "crypto"
import * as events from "events"
import { RequestHandler } from "express"
import * as express from "express"
import { json } from "express"
import * as session from "express-session"
import * as fs from "fs"
import * as glob from "glob"
import * as https from "https"
import mkdirp = require("mkdirp")
import * as path from "path"
import * as redis from "redis"
import * as rimraf from "rimraf"
import * as webpack from "webpack"
import { argv, utils, services } from "./avian.lib"

import injectArgv from "./middlewares/injectArgv"

if (argv.webpackHome === "") argv.webpackHome = argv.home

// TODO consider moving to avian.lib.ts as this is a constant that is used in multiple files.
const sessionSecret = process.env.AVIAN_APP_SESSION_SECRET || crypto.createHash("sha512").digest("hex")

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

        if (!utils.isAvianRunning()) {
            console.log("Avian - Starting Server")
            utils.startAllWorkers()
        } else if (pendingChunks.some((chunk) => chunk.includes("service"))) {
            console.log("Avian - Restarting Server")
            utils.killAllWorkers()
            utils.startAllWorkers()
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
            utils.killAllWorkers()
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
            utils.killAllWorkers()
            process.exit(1)
            return
        }

        if (argv.bundleOnly) {
            console.log("Avian - Bundle Only Enabled Shutting Down")
            process.exit()
            return
        } else {
            console.log("Avian - Starting Server")
            utils.startAllWorkers()
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

// TODO do we use this function any longer?
function publish(message: string) {
    const publisher = redis.createClient()
    publisher.publish("sse", message)
}

async function loadAppServicesIntoAvian(avian: express.Express) {
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

if (cluster.isMaster) {
    const packageJson = require("../package.json")
    console.log(`Avian - Version ${packageJson.version}`)
    if (argv.sslCert && argv.sslKey) {
        console.log("Avian - SSL Enabled")
        console.log(`Avian - Cert Path ${argv.sslCert}`)
        console.log(`Avian - Key Path ${argv.sslKey}`)
    }

    /**  
     * Cron Job Scheduler
     * @description Avian provides the ability for individual components to have an array of cron jobs to be executed. 
     */

    if (argv.cronJobScheduler) {

        const cronJobQueue = redis.createClient({host: argv.redisHost, port: argv.redisPort, db: argv.redisCronSchedulerDB})

        setInterval(() => {

            const schedule = require("node-schedule")

            console.log("Avian - Checking Components for Cron Jobs")

            const componentConfigFiles = glob.sync(argv.home + "/components/**/*.config.json")

            componentConfigFiles.forEach((config) => {

                try {

                    if(require(config).cronJobs) {

                        const cronJobs = require(config).cronJobs
                        
                        cronJobs.forEach((cronJob: CronJob) => {

                            if (cronJob.enabled) {
                                const job = schedule.scheduleJob(cronJob.expression, () => {
                                    cronJobQueue.get(cronJob.name.toString(), (error, reply) => {
                                        if (error) return console.error(error)
                                        
                                        if (!reply) {
                                            cronJobQueue.set(cronJob.name.toString(), JSON.stringify(cronJob))
                                            console.log(`Avian - Cron Job "${cronJob.name}" added to the job queue.`)
                                        }
                                    })
                                })
                            }
                        })
                    }
                }
                catch(error) {
                    // console.error(error)
                }
            })

        }, 3000)

        setInterval(() => {

            cronJobQueue.keys("*", (error, cronJobsInQueue) => {
                if (error) return console.error(error)
                if (cronJobsInQueue.length > 0) {
                    
                    for (const id in cluster.workers) {

                        let index: number = 0

                        if (cluster.workers[id]) {

                            cronJobQueue.get(cronJobsInQueue[index], (error, job) => {
                                if (error) return console.error(error)
                                if (job) {

                                    // NOTE remove the job from the queue and send this job to a worker.
                                    try { 
                                        cronJobQueue.del(JSON.parse(job).name.toString())
                                        cluster.workers[id]!.send(JSON.parse(job))
                                        index++
                                    }
                                    catch (error) {
                                        console.error("Avian - Something went wrong placing a job on this worker.")
                                    }
                                }
                            })
                        }
                    }
                }
                else {
                    console.log("Avian - The component cron job queue appears to be empty. Nothing to run...")
                }
            })

        }, 30000)

        /** Cron Job Completion Confirmation from Worker */

        cluster.on("message", (worker, cronJobResults: CronJobResults) => {
            if (!cronJobResults.success) {
                console.log(`Avian - Worker ${worker.id} failed to run job: ${cronJobResults.name}`)
                // NOTE since the job failed we should re-queue it for other nodes to consider for execution.
                console.log(`Avian - Job ${cronJobResults.name} is set for requeue.`)
                cronJobQueue.set(cronJobResults.name.toString(), JSON.stringify(cronJobResults))
                return
            }

            console.log(`Avian - Worker ${worker.id} has completed the job: ${cronJobResults.name}`)
            // NOTE remove this job from the redis queue so no other nodes will consider it.
            console.log(`Avian - Job ${cronJobResults.name} is being removed from the queue.`)
            cronJobQueue.del(cronJobResults.name.toString())
            return
        })
    }

    if (argv.bundleSkip) {
        console.log("Avian - Skipped Bundling")
        utils.startAllWorkers()
        utils.setWorkersToAutoRestart()
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
                    import("./webpack/webpack.development").then((defaultWebpackDev) => {
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
                    import("./webpack/webpack.production").then((defaultWebpackProd) => {
                        startProdWebpackCompiler(defaultWebpackProd)
                    }).catch((error) => {
                        console.log("Avian - Failed to load default production webpack config")
                    })
                })
            }
        })
    }
} else {

    /**  
     * Cron Job Runtime
     */
    
    if (argv.cronJobScheduler) {
        process.on('message', (job) => {

            if (job.name) {

                const schedule = require("node-schedule")
                
                const cronJob = new schedule.Job(job.name, () => {
                                        
                    const { spawn } = require("child_process")
                    const cronJobRuntime = spawn(job.command, job.args, { cwd: argv.home, env: process.env, detached: false })

                    cronJobRuntime.on("close", (code: number) => {
                        if (code > 0) { 
                            process.send!({job: job.name, success: false })
                            return
                        }
                        process.send!({name: job.name, success: true})
                    })
                })
                cronJob.schedule(Date.now())
            }
        })
    }

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
                label: argv.loggerFluentLabel,
                source: "Access",
                configure: {
                    host: argv.loggerFluentHost,
                    port: argv.loggerFluentPort,
                    timeout: 3.0,
                },
            }))
            break
    }

    avian.engine("html", require("ejs").renderFile)
    avian.use(injectArgv)

    avian.locals.argv = argv
    const redisStore = require("connect-redis")(session)
    const enableAuthHeadersForExpressSession: RequestHandler = (req, res, next) => {
        if (req.headers.authorization) {
            const authParts = req.headers.authorization.split(" ")
            if (authParts[0].toLowerCase() === "bearer" && authParts.length > 1) {
                // TODO We need to sign this exactly like how express-session signs cookies
                const signed = "s:" + signature.sign(authParts[1], req.sessionSecret)

                if (!req.headers.cookie) {
                    req.headers.cookie = `connect.sid=${signed}`
                    next()
                    return
                }

                const cookies = cookie.parse(req.headers.cookie)
                const updatedCookies: any = {...cookies, "connect.sid": signed}

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

    loadAppServicesIntoAvian(avian).then(() => {
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
            const componentRoot = utils.getComponentRoot(req.params.component)
            const subComponentPath = `${componentRoot}/${req.params.subcomponent}`

            // if the subcomponent directory doesn't exist, move on
            if (!fs.existsSync(`${subComponentPath}`)) {
                next()
                return
                // TODO: Support non-scaffolded sub components, e.g. index.subname.view.ext
            }

            try {
                res.setHeader("X-Powered-By", "Avian")
                let viewPath = utils.getComponentViewPath(`${subComponentPath}/${req.params.subcomponent}.view`)
                if (viewPath === "") {
                    viewPath = utils.getComponentViewPath(`${subComponentPath}/${req.params.component}.${req.params.subcomponent}.view`)
                }

                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                utils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config: any) => {
                    res.locals.req = req
                    res.render(viewPath, config)
                })
            } catch (err) {
                console.error(err)
                res.redirect("/errors")
            }
        })

        avian.get("/:component", express.urlencoded({ extended: true }), (req, res, next) => {
            const componentRoot = utils.getComponentRoot(req.params.component)

            try {
                res.setHeader("X-Powered-By", "Avian")

                const viewPath = utils.getComponentViewPath(`${componentRoot}/${req.params.component}.view`)
                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                utils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
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
                utils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
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
                utils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config: any) => {
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

        /** 
         *  Avian Service Routes
         *  @description Avian provides numerous out of the box helper service routes for application developers.
         */
        
         /* services.forEach((route: any) => {
            route.method(route.path, (req: Request, res: Response, next: Function) => {

                route.action(req, res, next)
                    .then(() => next)
                    .catch((error: any) => next(error))
            })
        })*/

        avian.all("/", (req, res, next) => {
            res.redirect(`/${argv.defaultComponent}`)
        })
    
    }).catch(err => console.log(err))
}
