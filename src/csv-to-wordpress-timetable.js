import fs from "fs";
import csvParser from "csv-parser";
import { create } from "xmlbuilder2";
import { groupBy, cloneDeep, zipObject, chain, castArray } from "lodash-es";
import { convert } from "xmlbuilder2";
import materialColors from "material-colors";
import colors from "material-colors";
import { finished } from "stream/promises";

class CsvAccessor {
    constructor(csv) {
        this.data = csv.map((line) => new CsvLineAccessor(line));
    }

    static async parse(csvFile) {
        const csv = await parseCsv(csvFile);
        return new CsvAccessor(csv);
    }

    get angebotMap() {
        return groupBy(this.data, (entry) => entry.Angebot);
    }

    get angebote() {
        return Object.keys(this.angebotMap);
    }

    get length() {
        return this.data.length;
    }

    [Symbol.iterator]() {
        return this.data.values();
    }

    static weekdays = [
        "Montag",
        "Dienstag",
        "Mittwoch",
        "Donnerstag",
        "Freitag",
        "Samstag",
        "Sonntag",
    ];
}

class CsvLineAccessor {
    constructor(line) {
        for (const key in line) {
            this[key] = line[key];
        }
    }

    get timeslot() {
        const parts = this.Uhrzeit.split("-");
        if (parts.length !== 2) return undefined;
        return {
            start: parts[0]?.trim(),
            end: parts[1]?.trim(),
        };
    }
}

class XmlAccessor {
    constructor(xml) {
        this.data = xml;
    }

    static async parse(xmlFile) {
        const xmlString = await fs.promises.readFile(xmlFile, { encoding: "utf8" });
        const xml = convert(xmlString, { format: "object" });
        return new XmlAccessor(xml);
    }

    get items() {
        return this.data.rss.channel.item;
    }

    get timeslots() {
        return this.data.rss.channel.timeslot;
    }

    get weekdayItems() {
        return this.items.filter((item) =>
            castArray(item["wp:postmeta"]).some(
                (meta) =>
                    meta["wp:meta_key"]["$"] === "column_option" &&
                    meta["wp:meta_value"]["$"] === "weekday"
            )
        );
    }

    get weekdayItemMap() {
        return chain(this.weekdayItems)
            .groupBy(
                (item) =>
                    castArray(item["wp:postmeta"]).find(
                        (meta) => meta["wp:meta_key"]["$"] === "weekday"
                    )["wp:meta_value"]["$"]
            )
            .mapValues((values) => values[0])
            .value();
    }

    get weekdays() {
        return Object.keys(this.weekdayItemMap);
    }

    get angebotItems() {
        return this.items.filter(
            (item) => item["wp:post_type"]["$"] === "mp-event"
        );
    }

    get angebotItemMap() {
        return chain(this.angebotItems)
            .groupBy((item) => item.title)
            .mapValues((values) => values[0])
            .value();
    }

    get angebote() {
        return Object.keys(this.angebotItemMap);
    }

    /**
     * @param {string} angebot
     * @returns string
     */
    getAngebotId(angebot) {
        const angebotItem = this.angebotItemMap[angebot];
        if (angebotItem) return angebotItem["wp:post_id"];
        return undefined;
    }

    static weekdays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ];
}

class XmlToCsv {
    /**
     * @param {object} params
     * @param {XmlAccessor} params.xml
     * @param {CsvAccessor} params.csv
     */
    constructor({ xml, csv }) {
        this.xml = xml;
        this.csv = csv;
        this.weekdaysCsvToXml = zipObject(
            CsvAccessor.weekdays,
            XmlAccessor.weekdays
        );
    }

    generate() {
        const xml = this.generateBaseXml();
        xml.rss.channel.item.push(...cloneDeep(this.xml.weekdayItems));
        xml.rss.channel.item.push(
            ...this.csv.angebote.map(this.generateAngebot.bind(this))
        );
        xml.rss.channel.timeslot.push(
            ...this.csv.data
                .filter((line) => line.timeslot !== undefined)
                .map(this.generateTimeslot.bind(this))
        );
        const newXml = new XmlAccessor(xml);
        console.info(`angebote are ${newXml.angebote}`);
        console.info(`number of timeslots is ${newXml.timeslots.length}`);
        return xml;
    }

    generateBaseXml() {
        const baseXml = cloneDeep(this.xml.data);
        baseXml.rss.channel.item = [];
        baseXml.rss.channel.timeslot = [];
        return baseXml;
    }

    /**
     * @param {string} csvLine
     * @param {number} index
     */
    generateAngebot(angebot, index) {
        return {
            ...cloneDeep(this.xml.angebotItems[0]),
            title: angebot,
            "wp:post_id": this.xml.getAngebotId(angebot) ?? 100 + index,
            "wp:post_name": { $: angebot.toLowerCase().replace(/\s+/g, "-") },
            "wp:postmeta": [
                {
                    "wp:meta_key": { $: "color" },
                    "wp:meta_value": {
                        $: XmlToCsv.colors[index % XmlToCsv.colors.length],
                    },
                },
            ],
        };
    }

    /**
     * @param {CsvLineAccessor} csvLine
     */
    generateTimeslot(csvLine) {
        const xmlWeekday = this.weekdaysCsvToXml[csvLine.Wochentag];
        const angebotIndex = this.csv.angebote.findIndex(
            (angebot) => angebot === csvLine.Angebot
        );
        return {
            ...cloneDeep(this.xml.timeslots[0]),
            column: { $: this.xml.weekdayItemMap[xmlWeekday]["wp:post_id"] },
            event: {
                $: this.xml.getAngebotId(csvLine.Angebot) ?? 100 + angebotIndex,
            },
            event_start: { $: csvLine.timeslot.start + ":00" },
            event_end: { $: csvLine.timeslot.end + ":00" },
            description: { $: csvLine.Alter },
        };
    }

    static colors = Object.freeze([
        ...Object.values(materialColors)
            .filter(
                (color) => typeof colors === "object" && color.hasOwnProperty("50")
            )
            .map((color) => color["50"]),
        ...Object.values(materialColors)
            .filter(
                (color) => typeof colors === "object" && color.hasOwnProperty("300")
            )
            .map((color) => color["300"]),
    ]);
}

export async function csvToWordPressTimetable({ csvFile, xmlFile }) {
    const csv = await CsvAccessor.parse(csvFile);
    console.info(
        `finished loading CSV with ${csv.length} lines and ${csv.angebote.length} angebote`
    );
    const xml = await XmlAccessor.parse(xmlFile);
    console.info(
        `loaded base timetable from XML with ${xml.timeslots.length} timeslots and ${xml.angebote.length} angebote`
    );
    const xmlToCsv = new XmlToCsv({ xml, csv });
    const newXml = xmlToCsv.generate();
    return create({ version: "1.0", encoding: "UTF-8" })
        .ele(newXml)
        .end({ prettyPrint: true });
}

async function parseCsv(csvFile) {
    console.info("loading CSV");
    const csv = [];
    const parser = fs.createReadStream(csvFile)
        .pipe(csvParser())
    parser.on("readable", () => {
        let data
        while ((data = parser.read()) !== null) {
            if (data.Angebot && data.Wochentag && data.Uhrzeit && data.Ort) {
                csv.push(
                    Object.fromEntries(
                        Object.entries(data)
                            .filter(([key]) => key)
                            .map(([key, value]) => [key, value.trim()])
                    )
                );
            }
        }
    })
    await finished(parser)
    return csv
}
