/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

"use strict";

import * as fs from "fs"

describe("Valance Distribution Files", () => {
    let valance

    beforeEach (() => {
        valance.cli("./dist/valance.cli.js")
        valance.lib("./dist/valance.lib.js")
    })

    it("Checks to see if all distribution files have been built.", () => {

    })
})
