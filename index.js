#!/usr/bin/node
const { csvToWordPressTimetable } = require("./csv-to-wordpress-timetable");
const fs = require("fs").promises;

(async function () {
    const csvFile = process.argv[2];
    const xml = await csvToWordPressTimetable(csvFile);
    console.log(xml);
})();
