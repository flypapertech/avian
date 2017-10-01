#!/usr/bin/env node

/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

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

let name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost"
let home = argv.home || process.env.AVIAN_APP_HOME || shx.pwd()
let port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080
let mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development"

if (cluster.isMaster) {

    let cores = os.cpus()

    for (let i = 0; i < cores.length; i++) {
        cluster.fork()
    }
    cluster.on("exit", worker => {
        cluster.fork()
    })

} else {

    let avian = express()

    avian.use(session({
        secret: crypto.createHash("sha1").digest("hex"),
        resave: false,
        saveUninitialized: false
    }))

    avian.use("/avian_modules", express.static(__dirname + "../node_modules"))
    avian.use("/assets", express.static(home + "/assets"))
    avian.use("/static", express.static(home + "/static"))
    avian.use("/", express.static(home + "/assets"))

    avian.set("view engine", "pug")
    avian.set("views", home)

    avian.use(require("express-redis")(6379, "127.0.0.1", {return_buffers: true}, "cache"))

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

        try {
            event.emit("synch",
                req.cache.set(name,
                    JSON.stringify(jsonfile.readFileSync(home + `/components/${req.params.component}.storage.json`))))
        }

        catch (err) {
            if (err)
                if (home + `/components/${req.params.component}`) res.redirect("/errors")
        }

        try {

            req.cache.get(`${req.params.component}`, (err, storage) => {
                res.render(home + `/components/${req.params.component}.template.pug`, JSON.parse(storage))
            })
        }
        catch (err) {
            if (err)
                res.redirect("/errors")
        }
    })

    avian.get("/:component/storage/objects.json", (req, res, next) => {

        event.emit("synch",
            req.cache.set(req.params.component,
                JSON.stringify(jsonfile.readFileSync(home + `/components/${req.params.component}.storage.json`))))

        req.cache.get(req.params.component, (err, storage) => {
            res.json(JSON.parse(storage))
        })
    })

    avian.get("/:component/storage/:object/objects.json", (req, res, next) => {

        event.emit("synch",
            req.cache.set(req.params.component,
                JSON.stringify(jsonfile.readFileSync(home + `/components/${req.params.component}.storage.json`))))

        req.cache.get(req.params.component, (err, storage) => {

            storage = JSON.parse(storage)

            if (req.params.object === "all")
                if (storage.objects) res.json(storage.objects)

            storage.objects.forEach(object => {

                if (req.params.object === "data")
                    if (object.data) res.json(object.data)

                if (req.params.object === "alerts")
                    if (object.alerts) res.json(object.alerts)

                if (req.params.object === "notifications")
                    if (object.notifications) res.json(object.notifications)

                if (req.params.object === "history")
                    if (object.history) res.json(object.history)

            })
        })
    })

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
