/// <reference path="../typings/index.d.ts" />

/* tslint:enable */

"use strict";

export class Avian {

    public name: string
    public home: string
    public port: string
    public mode: string

    constructor (name: string, home: string, port: string, mode: string) {

        this.name = name || process.env.AVIAN_APP_NAME || process.env.HOSTNAME
        this.home = home || process.env.AVIAN_APP_HOME || process.env.HOSTNAME
        this.port = port || process.env.AVIAN_APP_PORT || process.env.HOSTNAME
        this.mode = mode || process.env.AVIAN_APP_MODE || process.env.HOSTNAME
    }

    start() {

        let exec = require("child_process").execSync
        let avian_cli = exec(`node avian.cli.js --name ${this.name} --home ${this.home}`)
    }
}