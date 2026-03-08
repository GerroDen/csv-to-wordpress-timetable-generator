#!/usr/bin/env node
import { writeFile, readFile } from "node:fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { csvToWordPressTimetable } from "./src/csv-to-wordpress-timetable.js";

const argv = await yargs(hideBin(process.argv))
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
  .parse();
const csvContent = await readFile(argv.csv, "utf8");
const xmlTemplate = await readFile(argv.xml, "utf8");
const outXml = await csvToWordPressTimetable({
  csv: csvContent,
  xmlTemplate,
});
await writeFile(argv.out, outXml, { encoding: "utf8" });
