import * as yargs from "yargs"
import { RedisClient } from "redis"
import * as os from "os"

/** 
 * Avian Library
 * @description Responsible for various exports that can be used in Avian applications.
 */

/** 
 * Avian Library Interfaces
 * @description To be exported at build time to avian.lib.d.ts
 */
declare global {
  namespace Express {
    interface Request {
      argv: typeof argv
      cache: RedisClient
      logger: any
      sessionSecret: string
    }
  }
}

/** 
 * Avian CLI Arguments
 * @description Both Avian as well as Avian applications can import these objects 
 */
export const argv = yargs
  .env("AVIAN_APP")
  .option("name", {
    alias: "n",
    default: process.env.HOSTNAME || os.hostname,
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
    default: os.hostname
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
    default: os.hostname
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
