"use strict"

import * as events from "events"
import * as crypto from "crypto"
import * as cluster from "cluster"
import * as express from "express"
import * as parser from "body-parser"
import * as os from "os"
import * as fs from "fs"
import { RedisClient } from "redis"

const session = require("express-session")

const jsonfile = require("jsonfile")
const compression = require("compression")
const shx = require("shelljs")

const argv = require("yargs").argv

const name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost"
const home = argv.home || process.env.AVIAN_APP_HOME || shx.pwd()
const port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080
const mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development"

class AvianUtils {
    getComponentRoot(component: string): string {
        if (fs.existsSync(`${home}/components/${component}`))
            return `${home}/components/${component}`
        else
            return `${home}/components`
    }
}

const avianUtils = new AvianUtils()

interface RequestWithCache extends express.Request {
    cache: RedisClient
}

// const temp = argv.temp || process.env.AVIAN_APP_TEMP || process.env.TMP || process.env.TEMP || shx.pwd()

/*
fs.readdir(`${home}/components`, (err, items) => {
    for (let i = 0; i < items.length; i++) {
        if (!items[i].search(/.*router/g)) {

            let path = `${home}/components/${items[i]}`
            import path
        }
    }
})
*/

if (cluster.isMaster) {

    let cores = os.cpus()

    for (let i = 0; i < cores.length; i++) {
        cluster.fork()
    }
    cluster.on("exit", worker => {
        cluster.fork()
    })

} else {

    const avian = express()

    avian.locals.mode = mode

    let redisStore = require("connect-redis-crypto")(session)

    avian.use(session({
        store: new redisStore({host: "127.0.0.1"}),
        secret: crypto.createHash("sha512").digest("hex"),
        resave: false,
        saveUninitialized: false
    }))

    avian.use(require("express-redis")(6379, "127.0.0.1", {return_buffers: true}, "cache"))

    avian.use("/assets", express.static(home + "/assets"))
    avian.use("/static", express.static(home + "/static"))
    avian.use("/node_modules", express.static(home + "/node_modules"))
    avian.use("/bower_components", express.static(home + "/bower_components"))
    avian.use("/jspm_packages", express.static(home + "/jspm_packages"))

    avian.set("view engine", "pug")
    avian.set("views", home)

    // if (!fs.existsSync(home + "/temp/")) shx.mkdir(home + "/temp/")

    if (mode === "production") {

        if (!fs.existsSync(home + "/cache/")) shx.mkdir(home + "/cache/")
        if (!fs.existsSync(home + "/logs/")) shx.mkdir(home + "/logs/")

        avian.use(require("express-bunyan-logger")({
            name: name,
            streams: [
                {
                    level: "info",
                    stream: process.stdout
                },
                {
                    level: "info",
                    stream: process.stderr
                },
                {
                    level: "info",
                    type: "rotating-file",
                    path: home + `/logs/${name}.${process.pid}.json`,
                    period: "1d",
                    count: 365
                }
            ],
        }))

        avian.use(require("express-minify")({cache: home + "/cache"}))
        avian.use(compression())
    }

    let event = new events.EventEmitter()
    event.on("synch", () => {this})

    avian.get("/:component", parser.urlencoded({ extended: true }), (req, res, next) => {
        let reqWithCache = req as RequestWithCache
        let component_root = avianUtils.getComponentRoot(req.params.component)
        try {
            event.emit("synch",
                reqWithCache.cache.set(req.params.component,
                    JSON.stringify(jsonfile.readFileSync(`${component_root}/${req.params.component}.config.json`))))

            reqWithCache.cache.get(`${req.params.component}`, (err, config) => {

                avian.locals.params = req.params

                res.render(`${component_root}/${req.params.component}.view.pug`, JSON.parse(config))
            })
        }
        catch (err) {
            if (err)
                res.redirect("/error")
        }
    })

    avian.get("/:component/config/objects.json", (req, res, next) => {
        let reqWithCache = req as RequestWithCache
        let component_root = avianUtils.getComponentRoot(req.params.component)
        try {
            event.emit("synch",
                reqWithCache.cache.set(req.params.component,
                    JSON.stringify(jsonfile.readFileSync(`${component_root}/${req.params.component}.config.json`))))

            reqWithCache.cache.get(req.params.component, (err, config) => {
                res.json(JSON.parse(config))
            })
        }
        catch (err) {
            res.status(404)
                .send("Not Found")
        }
    })

    // Include individual component servers...
    /*
        This is a super crewed implementation. I'll improve this as we test further.
    */

    /* fs.readdir(`${component_root}`, (err, items) => {
        for (let i = 0; i < items.length; i++) {
            if (!items[i].search(/.*service/g)) {

                // let ComponentRouter = require(`${home}/components/${items[i]}`)// import(`${home}/components/${items[i]}`)

                // avian.use("/api", ComponentRouter)
                // console.log(items[i])
            }
        }
    })*/

    avian.all("*", (req, res, next) => {
        res.redirect("/index")
    })

    const portal = avian.listen(port, () => {

        console.log("Avian - Core: %s, Process: %sd, Name: %s, Home: %s, Port: %d",
            cluster.worker.id,
            process.pid,
            name,
            home,
            port
        )
    })
}
