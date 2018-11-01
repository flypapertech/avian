"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const events = require("events");
const crypto = require("crypto");
const cluster = require("cluster");
const express = require("express");
const session = require("express-session");
const glob = require("glob");
const parser = require("body-parser");
const os = require("os");
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");
const rimraf = require("rimraf");
const defaultWebpackDev = require("./webpack.development");
const defaultWebpackProd = require("./webpack.production");
const ts = require("typescript");
const signature = require("cookie-signature");
const mkdirp = require("mkdirp");
const jsonfile = require("jsonfile");
const yargs = require("yargs");
const argv = yargs.argv;
argv.name = argv.name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME || "localhost";
argv.home = argv.home || process.env.AVIAN_APP_HOME || process.cwd();
argv.port = argv.port || process.env.AVIAN_APP_PORT || process.env.PORT || 8080;
argv.mode = argv.mode || process.env.AVIAN_APP_MODE || process.env.NODE_MODE || "development";
argv.webpack = argv.webpack || process.env.AVIAN_APP_WEBPACK || argv.home;
argv.sessionSecret = argv.sessionSecret || process.env.AVIAN_APP_SESSION_SECRET || crypto.createHash("sha512").digest("hex");
exports.injectArgv = (req, res, next) => {
    req.argv = Object.assign({}, argv);
    next();
};
class AvianUtils {
    getComponentRoot(component) {
        if (fs.existsSync(`${argv.home}/components/${component}`))
            return `${argv.home}/components/${component}`;
        else
            return `${argv.home}/components`;
    }
    setComponentConfigObjectCache(component, req, subcomponent) {
        let parentComponentRoot = this.getComponentRoot(component);
        let componentPath = (subcomponent) ? `${parentComponentRoot}/${subcomponent}` : `${parentComponentRoot}`;
        let configFilePath = (subcomponent) ? `${componentPath}/${subcomponent}.config.json` : `${componentPath}/${component}.config.json`;
        let fallbackFilePath = (subcomponent) ? `${componentPath}/${component}.${subcomponent}.config.json` : undefined;
        let configStringJSON;
        try {
            configStringJSON = JSON.stringify(jsonfile.readFileSync(configFilePath));
        }
        catch (err) {
            if (!fallbackFilePath) {
                configStringJSON = JSON.stringify({});
            }
            else {
                try {
                    configStringJSON = JSON.stringify(jsonfile.readFileSync(fallbackFilePath));
                }
                catch (_a) {
                    configStringJSON = JSON.stringify({});
                }
            }
        }
        req.cache.set(component, configStringJSON);
        return configStringJSON;
    }
    getComponentConfigObject(component, req, subcomponent, callback) {
        try {
            let cacheKey = (subcomponent) ? `${component}/${subcomponent}` : component;
            let config = undefined;
            req.cache.get(cacheKey, (err, config) => {
                if (config) {
                    callback(JSON.parse(config));
                    return;
                }
                let configString = avianUtils.setComponentConfigObjectCache(component, req);
                callback(JSON.parse(configString));
            });
            return config;
        }
        catch (error) {
            console.error(error);
            callback({});
        }
    }
    killAllWorkers() {
        let existingWorkers = false;
        for (const id in cluster.workers) {
            existingWorkers = true;
            let worker = cluster.workers[id];
            if (worker)
                worker.kill();
        }
        return existingWorkers;
    }
    setWorkersToAutoRestart() {
        cluster.on("exit", worker => {
            cluster.fork();
        });
    }
}
const avianEmitter = new events.EventEmitter();
let runningBuilds = 0;
avianEmitter.on("buildStarted", () => {
    runningBuilds++;
});
avianEmitter.on("buildCompleted", () => {
    runningBuilds--;
    if (runningBuilds === 0) {
        console.log("Avian - Restarting server");
        avianUtils.killAllWorkers();
        let cores = os.cpus();
        for (let i = 0; i < cores.length; i++) {
            cluster.fork();
        }
    }
});
function startDevWebpackWatcher(webpackDev) {
    let componentsCompiler;
    componentsCompiler = webpack(webpackDev.ComponentsConfig);
    componentsCompiler.hooks.watchRun.tap("Starting", () => {
        avianEmitter.emit("buildStarted", "components");
    });
    let servicesCompiler;
    servicesCompiler = webpack(webpackDev.ServicesConfig);
    servicesCompiler.hooks.watchRun.tap("Starting", () => {
        avianEmitter.emit("buildStarted", "services");
    });
    console.log("Avian - Starting Webpack Watchers");
    const watching = componentsCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.service.*", "node_modules", "serverless"]
    }, watcherCallback);
    servicesCompiler.watch({
        aggregateTimeout: 300,
        poll: 1000,
        ignored: ["components/**/*.component.*", "node_modules", "serverless"]
    }, watcherCallback);
}
const watcherCallback = (err, stats) => {
    if (err || stats.hasErrors()) {
        if (err) {
            console.error(err);
        }
        else if (stats) {
            stats.toJson().errors.forEach((err) => {
                console.error(err);
            });
        }
        console.error("Avian - Encountered compile errors, stopping server");
        avianUtils.killAllWorkers();
        console.error("Avian - Waiting for you to fix compile errors");
        return;
    }
    if (stats.hasWarnings()) {
        stats.toJson().warnings.forEach((warning) => {
            console.log(warning);
        });
    }
    avianEmitter.emit("buildCompleted");
    return;
};
function startProdWebpackCompiler(webpackProd) {
    let webpackCompiler;
    webpackCompiler = webpack([
        webpackProd.ComponentsConfig,
        webpackProd.ServicesConfig
    ]);
    console.log("Avian - Starting Webpack");
    webpackCompiler.run((err, stats) => {
        if (err || stats.hasErrors()) {
            if (err) {
                console.error(err);
            }
            else if (stats) {
                stats.toJson().errors.forEach((err) => {
                    console.error(err);
                });
            }
            console.error("Avian - Encountered compile errors, please fix and restart");
            avianUtils.killAllWorkers();
            return;
        }
        let cores = os.cpus();
        for (let i = 0; i < cores.length; i++) {
            cluster.fork();
        }
        avianUtils.setWorkersToAutoRestart();
    });
}
function loadUserServiesIntoAvian(avian) {
    return __awaiter(this, void 0, void 0, function* () {
        let compiledServices = glob.sync(`${argv.home}/private/**/*.service.js`);
        for (let i = 0; i < compiledServices.length; i++) {
            let dirname = path.dirname(compiledServices[i]);
            let directories = dirname.split("/");
            let routeArray = [];
            for (let j = directories.length - 1; j >= 0; j--) {
                if (directories[j] !== "private") {
                    routeArray.unshift(directories[j]);
                }
                else {
                    break;
                }
            }
            if (routeArray.length === 0) {
                let basename = path.basename(compiledServices[i]);
                if (basename !== "avian.service.js") {
                    let nameArray = basename.split(".");
                    for (let j = 0; j < nameArray.length; j++) {
                        if (nameArray[j] !== "service") {
                            routeArray.push(nameArray[j]);
                        }
                        else {
                            break;
                        }
                    }
                }
            }
            let routeBase = "/" + routeArray.join("/");
            try {
                let service = yield Promise.resolve().then(() => require(`${compiledServices[i]}`));
                let compiledService;
                if (service.default) {
                    compiledService = service.default;
                }
                else {
                    compiledService = service;
                }
                avian.use(routeBase, compiledService);
            }
            catch (err) {
                console.error(err);
            }
        }
    });
}
const avianUtils = new AvianUtils();
if (cluster.isMaster) {
    rimraf.sync(`${argv.home}/private/*`);
    rimraf.sync(`${argv.home}/public/*`);
    let webpackConfigs = glob.sync(`${argv.webpack}/webpack.development.*`);
    webpackConfigs.push(...glob.sync(`${argv.webpack}/webpack.production.*`));
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
    });
    let emitResult = program.emit();
    let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
    allDiagnostics.forEach(diagnostic => {
        if (diagnostic.file) {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
            console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        }
        else {
            console.log(`${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
        }
    });
    if (argv.mode === "development") {
        Promise.resolve().then(() => require(argv.home + "/private/webpack.development")).then(webpackDev => {
            startDevWebpackWatcher(webpackDev);
        }).catch(error => {
            console.log("Avian - Falling back to default dev webpack config");
            startDevWebpackWatcher(defaultWebpackDev);
        });
    }
    else {
        Promise.resolve().then(() => require(argv.home + "/private/webpack.production")).then(webpackProd => {
            startProdWebpackCompiler(webpackProd);
        }).catch(error => {
            console.log("Avian - Falling back to default prod webpack config");
            startProdWebpackCompiler(defaultWebpackProd);
        });
    }
}
else {
    const avian = express();
    avian.use(exports.injectArgv);
    let cookieParser = require("cookie-parser");
    avian.use(cookieParser());
    avian.locals.argv = argv;
    let redisStore = require("connect-redis")(session);
    const enableAuthHeadersForExpressSession = (req, res, next) => {
        if (req.headers.authorization) {
            let authParts = req.headers.authorization.split(" ");
            if (authParts[0].toLowerCase() === "bearer" && authParts.length > 1) {
                let signed = "s:" + signature.sign(authParts[1], argv.sessionSecret);
                req.cookies["connect.sid"] = signed;
            }
        }
        next();
    };
    avian.use(enableAuthHeadersForExpressSession);
    avian.use(session({
        store: new redisStore({ host: "127.0.0.1", db: 1 }),
        proxy: true,
        secret: argv.sessionSecret,
        resave: false,
        saveUninitialized: true,
        cookie: {
            httpOnly: true,
            maxAge: 2592000000
        }
    }));
    avian.use(require("express-redis")(6379, "127.0.0.1", { db: 2 }, "cache"));
    loadUserServiesIntoAvian(avian).then(() => {
        avian.use("/static", express.static(argv.home + "/static"));
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
            }));
            avian.use(require("express-minify")({ cache: argv.home + "/cache" }));
            avian.enable("view cache");
        }
        avian.get("/:component/:subcomponent", parser.urlencoded({ extended: true }), (req, res, next) => {
            let componentRoot = avianUtils.getComponentRoot(req.params.component);
            let subComponentPath = `${componentRoot}/${req.params.subcomponent}`;
            if (!fs.existsSync(`${subComponentPath}`)) {
                next();
                return;
            }
            try {
                avianUtils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config) => {
                    res.locals.req = req;
                    res.setHeader("X-Powered-By", "Avian");
                    res.render(`${subComponentPath}/${req.params.subcomponent}.view.pug`, config, function (err, html) {
                        if (err) {
                            res.render(`${subComponentPath}/${req.params.component}.${req.params.subcomponent}.view.pug`, config);
                        }
                    });
                });
            }
            catch (err) {
                console.error(err);
                res.redirect("/errors");
            }
        });
        avian.get("/:component", parser.urlencoded({ extended: true }), (req, res, next) => {
            let componentRoot = avianUtils.getComponentRoot(req.params.component);
            try {
                avianUtils.getComponentConfigObject(req.params.component, req, undefined, (config) => {
                    res.locals.req = req;
                    res.setHeader("X-Powered-By", "Avian");
                    res.render(`${componentRoot}/${req.params.component}.view.pug`, config);
                });
            }
            catch (err) {
                console.error(err);
                res.redirect("/errors");
            }
        });
        avian.get("/:component/config/objects.json", (req, res, next) => {
            try {
                avianUtils.getComponentConfigObject(req.params.component, req, undefined, (config) => {
                    res.setHeader("X-Powered-By", "Avian");
                    res.json(config);
                });
            }
            catch (err) {
                res.setHeader("X-Powered-By", "Avian");
                res.sendStatus(404);
            }
        });
        avian.get("/:component/:subcomponent/config/objects.json", (req, res, next) => {
            try {
                avianUtils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config) => {
                    res.setHeader("X-Powered-By", "Avian");
                    res.json(config);
                });
            }
            catch (err) {
                res.setHeader("X-Powered-y", "Avian");
                res.sendStatus(404);
            }
        });
        avian.all("/", (req, res, next) => {
            res.redirect("/index");
        });
        const server = avian.listen(argv.port, () => {
            console.log("Avian - Process: %sd, Name: %s, Home: %s, Port: %d, Mode: %s", process.pid, argv.name, argv.home, argv.port, argv.mode);
        });
    });
}
