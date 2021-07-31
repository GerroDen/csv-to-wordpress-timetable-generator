#!/usr/bin/env node
const fs = require("fs").promises;
const yargs = require("yargs/yargs");
const { csvToWordPressTimetable } = require("./csv-to-wordpress-timetable");

(async function () {
    const argv = yargs(process.argv.slice(2))
        .usage("Usage: $0 --csv [file] --xml [file] --out [file]")
        .options({
            csv: {
                string: true,
                demandOption: true,
                desc: "CSV export from Google Sheet",
            },
            xml: {
                string: true,
                demandOption: true,
                desc: "XML export from WordPress timetable plugin",
            },
            out: {
                string: true,
                demandOption: true,
                desc: "output file path",
            },
        })
        .argv;
    const xml = await csvToWordPressTimetable({
        csvFile: argv.csv,
        xmlFile: argv.xml,
    });
    await fs.writeFile(argv.out, xml, { encoding: "utf8" });
})();
