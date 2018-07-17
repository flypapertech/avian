"use strict";

var _this = this;

exports.__esModule = true;

var events = require("events");

var crypto = require("crypto");

var cluster = require("cluster");

var express = require("express");

var session = require("express-session");

var glob = require("glob");

var parser = require("body-parser");

var os = require("os");

var fs = require("fs");

var path = require("path");

var webpack = require("webpack");

var rimraf = require("rimraf");

var mkdirp = require("mkdirp");

var WebpackWatchedGlobEntries = require("webpack-watched-glob-entries-plugin");

var jsonfile = require("jsonfile");

var compression = require("compression");

var nodeExternals = require("webpack-node-externals");

var argv = require("yargs").argv;

argv.name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost";

argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd();

argv.port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080;

argv.mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development";

var logWebpackErrors = function(stats) {
    if (stats && stats.hasErrors()) {
        stats.toJson().errors.forEach(function(err) {
            console.error(err);
        });
    }
};

var compiler = webpack([ {
    entry: WebpackWatchedGlobEntries.getEntries(argv.home + "/components/**/*.component.*"),
    output: {
        path: argv.home + "/public",
        filename: "[name].bundle.js"
    },
    devtool: "cheap-eval-source-map",
    resolve: {
        extensions: [ ".ts", ".js", ".vue", ".json" ],
        alias: {
            vue$: "vue/dist/vue.js"
        }
    },
    plugins: [ new WebpackWatchedGlobEntries() ],
    externals: {
        vue: "Vue",
        vuetify: "Vuetify"
    },
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
        }, {
            test: /\.tsx?$/,
            loaders: [ "babel-loader", "ts-loader" ]
        } ]
    }
}, {
    target: "node",
    entry: WebpackWatchedGlobEntries.getEntries(argv.home + "/components/**/*.service.*"),
    output: {
        path: argv.home + "/private",
        filename: "[name].js",
        libraryTarget: "commonjs2"
    },
    resolve: {
        extensions: [ ".ts", ".js", ".json" ]
    },
    plugins: [ new WebpackWatchedGlobEntries() ],
    externals: [ nodeExternals() ],
    module: {
        rules: [ {
            test: /\.js$/,
            use: {
                loader: "babel-loader",
                options: {
                    presets: [ "@babel/preset-env" ]
                }
            }
        }, {
            test: /\.tsx?$/,
            loaders: [ "babel-loader", "ts-loader" ]
        } ]
    }
} ]);

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
    AvianUtils.prototype.killAllWorkers = function() {
        var existingWorkers = false;
        for (var id in cluster.workers) {
            existingWorkers = true;
            var worker = cluster.workers[id];
            worker.kill();
        }
        return existingWorkers;
    };
    AvianUtils.prototype.setWorkersToAutoRestart = function() {
        cluster.on("exit", function(worker) {
            cluster.fork();
        });
    };
    return AvianUtils;
}();

var avianUtils = new AvianUtils();

