import { RequestHandler } from "express"
import * as Avian from "../avian.lib"
import * as fs from "graceful-fs"

/**
 * View
 */
export class View {

    public component: RequestHandler = async (req, res, next) => {
            const componentRoot = Avian.utils.getComponentRoot(req.params.component)

            try {
                res.setHeader("X-Powered-By", "Avian")

                const viewPath = Avian.utils.getComponentViewPath(`${componentRoot}/${req.params.component}.view`)
                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                Avian.utils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
                    res.locals.req = req
                    res.render(viewPath, config)
                })
            } catch (err) {
                console.error(err)
                res.redirect("/errors")
            }
        return
    }

    public subComponent: RequestHandler = async (req, res, next) => {
        // res.send("Yeah we got here")

        const componentRoot = Avian.utils.getComponentRoot(req.params.component)
            const subComponentPath = `${componentRoot}/${req.params.subcomponent}`

            // if the subcomponent directory doesn't exist, move on
            if (!fs.existsSync(`${subComponentPath}`)) {
                next()
                return
                // TODO: Support non-scaffolded sub components, e.g. index.subname.view.ext
            }

            try {
                res.setHeader("X-Powered-By", "Avian")
                let viewPath = Avian.utils.getComponentViewPath(`${subComponentPath}/${req.params.subcomponent}.view`)
                if (viewPath === "") {
                    viewPath = Avian.utils.getComponentViewPath(`${subComponentPath}/${req.params.component}.${req.params.subcomponent}.view`)
                }

                if (viewPath === "") {
                    res.sendStatus(404)
                    return
                }

                Avian.utils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config: any) => {
                    res.locals.req = req
                    res.render(viewPath, config)
                })
            } catch (err) {
                console.error(err)
                res.redirect("/errors")
            }
    }
}
/**
 * Config
 */
export class Config {

    public component: RequestHandler = async (req, res, next) => {
       try {
                Avian.utils.getComponentConfigObject(req.params.component, req, undefined, (config: any) => {
                    res.setHeader("X-Powered-By", "Avian")
                    res.json(config)
                })
            } catch (err) {
                res.setHeader("X-Powered-By", "Avian")
                res.sendStatus(404)
            }
    }

    public subComponent: RequestHandler = async (req, res, next) => {
        try {
                Avian.utils.getComponentConfigObject(req.params.component, req, req.params.subcomponent, (config: any) => {
                    res.setHeader("X-Powered-By", "Avian")
                    res.json(config)
                })
            } catch (err) {
                res.setHeader("X-Powered-By", "Avian")
                res.sendStatus(404)
            }
    }
}
