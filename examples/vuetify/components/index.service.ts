
import { Router } from "express"

const index = Router()

index.get("/test", (req: any, res: any) => {
    res.json({success: true})
})
export default index
