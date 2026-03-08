#!/usr/bin/env node
import { writeFile, readFile } from "node:fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { csvToWordPressTimetable } from "./src/csv-to-wordpress-timetable.js";
import { alias } from "yargs";

const argv = await yargs(hideBin(process.argv))
  .usage("Usage: $0 --csv [file] --xml [file] --out [file]")
  .options({
    csv: {
      string: true,
      demandOption: true,
      desc: "CSV export from Google Sheet",
    },
    xmlTemplate: {
      alias: "xml",
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
const outXml = await csvToWordPressTimetable(argv);
await writeFile(argv.out, outXml, { encoding: "utf8" });
