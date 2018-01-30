/// <reference path="../node_modules/@types/node/index.d.ts" />
/// <reference path="../node_modules/@types/express/index.d.ts" />

/* tslint:enable */

"use strict";

const express = require("express")
const router = express.Router()

router.get("/test", (req, res) => {
    res.json({success: true})
})

module.exports = router
