"use strict";

var _this = this;

exports.__esModule = true;

var events = require("events");

var crypto = require("crypto");

var cluster = require("cluster");

var express = require("express");

var glob = require("glob");

var parser = require("body-parser");

var os = require("os");

var fs = require("fs");

var path = require("path");

var webpack = require("webpack");

var mkdirp = require("mkdirp");

var WebpackWatchedGlobEntries = require("webpack-watched-glob-entries-plugin");

var session = require("express-session");

var jsonfile = require("jsonfile");

var compression = require("compression");

var argv = require("yargs").argv;

argv.name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost";

argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd();

argv.port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080;

argv.mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development";

var compiler = webpack({
    entry: WebpackWatchedGlobEntries.getEntries(argv.home + "/components/**/*.component.*"),
    output: {
        path: argv.home + "/static",
        filename: "[name].bundle.js"
    },
    resolve: {
        alias: {
            vue: "vue/dist/vue.js"
        }
    },
    plugins: [ new WebpackWatchedGlobEntries() ],
    module: {
        rules: [ {
            test: /\.jsx$/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: [ "@babel/preset-react" ]
                }
            }
        }, {
            test: /\.vue$/,
            use: {
                loader: "vue-loader"
            }
        }, {
            test: /\.js$/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: [ "@babel/preset-env" ]
                }
            }
        } ]
    }
});

var AvianUtils = function() {
    function AvianUtils() {}
    AvianUtils.prototype.getComponentRoot = function(component) {
        if (fs.existsSync(argv.home + "/components/" + component)) return argv.home + "/components/" + component; else return argv.home + "/components";
    };
    AvianUtils.prototype.setConfigObjectCache = function(component, reqWithCache) {
        var component_root = this.getComponentRoot(component);
        var configStringJSON;
        try {
            configStringJSON = JSON.stringify(jsonfile.readFileSync(component_root + "/" + component + ".config.json"));
        } catch (err) {
            configStringJSON = JSON.stringify({});
        }
        var event = new events.EventEmitter();
        event.emit("synch", reqWithCache.cache.set(component, configStringJSON));
    };
    return AvianUtils;
}();

var avianUtils = new AvianUtils();

if (cluster.isMaster) {
    var watching = compiler.watch({
        aggregateTimeout: 300,
        poll: undefined
    }, function(err, stats) {
        if (argv.mode === "development") {
            console.log(stats);
        }
    });
    var cores = os.cpus();
    for (var i = 0; i < cores.length; i++) {
        cluster.fork();
    }
    cluster.on("exit", function(worker) {
        cluster.fork();
    });
} else {
    var avian = express();
    avian.locals.argv = argv;
    var redisStore = require("connect-redis")(session);
    avian.use(session({
        store: new redisStore({
            host: "127.0.0.1"
        }),
        secret: crypto.createHash("sha512").digest("hex"),
        resave: false,
        saveUninitialized: false
    }));
    avian.use(require("express-redis")(6379, "127.0.0.1", {
        return_buffers: true
    }, "cache"));
    avian.use("/assets", express.static(argv.home + "/assets"));
    avian.use("/", express.static(argv.home + "/static"));
    avian.use("/node_modules", express.static(argv.home + "/node_modules"));
    avian.use("/bower_components", express.static(argv.home + "/bower_components"));
    avian.use("/jspm_packages", express.static(argv.home + "/jspm_packages"));
    avian.set("view engine", "pug");
    avian.set("views", argv.home);
    if (argv.mode === "production") {
        mkdirp.sync(argv.home + "/cache/");
        mkdirp.sync(argv.home + "/logs/");
        avian.use(require("express-bunyan-logger")({
            name: argv.name,
            streams: [ {
                level: "error",
                stream: process.stderr
            }, {
                level: "info",
                type: "rotating-file",
                path: argv.home + ("/logs/" + argv.name + "." + process.pid + ".json"),
                period: "1d",
                count: 365
            } ]
        }));
        avian.use(require("express-minify")({
            cache: argv.home + "/cache"
        }));
        avian.use(compression());
    }
    var event_1 = new events.EventEmitter();
    event_1.on("synch", function() {
        _this;
    });
    avian.get("/:component", parser.urlencoded({
        extended: true
    }), function(req, res, next) {
        var reqWithCache = req;
        var component_root = avianUtils.getComponentRoot(req.params.component);
        try {
            avianUtils.setConfigObjectCache(req.params.component, reqWithCache);
            reqWithCache.cache.get("" + req.params.component, function(err, config) {
                res.locals.params = req.params;
                res.locals.query = req.query;
                res.render(component_root + "/" + req.params.component + ".view.pug", JSON.parse(config));
            });
        } catch (err) {
            if (err) res.redirect("/error");
        }
    });
    avian.get("/:component/config/objects.json", function(req, res, next) {
        var reqWithCache = req;
        var component_root = avianUtils.getComponentRoot(req.params.component);
        try {
            avianUtils.setConfigObjectCache(req.params.component, reqWithCache);
            reqWithCache.cache.get(req.params.component, function(err, config) {
                res.json(JSON.parse(config));
            });
        } catch (err) {
            res.status(404).send("Not Found");
        }
    });
    var services = glob.sync(argv.home + "/components/**/*service*");
    for (var i = 0; i < services.length; i++) {
        var serviceFilename = path.basename(services[i]);
        var ComponentRouter = require("" + services[i]);
        var routeBase = serviceFilename.substring(0, serviceFilename.indexOf("."));
        avian.use("/" + routeBase, ComponentRouter);
    }
    avian.all("*", function(req, res, next) {
        res.redirect("/index");
    });
    var portal = avian.listen(argv.port, function() {
        console.log("Avian - Core: %s, Process: %sd, Name: %s, Home: %s, Port: %d", cluster.worker.id, process.pid, argv.name, argv.home, argv.port);
    });
}