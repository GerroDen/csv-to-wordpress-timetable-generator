const fs from"fs").promises
const path from"path")
const { describe, expect, it } from"@jest/globals")
const { csvToWordPressTimetable } from"./csv-to-wordpress-timetable")

const csvFile = path.resolve(__dirname, "__fixtures__/timetable.csv")
const xmlFile = path.resolve(__dirname, "__fixtures__/timetable_export.xml")

describe("csvToWordPressTimetable", () => {
    it("converts csv to wordpress timetable", async () => {
        const result = await csvToWordPressTimetable({ csvFile, xmlFile })

        expect(result).toMatchSnapshot()
    });
});
