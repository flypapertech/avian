"use strict"

const express = require("express")
const router = express.Router()

router.get("/test", (req, res) => {
    res.json({success: true})
})


module.exports = router
