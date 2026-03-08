import { create } from "xmlbuilder2";
import { parseXmlTemplate } from "./xml-template-parser";
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
  console.info(
    `finished loading CSV with ${csv.data.length} lines and ${csv.angebote.length} angebote`,
  );
  if (csv.errors.length) {
    console.warn(
      "Some invalid data was found in CSV.\n" +
        csv.errors.map(({ line, error }) => `  In line ${line}: ${prettifyError(error)}\n`),
    );
  }
  if (xmlTemplate.error) {
    console.error(`Xml file contains errors.\n` + `  ${prettifyError(xmlTemplate.error)}`);
    throw new Error("aborted");
  }
  console.info(
    `loaded base timetable from XML with ${xmlTemplate.data.rss.channel.timeslot.length} timeslots and ${xmlTemplate.angebote.length} angebote`,
  );
  const xml = xmlToCsv({ xmlTemplate, csv });
  console.info(`angebote are`, xml.angebote);
  console.info(`number of timeslots is ${xml.rss.channel.timeslot.length}`);
  return create({ version: "1.0", encoding: "UTF-8" }).ele(xml).end({ prettyPrint: true });
}
