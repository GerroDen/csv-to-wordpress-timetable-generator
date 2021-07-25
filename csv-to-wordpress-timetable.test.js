const fs = require("fs").promises;
const path = require("path");
const { describe, expect, it } = require("@jest/globals");
const { convert } = require("xmlbuilder2");
const { csvToWordPressTimetable } = require("./csv-to-wordpress-timetable");

const csvFile = path.resolve(__dirname, "__fixtures__/timetable.csv");
const xmlFile = path.resolve(__dirname, "__fixtures__/timetable_export.xml");

describe("csvToWordPressTimetable", () => {
    it("converts csv to wordpress timetable", async () => {
        const xml = await fs.readFile(xmlFile, { encoding: "utf8" });

        const result = await csvToWordPressTimetable({ csvFile, xmlFile });

        expect(result).toMatchSnapshot();
    });
});
