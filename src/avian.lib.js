"use strict";

exports.__esModule = true;

var Avian = function() {
    function Avian(params) {
        var exec = require("child_process").execSync;
        var avian_cli = exec("node avian.cli.js --name " + params.name + " ");
    }
    return Avian;
}();

exports.Avian = Avian;