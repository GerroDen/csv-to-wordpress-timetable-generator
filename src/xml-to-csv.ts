import { zipObject } from "es-toolkit";
import { XmlItem, XmlTemplate, XmlTemplateParseSuccess, xmlWeekdays } from "./xml-template-parser";
import materialColors from "material-colors";
import { CsvParseResult, csvWeekdays, TimetableRow } from "./csv-parser";
import { uniqueId } from "es-toolkit/compat";

const paletteColors = [
  "red",
  "pink",
  "purple",
  "deepPurple",
  "indigo",
  "blue",
  "lightBlue",
  "cyan",
  "teal",
  "green",
  "lightGreen",
  "lime",
  "yellow",
  "amber",
  "orange",
  "deepOrange",
] as const;

const colors = Object.freeze([
  ...paletteColors.map((color) => materialColors[color][50]),
  ...paletteColors.map((color) => materialColors[color][300]),
]);

const weekdaysCsvToXml = zipObject(csvWeekdays, xmlWeekdays);

function generateBaseXml(xmlTemplate: XmlTemplate): XmlTemplate {
  const baseXml = structuredClone(xmlTemplate);
  baseXml.rss.channel.item = [];
  baseXml.rss.channel.timeslot = [];
  return baseXml;
}

function generateAngebot(
  xmlTemplate: XmlTemplateParseSuccess,
): (angebot: string, index: number) => XmlItem {
  return (angebot, index) => {
    return {
      ...structuredClone(xmlTemplate.angebote[0]),
      title: angebot,
      "wp:post_id": xmlTemplate.angebotItemMap[angebot]?.["wp:post_id"] ?? 100 + index,
      "wp:post_name": { $: angebot.toLowerCase().replace(/\s+/g, "-") },
      "wp:postmeta": [
        {
          "wp:meta_key": { $: "color" },
          "wp:meta_value": {
            $: colors[index % colors.length],
          },
        },
      ],
    };
  };
}

function generateTimeslot(
  xmlTemplate: XmlTemplateParseSuccess,
): (csvLine: TimetableRow) => XmlItem {
  return (csvLine) => {
    const xmlWeekday = weekdaysCsvToXml[csvLine.Wochentag];
    return {
      ...structuredClone(xmlTemplate.data.rss.channel.timeslot[0]),
      column: { $: xmlTemplate.weekdayItemMap[xmlWeekday]?.["wp:post_id"] ?? uniqueId("100") },
      event: {
        $: xmlTemplate.angebotItemMap[csvLine.Angebot]?.["wp:post_id"] ?? uniqueId("100"),
      },
      event_start: { $: csvLine.Uhrzeit.start + ":00" },
      event_end: { $: csvLine.Uhrzeit.end + ":00" },
      description: { $: csvLine.Alter },
    };
  };
}

interface XmlToCsvParams {
  csv: CsvParseResult;
  xmlTemplate: XmlTemplateParseSuccess;
}

export function xmlToCsv({ xmlTemplate, csv }: XmlToCsvParams): XmlTemplate {
  const xml = generateBaseXml(xmlTemplate.data);
  xml.rss.channel.item.push(...structuredClone(xmlTemplate.weekdayItems));
  xml.rss.channel.item.push(...csv.angebote.map(generateAngebot(xmlTemplate)));
  xml.rss.channel.timeslot.push(...csv.data.map(generateTimeslot(xmlTemplate)));
  return xml;
}
