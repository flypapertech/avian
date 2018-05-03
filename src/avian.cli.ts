"use strict";

import * as events from "events"
import * as crypto from "crypto"
import * as cluster from "cluster"
import * as express from "express"
import * as parser from "body-parser"
import * as os from "os"
import * as fs from "fs"

const session = require("express-session")

const jsonfile = require("jsonfile")
const compression = require("compression")
const shx = require("shelljs")

const argv = require("yargs").argv

const name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost"
const home = argv.home || process.env.AVIAN_APP_HOME || shx.pwd()
const port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080
const mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development"

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
    let redisStore = require("connect-redis-crypto")(session);

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


    let component_root: string

    avian.get("/:component", parser.urlencoded({ extended: true }), (req, res, next) => {

        if (fs.existsSync(`${home}/components/${req.params.component}`))
            component_root = `${home}/components/${req.params.component}`
        else
            component_root = `${home}/components`

        try {
            event.emit("synch",
                req.cache.set(name,
                    JSON.stringify(jsonfile.readFileSync(`${component_root}/${req.params.component}.storage.json`))))
        }
        catch (err) {
            if (err)
                if (`${component_root}/${req.params.component}`)
                    res.redirect("/error")
        }

        try {
            req.cache.get(`${req.params.component}`, (err, storage) => {
                res.render(`${component_root}/${req.params.component}.view.pug`, JSON.parse(storage))
            })
        }
        catch (err) {
            if (err)
                res.redirect("/error")
        }
    })

    avian.get("/:component/storage/objects.json", (req, res, next) => {

        event.emit("synch",
            req.cache.set(req.params.component,
                JSON.stringify(jsonfile.readFileSync(`${component_root}/${req.params.component}.storage.json`))))

        req.cache.get(req.params.component, (err, storage) => {
            res.json(JSON.parse(storage))
        })
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
