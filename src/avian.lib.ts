import * as yargs from "yargs";
import { RedisClient } from "redis";
declare global {
  namespace Express {
    interface Request {
      argv: typeof argv;
      cache: RedisClient;
      logger: any;
      sessionSecret: string;
    }
  }
}

export const argv = yargs
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
  .option("webpackHome", {
    default: process.cwd()
  })
  .option("logger", {
    alias: "l",
    describe: "Which logging framework to use.",
    choices: ["bunyan", "fluent"]
  })
  .option("loggerFluentTag", {
    alias: "lt",
    default: "debug"
  })
  .option("loggerFluentHost", {
    alias: "lh",
    default: "127.0.0.1"
  })
  .option("loggerFluentPort", {
    alias: "lp",
    default: 24224
  })
  .option("sslCert", {
    type: "string"
  })
  .option("sslKey", {
    type: "string"
  })
  .option("jobScheduler", {
    alias: "js",
    default: false,
    describe:
      "Avian components are capable of scheduling cron-like jobs that are executed on the server.",
    type: "boolean"
  }).argv
