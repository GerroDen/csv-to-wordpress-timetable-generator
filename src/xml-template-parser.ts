import { keyBy } from "es-toolkit";
import { readFile } from "node:fs/promises";
import { convert } from "xmlbuilder2";
import z, { ZodSafeParseError, ZodSafeParseSuccess } from "zod";

export const xmlWeekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

const cdataSchema = z.object({ $: z.string() });

const postmetaSchema = z.object({
  "wp:meta_key": cdataSchema,
  "wp:meta_value": cdataSchema,
});
const xmlItemSchema = z.looseObject({
  title: z.string(),
  "wp:post_id": z.coerce.number(),
  "wp:post_type": cdataSchema,
  "wp:postmeta": z
    .union([postmetaSchema.array(), postmetaSchema])
    .transform((value) => (Array.isArray(value) ? value : [value])),
});

const xmlTemplateSchema = z.looseObject({
  rss: z.looseObject({
    channel: z.looseObject({
      item: xmlItemSchema.array(),
      timeslot: z.any().array(),
    }),
  }),
});

export type PostMeta = z.infer<typeof postmetaSchema>;
export type XmlItem = z.infer<typeof xmlItemSchema>;
export type XmlTemplate = z.infer<typeof xmlTemplateSchema>;
export type ItemMap = Partial<Record<string, XmlItem>>;

function isAngebotXmlItem(item: XmlItem): boolean {
  return item["wp:post_type"]["$"] === "mp-event";
}

export interface ItemCollection {
  items: XmlItem[];
  itemMap: ItemMap;
  labels: string[];
}

export function collectAngebote(xml: XmlTemplate): ItemCollection {
  const items = xml.rss.channel.item.filter(isAngebotXmlItem);
  const itemMap = keyBy(items, (item) => item.title);
  const labels = Object.keys(itemMap).toSorted();
  return { items, itemMap, labels };
}

export function collectWeekdays(xml: XmlTemplate): ItemCollection {
  const items = xml.rss.channel.item.filter((item) =>
    item["wp:postmeta"].some(
      (meta) =>
        meta["wp:meta_key"]["$"] === "column_option" && meta["wp:meta_value"]["$"] === "weekday",
    ),
  );
  const itemMap = keyBy(items, (item) => {
    const weekdayItem = item["wp:postmeta"].find((meta) => meta["wp:meta_key"]["$"] === "weekday");
    return weekdayItem?.["wp:meta_value"].$ ?? "";
  });
  const labels = Object.keys(itemMap).toSorted(
    (a, b) => xmlWeekdays.indexOf(a as never) - xmlWeekdays.indexOf(b as never),
  );
  return { items, itemMap, labels };
}

export interface XmlTemplateParseSuccess extends ZodSafeParseSuccess<XmlTemplate> {
  angebote: ItemCollection;
  weekdays: ItemCollection;
}

export type XmlTemplateParseResult = XmlTemplateParseSuccess | ZodSafeParseError<XmlTemplate>;

export async function parseXmlTemplate(xmlFile: string): Promise<XmlTemplateParseResult> {
  const fileContent = await readFile(xmlFile, "utf8");
  const xmlContent = convert(fileContent, { format: "object" });
  const result = xmlTemplateSchema.safeParse(xmlContent);
  if (!result.success) {
    return result;
  }
  const angebote = collectAngebote(result.data);
  const weekdays = collectWeekdays(result.data);
  return {
    ...result,
    angebote,
    weekdays,
  };
}
