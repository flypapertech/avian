import { RequestHandler } from "express"
import * as Avian from "../avian.lib"

export class View {

    public component: RequestHandler = async (req, res, next) => {

        return
    }

    public subComponent: RequestHandler = async (req, res, next) => {
        res.send("Yeah we got here")
    }
}

export class Config {

    public component: RequestHandler = async (req, res, next) => {
        if (req.params.component) {
            console.log("This component called " + req.params.component + " was called")
        }
        res.send(404)
        return
    }

    public subComponent: RequestHandler = async (req, res, next) => {
        if (req.params.component) {
            console.log("This component called " + req.params.component + " was called")
        }
        res.send(404)
        return
    }
}
