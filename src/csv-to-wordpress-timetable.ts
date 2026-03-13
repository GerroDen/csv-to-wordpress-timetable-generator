import { create } from "xmlbuilder2";
import { parseXmlTemplate, collectAngebote, collectWeekdays } from "./xml-template-parser";
import { xmlToCsv } from "./xml-to-csv";
import { parseCsv } from "./csv-parser";
import { prettifyError } from "zod";

interface CsvToWordPressTimetableParams {
  csv: string;
  xmlTemplate: string;
}

export async function csvToWordPressTimetable(
  params: CsvToWordPressTimetableParams,
): Promise<string> {
  const [csv, xmlTemplate] = await Promise.all([
    parseCsv(params.csv),
    parseXmlTemplate(params.xmlTemplate),
  ]);
  console.info(`finished loading CSV`);
  console.info(`  ${csv.data.length} lines`);
  console.info(`  ${csv.angebote.length} angebote`, csv.angebote);
  if (csv.errors.length) {
    const errorMessages = csv.errors
      .map(
        ({ lineNumber, error }) =>
          `  In line ${lineNumber}: ${prettifyError(error).replaceAll("\n", "\n  ")}`,
      )
      .join("\n");
    console.warn(`Some invalid data was found in CSV:\n${errorMessages}`);
  }
  if (xmlTemplate.error) {
    console.error(`Xml file contains errors:\n` + `${prettifyError(xmlTemplate.error)}`);
    throw new Error("invalid xml");
  }
  console.info(`loaded timetable from base XML`);
  console.info(`  ${xmlTemplate.data.rss.channel.timeslot.length} timeslots`);
  console.info(`  ${xmlTemplate.angebote.labels.length} angebote`, xmlTemplate.angebote.labels);
  const xml = xmlToCsv({ xmlTemplate, csv });
  const angebote = collectAngebote(xml);
  const weekdays = collectWeekdays(xml);
  const timeslots = xml.rss.channel.timeslot;
  console.info(`generated xml`);
  console.info(`  ${angebote.labels.length} angebote`, angebote.labels);
  console.info(`  ${weekdays.labels.length} weekdays`, weekdays.labels);
  console.info(`  ${timeslots.length} timeslots`);
  return create({ version: "1.0", encoding: "UTF-8" }).ele(xml).end({ prettyPrint: true });
}
