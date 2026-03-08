import { describe, expect, it } from "vitest";
import { csvToWordPressTimetable } from "./csv-to-wordpress-timetable";
import csv from "./__fixtures__/timetable.csv";
import xmlTemplate from "./__fixtures__/timetable_export.xml";

describe("csvToWordPressTimetable", () => {
  it("converts csv to wordpress timetable", async () => {
    const result = await csvToWordPressTimetable({ csv, xmlTemplate });

    expect(result).toMatchSnapshot();
  });
});
