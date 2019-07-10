import { RequestHandler } from "express"
import { argv } from "../avian.lib"
import * as crypto from "crypto"

const injectArgv: RequestHandler = (req, res, next) => {
    req.argv = {...argv}
    try 
        { 
            req.sessionSecret = process.env.AVIAN_APP_SESSION_SECRET || crypto.createHash("sha512").digest("hex")
            next()
 
        } 
        catch(error) { 
            res.status(500).send("Unable to determine a session secret. So Avian Args will noe be available to your service rourtes")
        }
    }

export default injectArgv
