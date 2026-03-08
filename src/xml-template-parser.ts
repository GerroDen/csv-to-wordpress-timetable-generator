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

const xmlItemSchema = z.looseObject({
  title: z.string(),
  "wp:post_id": z.coerce.number(),
  "wp:post_type": cdataSchema,
  "wp:postmeta": z
    .object({
      "wp:meta_key": cdataSchema,
      "wp:meta_value": cdataSchema,
    })
    .array(),
});

const xmlTemplateSchema = z.looseObject({
  rss: z.looseObject({
    channel: z.looseObject({
      item: xmlItemSchema.array(),
      timeslot: z.any().array(),
    }),
  }),
});

export type XmlItem = z.infer<typeof xmlItemSchema>;
export type XmlTemplate = z.infer<typeof xmlTemplateSchema>;

export interface XmlTemplateParseSuccess extends ZodSafeParseSuccess<XmlTemplate> {
  angebote: XmlItem[];
  angebotItemMap: Partial<Record<string, XmlItem>>;
  weekdayItems: XmlItem[];
  weekdayItemMap: Partial<Record<string, XmlItem>>;
}

export type XmlTemplateParseResult = XmlTemplateParseSuccess | ZodSafeParseError<XmlTemplate>;

export async function parseXmlTemplate(xmlFile: string): Promise<XmlTemplateParseResult> {
  const fileContent = await readFile(xmlFile, "utf8");
  const xmlContent = convert(fileContent, { format: "object" });
  const result = xmlTemplateSchema.safeParse(xmlContent);
  if (!result.success) {
    return result;
  }
  const angebote = result.data.rss.channel.item.filter(
    (item) => item["wp:post_type"]["$"] === "mp-event",
  );
  const angebotItemMap = keyBy(angebote, (item) => item.title);
  const weekdayItems = result.data.rss.channel.item.filter((item) =>
    Array.from(item["wp:postmeta"]).some(
      (meta) =>
        meta["wp:meta_key"]["$"] === "column_option" && meta["wp:meta_value"]["$"] === "weekday",
    ),
  );
  const weekdayItemMap = keyBy(weekdayItems, (item) => {
    const weekdayItem = item["wp:postmeta"].find((meta) => meta["wp:meta_key"]["$"] === "weekday");
    return weekdayItem?.["wp:meta_value"].$ ?? "";
  });
  return { ...result, angebote, angebotItemMap, weekdayItems, weekdayItemMap };
}
