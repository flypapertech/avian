/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

"use strict";

export class Avian {

    public params: Object

    constructor (params: Object) {

        let exec = require("child_process").execSync
        let avian_cli = exec(`node avian.cli.js --name ${params.name} `)
    }
}