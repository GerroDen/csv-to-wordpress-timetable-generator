import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { csvToWordPressTimetable } from "./csv-to-wordpress-timetable";

describe("csvToWordPressTimetable", () => {
  it("converts csv to wordpress timetable", async () => {
    const csv = resolve(__dirname, "__fixtures__/timetable.csv");
    const xmlTemplate = resolve(__dirname, "__fixtures__/timetable_export.xml");

    const result = await csvToWordPressTimetable({ csv, xmlTemplate });

    expect(result).toMatchSnapshot();
  });
});
