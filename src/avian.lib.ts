/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

"use strict";

export class Avian {

    public arguments: string

    constructor (params: string) {

        this.arguments = params

        let exec = require("child_process").execSync
        let avian_cli = exec(`node avian.cli.js ${this.arguments} `)
    }
}