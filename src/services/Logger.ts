import { RequestHandler } from "express"
import { argv } from "../avian.lib"

export class Logger {

    public entry: RequestHandler = async (req, res, next) => {
        if (!req.query || !req.body) {
            res.sendStatus(400)
            return
        }

        if (!req.argv.logger) {
            res.sendStatus(404)
            return
        }

        switch (req.argv.logger) {
            case "bunyan":
                if (req.query.level === "debug") {
                    req.log.debug(req.body)
                }
                if (req.query.level === "info") {
                    req.log.info(req.body)
                }
                if (req.query.level === "error") {
                    req.log.error(req.body)
                }
                if (req.query.level === "warn") {
                    req.log.warn(req.body)
                }
                if (req.query.level === "fatal") {
                    req.log.fatal(req.body)
                }
                if (req.query.level === "trace") {
                    req.log.trace(req.body)
                }
                break
            case "fluent":
                req.logger.emit(
                    req.query.label || argv.loggerFluentLabel, 
                    { source: req.query.source || null, level: req.query.level || "info", mode: req.argv.mode, record: req.body })
                break
            }

        res.status(200).send("You did something right?")
        return
    }
}
