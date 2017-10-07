"use strict";

exports.__esModule = true;

var jasmine = require("jasmine");

jasmine.describe("Avian Distribution Files", function() {
    var avian;
    jasmine.beforeEach(function() {
        avian.cli("./dist/avian.cli.js");
        avian.lib("./dist/avian.lib.js");
    });
    jasmine.it("Checks to see if all distribution files have been built.", function() {});
});