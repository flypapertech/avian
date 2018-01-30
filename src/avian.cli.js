"use strict";

var _this = this;

exports.__esModule = true;

var events = require("events");

var crypto = require("crypto");

var cluster = require("cluster");

var express = require("express");

var parser = require("body-parser");

var os = require("os");

var fs = require("fs");

var session = require("express-session");

var jsonfile = require("jsonfile");

var compression = require("compression");

var shx = require("shelljs");

var argv = require("yargs").argv;

var name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost";

var home = argv.home || process.env.AVIAN_APP_HOME || shx.pwd();

var port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080;

var mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development";

if (cluster.isMaster) {
    var cores = os.cpus();
    for (var i = 0; i < cores.length; i++) {
        cluster.fork();
    }
    cluster.on("exit", function(worker) {
        cluster.fork();
    });
} else {
    var avian_1 = express();
    var redisStore = require("connect-redis-crypto")(session);
    avian_1.use(session({
        store: new redisStore({
            host: "127.0.0.1"
        }),
        secret: crypto.createHash("sha512").digest("hex"),
        resave: false,
        saveUninitialized: false
    }));
    avian_1.use(require("express-redis")(6379, "127.0.0.1", {
        return_buffers: true
    }, "cache"));
    avian_1.use("/assets", express.static(home + "/assets"));
    avian_1.use("/static", express.static(home + "/static"));
    avian_1.use("/node_modules", express.static(home + "/node_modules"));
    avian_1.use("/bower_modules", express.static(home + "/bower_modules"));
    avian_1.use("/avian_modules", express.static(home + "/avian_modules"));
    avian_1.use("/sandbox", express.static(home + "/sandbox"));
    avian_1.set("view engine", "pug");
    avian_1.set("views", home);
    if (mode === "production") {
        if (!fs.existsSync(home + "/cache/")) shx.mkdir(home + "/cache/");
        if (!fs.existsSync(home + "/logs/")) shx.mkdir(home + "/logs/");
        avian_1.use(require("express-bunyan-logger")({
            name: name,
            streams: [ {
                level: "info",
                stream: process.stdout
            }, {
                level: "info",
                stream: process.stderr
            }, {
                level: "info",
                type: "rotating-file",
                path: home + ("/logs/" + name + "." + process.pid + ".json"),
                period: "1d",
                count: 365
            } ]
        }));
        avian_1.use(require("express-minify")({
            cache: home + "/cache"
        }));
        avian_1.use(compression());
    }
    var event_1 = new events.EventEmitter();
    event_1.on("synch", function() {
        _this;
    });
    avian_1.get("/:component", parser.urlencoded({
        extended: true
    }), function(req, res, next) {
        try {
            event_1.emit("synch", req.cache.set(name, JSON.stringify(jsonfile.readFileSync(home + ("/components/" + req.params.component + ".storage.json")))));
        } catch (err) {
            if (err) if (home + ("/components/" + req.params.component)) res.redirect("/errors");
        }
        try {
            req.cache.get("" + req.params.component, function(err, storage) {
                res.render(home + ("/components/" + req.params.component + ".template.pug"), JSON.parse(storage));
            });
        } catch (err) {
            if (err) res.redirect("/errors");
        }
    });
    avian_1.get("/:component/storage/objects.json", function(req, res, next) {
        event_1.emit("synch", req.cache.set(req.params.component, JSON.stringify(jsonfile.readFileSync(home + ("/components/" + req.params.component + ".storage.json")))));
        req.cache.get(req.params.component, function(err, storage) {
            res.json(JSON.parse(storage));
        });
    });
    fs.readdir(home + "/components", function(err, items) {
        for (var i = 0; i < items.length; i++) {
            if (!items[i].search(/.*router/g)) {
                var ComponentRouter = require(home + "/components/" + items[i]);
                avian_1.use("/api", ComponentRouter);
            }
        }
    });
    avian_1.all("*", function(req, res, next) {
        res.redirect("/index");
    });
    var portal = avian_1.listen(port, function() {
        console.log("Avian - Core: %s, Process: %sd, Name: %s, Home: %s, Port: %d", cluster.worker.id, process.pid, name, home, port);
    });
}