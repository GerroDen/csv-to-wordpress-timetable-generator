import { createReadStream } from "node:fs";
import { finished, pipeline } from "node:stream/promises";
import z, { ZodError } from "zod";
import { parse } from "csv-parse";
import { uniq } from "es-toolkit";

export const csvWeekdays = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

export const timetableRowSchema = z.object({
  Angebot: z.string().trim(),
  Alter: z.number(),
  Wochentag: z.enum(csvWeekdays),
  Uhrzeit: z
    .string()
    .regex(/\d+:\d+-\d+:\d+/)
    .transform((value) => {
      const parts = value.split("-");
      return {
        start: parts[0]?.trim(),
        end: parts[1]?.trim(),
      };
    }),
  Ort: z.string().trim(),
  Ansprechpartner: z.string().trim(),
});

export type TimetableRow = z.infer<typeof timetableRowSchema>;

interface CsvLineError {
  line: number;
  error: ZodError;
}

interface RawCsvParseResult {
  data: TimetableRow[];
  errors: CsvLineError[];
}

export interface CsvParseResult extends RawCsvParseResult {
  angebote: string[];
}

export async function parseCsv(csvFile: string): Promise<CsvParseResult> {
  const rawData = await pipeline(createReadStream(csvFile), parse(), Array.fromAsync);
  const { data, errors } = rawData.reduce<RawCsvParseResult>(
    (result, line, lineNumber) => {
      const parseResult = timetableRowSchema.safeParse(line);
      if (parseResult.success) {
        result.data.push(parseResult.data);
      } else {
        result.errors.push({
          line: lineNumber,
          error: parseResult.error,
        });
      }
      return result;
    },
    { data: [], errors: [] },
  );
  const angebote = uniq(data.map(({ Angebot }) => Angebot));
  return { data, angebote, errors };
}
