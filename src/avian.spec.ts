/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

"use strict";

import * as fs from "fs"

describe("Avian Distribution Files", () => {
    let avian

    beforeEach (() => {
        avian.cli("./dist/avian.cli.js")
        avian.lib("./dist/avian.lib.js")
    })

    it("Checks to see if all distribution files have been built.", () => {

    })
})
