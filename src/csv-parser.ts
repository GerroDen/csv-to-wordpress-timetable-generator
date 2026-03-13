import { createReadStream } from "node:fs";
import z, { ZodError } from "zod";
import csvParse from "csv-parser";
import { uniq } from "es-toolkit";
import { pipeline } from "node:stream/promises";

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
  Alter: z.string(),
  Wochentag: z.enum(csvWeekdays),
  Uhrzeit: z
    .string()
    .regex(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/)
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
  line: string;
  lineNumber: number;
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
  const rawData = await pipeline(createReadStream(csvFile), csvParse(), (data) =>
    Array.fromAsync(data),
  );
  const { data, errors } = rawData.reduce<RawCsvParseResult>(
    (result, line, index) => {
      if (Object.values(line).every((value) => value === "")) {
        return result;
      }
      const parseResult = timetableRowSchema.safeParse(line);
      if (parseResult.success) {
        result.data.push(parseResult.data);
      } else {
        result.errors.push({
          line,
          // index is off by 2 because it starts with 0 and does not contain the headline
          lineNumber: index + 2,
          error: parseResult.error,
        });
      }
      return result;
    },
    { data: [], errors: [] },
  );
  const angebote = uniq(data.map(({ Angebot }) => Angebot)).toSorted();
  return { data, angebote, errors };
}
