#!/usr/bin/env node
const { csvToWordPressTimetable } = require("./csv-to-wordpress-timetable");
const fs = require("fs").promises;

(async function () {
    const csvFile = process.argv[2];
    const xmlFile = process.argv[3];
    const xml = await csvToWordPressTimetable({ csvFile, xmlFile });
    console.log(xml);
})();