if (cluster.isMaster) {
    rimraf.sync(argv.home + "/private/*");
    rimraf.sync(argv.home + "/public/*");
    if (argv.mode !== "development") {
        compiler.run(function(err, stats) {
            if (err || stats.hasErrors()) {
                if (err) {
                    console.error(err);
                } else if (stats) {
                    stats.toJson().errors.forEach(function(err) {
                        console.error(err);
                    });
                }
                console.error("Avian - Encountered compile errors, please fix and restart");
                avianUtils.killAllWorkers();
                return;
            }
            var cores = os.cpus();
            for (var i = 0; i < cores.length; i++) {
                cluster.fork();
            }
            avianUtils.setWorkersToAutoRestart();
        });
    } else {
        compiler.watch({
            aggregateTimeout: 300,
            poll: undefined
        }, function(err, stats) {
            if (err || stats.hasErrors()) {
                if (err) {
                    console.error(err);
                } else if (stats) {
                    stats.toJson().errors.forEach(function(err) {
                        console.error(err);
                    });
                }
                console.error("Avian - Encountered compile errors, stopping server");
                avianUtils.killAllWorkers();
                console.error("Avian - Waiting for you to fix compile errors");
                return;
            }
            console.log("Avian - Restarting server");
            avianUtils.killAllWorkers();
            var cores = os.cpus();
            for (var i = 0; i < cores.length; i++) {
                cluster.fork();
            }
        });
    }
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
        saveUninitialized: true
    }));
    avian.use(require("express-redis")(6379, "127.0.0.1", {
        return_buffers: true
    }, "cache"));
    avian.use("/assets", express.static(argv.home + "/assets"));
    avian.use("/", express.static(argv.home + "/public"));
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
    avian.get("/:component/:subcomponent", parser.urlencoded({
        extended: true
    }), function(req, res, next) {
        var componentRoot = avianUtils.getComponentRoot(req.params.component);
        var subComponentPath = componentRoot + "/" + req.params.subcomponent;
        var cacheKey = req.params.component + "/" + req.params.subcomponent;
        if (!fs.existsSync("" + subComponentPath)) {
            next();
            return;
        }
        var reqWithCache = req;
        try {
            avianUtils.setConfigObjectCache(cacheKey, reqWithCache);
            reqWithCache.cache.get(cacheKey, function(err, config) {
                res.locals.req = req;
                res.setHeader("X-Powered-By", "Avian");
                res.render(subComponentPath + "/" + req.params.subcomponent + ".view.pug", JSON.parse(config));
            });
        } catch (err) {
            if (err) res.redirect("/error");
        }
    });
    avian.get("/:component", parser.urlencoded({
        extended: true
    }), function(req, res, next) {
        var reqWithCache = req;
        var componentRoot = avianUtils.getComponentRoot(req.params.component);
        try {
            avianUtils.setConfigObjectCache(req.params.component, reqWithCache);
            reqWithCache.cache.get("" + req.params.component, function(err, config) {
                res.locals.req = req;
                res.setHeader("X-Powered-By", "Avian");
                res.render(componentRoot + "/" + req.params.component + ".view.pug", JSON.parse(config));
            });
        } catch (err) {
            if (err) res.redirect("/error");
        }
    });
    avian.get("/:component/config/objects.json", function(req, res, next) {
        var reqWithCache = req;
        try {
            avianUtils.setConfigObjectCache(req.params.component, reqWithCache);
            reqWithCache.cache.get(req.params.component, function(err, config) {
                res.setHeader("X-Powered-By", "Avian");
                res.json(JSON.parse(config));
            });
        } catch (err) {
            res.setHeader("X-Powered-By", "Avian");
            res.status(404).send("Not Found");
        }
    });
    avian.get("/:component/:subcomponent/config/objects.json", function(req, res, next) {
        var reqWithCache = req;
        var cacheKey = req.params.component + "/" + req.params.subcomponent;
        try {
            avianUtils.setConfigObjectCache(cacheKey, reqWithCache);
            reqWithCache.cache.get(cacheKey, function(err, config) {
                res.setHeader("X-Powered-By", "Avian");
                res.json(JSON.parse(config));
            });
        } catch (err) {
            res.setHeader("X-Powered-By", "Avian");
            res.status(404).send("Not Found");
        }
    });
    avian.all("/", function(req, res, next) {
        res.redirect("/index");
    });
    var compiledServices = glob.sync(argv.home + "/private/**/*service.js");
    for (var i = 0; i < compiledServices.length; i++) {
        var dirname = path.dirname(compiledServices[i]);
        var directories = dirname.split("/");
        var routeArray = [];
        for (var j = directories.length - 1; j >= 0; j--) {
            if (directories[j] !== "private") {
                routeArray.unshift(directories[j]);
            } else {
                break;
            }
        }
        var routeBase = "/" + routeArray.join("/");
        var ComponentRouter = require("" + compiledServices[i]);
        avian.use("" + routeBase, ComponentRouter);
    }
    var server = avian.listen(argv.port, function() {
        console.log("Avian - Worker Id: %s, Process: %sd, Name: %s, Home: %s, Port: %d", cluster.worker.id, process.pid, argv.name, argv.home, argv.port);
    });
}