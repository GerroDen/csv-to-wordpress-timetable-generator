const fs = require("fs")
const csvParser = require("csv-parser")
const { create } = require("xmlbuilder2")
const { groupBy, cloneDeep, zipObject, chain } = require("lodash")
const { convert } = require("xmlbuilder2")

class CsvAccessor {
    constructor(csv) {
        this.data = csv.map(line => new CsvLineAccessor(line))
    }

    static async parse(csvFile) {
        const csv = await parseCsv(csvFile)
        return new CsvAccessor(csv)
    }

    get angebotMap() {
        return groupBy(this.data, entry => entry.Angebot)
    }

    get angebote() {
        return Object.keys(this.angebotMap)
    }

    get length() {
        return this.data.length
    }

    [Symbol.iterator]() {
        return this.data.values()
    }

    static weekdays = [
        "Montag",
        "Dienstag",
        "Mittwoch",
        "Donnerstag",
        "Freitag",
        "Samstag",
        "Sonntag",
    ]
}

class CsvLineAccessor {
    constructor(line) {
        for (const key in line) {
            this[key] = line[key]
        }
    }

    get timeslot() {
        const parts = this.Uhrzeit.split("-")
        return {
            start: parts[0]?.trim(),
            end: parts[1]?.trim(),
        }
    }

    get timeslotComplete() {
        return this.timeslot.start !== undefined && this.timeslot.end !== undefined
    }
}

class XmlAccessor {
    constructor(xml) {
        this.data = xml
    }

    static async parse(xmlFile) {
        const xmlString = await fs.promises.readFile(xmlFile, { encoding: "utf8" })
        const xml = convert(xmlString, { format: "object" })
        return new XmlAccessor(xml)
    }

    get items() {
        return this.data.rss.channel.item
    }

    get timeslots() {
        return this.data.rss.channel.timeslot
    }

    get weekdayItems() {
        return this.items.filter(item => item["wp:postmeta"].some(meta => meta["wp:meta_key"]["$"] === "column_option" && meta["wp:meta_value"]["$"] === "weekday"))
    }

    get weekdayItemMap() {
        return chain(this.weekdayItems)
            .groupBy(item => item["wp:postmeta"].find(meta => meta["wp:meta_key"]["$"] === "weekday")["wp:meta_value"]["$"])
            .mapValues(values => values[0])
            .value()
    }

    get weekdays() {
        return Object.keys(this.weekdayItemMap)
    }

    get angebotItems() {
        return this.items.filter(item => item["wp:post_type"]["$"] === "mp-event")
    }

    get angebotItemMap() {
        return chain(this.angebotItems)
            .groupBy(item => item.title)
            .mapValues(values => values[0])
            .value()
    }

    get angebote() {
        return Object.keys(this.angebotItemMap)
    }

    static weekdays = [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
}

class XmlToCsv {
    /**
     * @param {object} params
     * @param {XmlAccessor} params.xml
     * @param {CsvAccessor} params.csv
     */
    constructor({ xml, csv }) {
        this.xml = xml
        this.csv = csv
        this.weekdaysCsvToXml = zipObject(CsvAccessor.weekdays, XmlAccessor.weekdays)
    }

    generate() {
        const xml = this.generateBaseXml()
        xml.rss.channel.item.push(...cloneDeep(this.xml.weekdayItems))
        xml.rss.channel.item.push(...this.csv.data.map(this.generateAngebot.bind(this)))
        xml.rss.channel.timeslot.push(...this.csv.data.filter(line => line.timeslotComplete).map(this.generateTimeslot.bind(this)))
        const removedAngebote = this.xml.angebote.filter(xmlAngebot => !this.csv.angebote.includes(xmlAngebot))
        if (removedAngebote.length > 0) console.info(`removed angebote ${removedAngebote}`)
        const addedAngebote = this.csv.angebote.filter(csvAngebot => !this.xml.angebote.includes(csvAngebot))
        if (addedAngebote.length > 0) console.info(`added angebote ${addedAngebote}`)
        console.info(`number of timeslots changed from ${this.xml.timeslots.length} to ${new XmlAccessor(xml).timeslots.length}`)
        return xml
    }

    generateBaseXml() {
        const baseXml = cloneDeep(this.xml.data);
        baseXml.rss.channel.item = []
        baseXml.rss.channel.timeslot = []
        return baseXml
    }

    /**
     * @param {CsvLineAccessor} csvLine
     * @param {number} index
     */
    generateAngebot(csvLine, index) {
        return {
            ...cloneDeep(this.xml.angebotItems[0]),
            "title": csvLine.Angebot,
            "wp:post_id": this.xml.angebotItemMap[csvLine.Angebot]["wp:post_id"] ?? 100 + index,
            "wp:post_name": { "$": csvLine.Angebot.toLowerCase().replace(/\s+/g, "-") },
        };
    }

    /**
     * @param {CsvLineAccessor} csvLine
     * @param {number} index
     */
    generateTimeslot(csvLine, index) {
        const xmlWeekday = this.weekdaysCsvToXml[csvLine.Wochentag];
        return {
            ...cloneDeep(this.xml.timeslots[0]),
            "column": { "$": this.xml.weekdayItemMap[xmlWeekday]["wp:post_id"] },
            "event": { "$": this.xml.angebotItemMap[csvLine.Angebot]["wp:post_id"] ?? 100 + index },
            "event_start": { "$": csvLine.timeslot.start + ":00" },
            "event_end": { "$": csvLine.timeslot.end + ":00" },
            "description": { "$": csvLine.Alter },
        }
    }
}

async function csvToWordPressTimetable({ csvFile, xmlFile }) {
    const csv = await CsvAccessor.parse(csvFile)
    console.info(`finished loading CSV with ${csv.length} lines`)
    const xml = await XmlAccessor.parse(xmlFile)
    console.info(`loaded base timetable from XML with ${xml.timeslots.length} timeslots`)
    const xmlToCsv = new XmlToCsv({ xml, csv })
    const newXml = xmlToCsv.generate()
    return create({ version: "1.0", encoding: "UTF-8" })
        .ele(newXml)
        .end({ prettyPrint: true })
}

function parseCsv(csvFile) {
    console.info("loading CSV")
    return new Promise((resolve, reject) => {
        const csv = []
        fs.createReadStream(csvFile)
            .pipe(csvParser())
            .on("data", (data) => {
                if (Object.values(data).some(value => !!value.trim())) {
                    csv.push(Object.fromEntries(Object.entries(data).map(([key, value]) => [key, value.trim()])))
                }
            })
            .on("end", () => resolve(csv))
            .on("error", reject)
    })
}

module.exports = {
    csvToWordPressTimetable,
}
