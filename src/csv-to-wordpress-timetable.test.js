import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { describe, expect, it } from "@jest/globals"
import { csvToWordPressTimetable } from "./csv-to-wordpress-timetable"

const __dirname = dirname(fileURLToPath(import.meta.url))
const csvFile = resolve(__dirname, "__fixtures__/timetable.csv")
const xmlFile = resolve(__dirname, "__fixtures__/timetable_export.xml")

describe("csvToWordPressTimetable", () => {
    it("converts csv to wordpress timetable", async () => {
        const result = await csvToWordPressTimetable({ csvFile, xmlFile })

        expect(result).toMatchSnapshot()
    });
});
