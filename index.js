#!/usr/bin/env node
import { promises as fs } from "fs";
import yargs from "yargs/yargs";
import { csvToWordPressTimetable } from "./src/csv-to-wordpress-timetable.js";

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
