import jsonfile = require("jsonfile")
import * as yargs from "yargs"
import { RedisClient } from "redis"
import { DateTime } from "luxon"

import * as ComponentServices from "./services/Component"

// import * as LoggerRoutes from "./logger.routes"

// import { LoggerService } from "./services/Logger"

// new LoggerService().entry

import { Request, Router } from "express"
import * as glob from "glob"
import * as cluster from "cluster"
import * as os from "os"
import * as fs from "fs"

/** 
 * Avian Express Namespace & Interfaces
 * @description To be exported at build time to avian.lib.d.ts
 * @interface
 */
declare global {
    namespace Express {
        interface Request {
            argv: typeof argv
            cache: RedisClient
            epilogues: any
            log: any
            logger: any
            sessionSecret: string,
        }
    }

    namespace CronJob {
         interface Params {
            args: string[],
            command: string,
            description: string
            enabled: boolean,
            expression: string,
            name: string
        }
        interface Results extends Params {
            success: boolean
        }
    }
}

/**
 * Avian Argv
 * @description All command line arguments and options, as well as environment variables honored by then, are available to Avian here.
 * @class
 * @global
 */
export class Argv {
    
    public argv = yargs
    .env("AVIAN_APP") 
    .option("name", {
        alias: "n",
        default: process.env.HOSTNAME || "localhost",
        describe: "The name of your application"
    })
    .option("home", {
        alias: "h",
        default: process.cwd(),
        defaultDescription: "current working directory",
        describe: "The directory of your application."
    })
    .option("mode", {
        alias: "m",
        default: process.env.NODE_ENV || "development",
        describe: "Deployment mode to run Avian in.",
        choices: ["development", "production"]
    })
    .option("port", {
        alias: "p",
        default: 8080,
        describe: "Which port to serve your application on."
    })
    .option("defaultComponent", {
        alias: "dc",
        default: "index",
        describe: "The point of entry to your application."
    })
    .option("spa", {
        default: false,
        describe: "Start Avian in a single-page-application configuration.",
        type: "boolean"
    })
    .option("bundleSkip", {
        default: false,
        type: "boolean"
    })
    .option("bundleOnly", {
        default: false,
        type: "boolean"
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
    .option("redisCronSchedulerDB", {
        default: 3
    })
    .option("webpackHome", {
        default: ""
    })
    .option("logger", {
        alias: "l",
        describe: "Which logging framework to use.",
        choices: ["bunyan", "fluent"]
    })
    .option("loggerFluentLabel", {
        alias: "lfl",
        default: "debug"
    })
    .option("loggerFluentTag", {
        alias: "lft",
        default: "debug"
    })
    .option("loggerFluentHost", {
        alias: "lfh",
        default: "127.0.0.1"
    })
    .option("loggerFluentPort", {
        alias: "lfp",
        default: 24224
    })
    .option("sslCert", {
        type: "string"
    })
    .option("sslKey", {
        type: "string"
    })
    .option("cronJobScheduler", {
        alias: "cjs",
        default: false,
        describe:
        "Avian components are capable of scheduling cron-like jobs that are executed on the server.",
        type: "boolean"
    }).argv
}

export const argv = new Argv().argv

/**  
 * Avian Server Namespace
 * @namespace
 */
export namespace Server {

    /** 
     * Server Constructor Interface 
     * @interface
     */
    export interface IServerConstructorParams {
        argv: typeof argv
    }
    export interface IStartMethodParams {
            argv: typeof argv,
            timeout: DateTime
        }
    }
/**
 * Avian Server
 * @description
 * @class
 * @global
 * @
 */

/*export class Server implements Server {

    public avian: object
    
    constructor(argv: Server.IServerConstructorParams) {
        this.avian = { ...argv }

        this.avian
    }
    public start(params?: any) {

        if (this.avian. === "development") {

        }

        if (params.timeout)
    }
}

export const server = new Server(argv)*/

/** 
 * Avian Services
 * @description Responsible for various exports that can be used in Avian applications.
 */

export class Services {

    public routes = [
        {
            path: "/:component",
            method: Router().get,
            action: new ComponentServices.View().component
        },
        {
            path: "/:component/config/objects.json",
            method: Router().get,
            action: new ComponentServices.Config().component
        },
        {
            path: "/:component/:subcomponent",
            method: Router().get,
            action: new ComponentServices.View().subComponent
        },
        {
            path: "/:component/:subcomponent/config/objects.json",
            method: Router().get,
            action: new ComponentServices.Config().subComponent
        },
    ]
}

export const services = new Services().routes

/**
 * Avian Utilities
 * @description A class filled with useful utilities that are very specific to Avian core development.
 */
export class Utils {

    /**
     * Gets component config object
     * @param component 
     * @param req 
     * @param subcomponent 
     * @param callback 
     * @returns  
     */
    public getComponentConfigObject(component: string, req: Request, subcomponent: string | undefined, callback: Function) {
        try {
            const cacheKey = (subcomponent) ? `${component}/${subcomponent}` : component
            const config: any = {}
            req.cache.get(cacheKey, (err, config) => {
                if (config) {
                    callback(JSON.parse(config))
                    return
                }

                const configString = this.setComponentConfigObjectCache(component, req, subcomponent)
                callback(JSON.parse(configString))
            })

            return config
        } catch (error) {
            console.error(error)
            callback({})
        }
    }
    /**
     * Gets component root
     * @param component 
     * @returns component root 
     */
    public getComponentRoot(component: string): string {
        if (fs.existsSync(`${argv.home}/components/${component}`))
            return `${argv.home}/components/${component}`
        else
            return `${argv.home}/components`
    }
    /**
     * Gets component view path
     * @param pathToViewFileWithoutExtension 
     * @returns component view path 
     */
    public getComponentViewPath(pathToViewFileWithoutExtension: string): string {
        try {
            const matches = glob.sync(`${pathToViewFileWithoutExtension}.*`)
            return matches.length === 0 ? "" : matches[0]
        } catch (err) {
            return ""
        }
    }
    /**
     * Determines whether avian running is
     * @returns true if avian running 
     */
    public isAvianRunning(): boolean {
        return Object.keys(cluster.workers).length > 0
    }
    /**
     * Kills all workers
     * @returns true if all workers 
     */
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

    /**
     * Sets component config object cache
     * @param component 
     * @param req 
     * @param [subcomponent] 
     * @returns component config object cache 
     */
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

    /**
     * Sets workers to auto restart
     */
    public setWorkersToAutoRestart() {
        cluster.on("exit", (worker) => {
            cluster.fork()
        })
    }

    /**
     * Starts all workers
     */
    public startAllWorkers() {
        const cores = os.cpus()
        for (let i = 0 ; i < cores.length ; i++) {
            cluster.fork()
        }
    }
}

export const utils = new Utils()
