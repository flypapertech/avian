/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

"use strict";

import * as fs from "fs"
import * as jasmine from "jasmine"

jasmine.describe("Avian Distribution Files", () => {
    let avian

    jasmine.beforeEach (() => {
        avian.cli("./dist/avian.cli.js")
        avian.lib("./dist/avian.lib.js")
    })

    jasmine.it("Checks to see if all distribution files have been built.", () => {

    })
})
