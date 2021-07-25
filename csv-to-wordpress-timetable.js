const fs = require("fs")
const csvParser = require("csv-parser")
const { create } = require("xmlbuilder2")
const { groupBy } = require("lodash")
const { convert } = require("xmlbuilder2")

class CsvAccessor {
    constructor(csv) {
        this.csv = csv
    }

    static async parse(csvFile) {
        const csv = await parseCsv(csvFile)
        return new CsvAccessor(csv)
    }

    get angebotMap() {
        return groupBy(this.csv, entry => entry.Angebot)
    }

    get angebote() {
        return Object.keys(this.angebotMap)
    }

    get length() {
        return this.csv.length
    }

    [Symbol.iterator]() { 
        return this.csv.values() 
    }

    static weekdays = [
        "Montags",
        "Dienstags",
        "Mittwochs",
        "Donnerstags",
        "Freitags",
        "Samstags",
        "Sonntags",
    ]
}

class XmlAccessor {
    constructor(xml) {
        this.xml = xml
    }

    static async parse(xmlFile) {
        const xmlString = await fs.promises.readFile(xmlFile, { encoding: "utf8" })
        const xml = convert(xmlString, { format: "object" })
        return new XmlAccessor(xml)
    }

    get items() {
        return this.xml.rss.channel.item
    }

    get timeslots() {
        return this.xml.rss.channel.timeslot
    }

    get weekdayItems() {
        return this.items.filter(item => item["wp:postmeta"].some(meta => meta["wp:meta_key"]["$"] === "column_option" && meta["wp:meta_value"]["$"] === "weekday"))
    }

    get weekdayItemMap() {
        return groupBy(
            this.weekdayItems,
            item => item["wp:postmeta"].find(meta => meta["wp:meta_key"]["$"] === "weekday")["wp:meta_value"]["$"]
        )
    }

    get weekdays() {
        return Object.keys(this.weekdayItemMap)
    }

    get angebotItems() {
        return this.items.filter(item => item["wp:post_type"]["$"] === "mp-event")
    }

    get angebotItemMap() {
        return groupBy(this.angebotItems, item => item.title)
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

async function csvToWordPressTimetable({ csvFile, xmlFile }) {
    const csv = await CsvAccessor.parse(csvFile)
    console.info(`finished loading CSV with ${csv.length} lines`)
    const xml = await XmlAccessor.parse(xmlFile)
    console.info(`loaded base timetable from XML with ${xml.timeslots.length} timeslots`)
    const removedAngebote = xml.angebote.filter(xmlAngebot => !csv.angebote.includes(xmlAngebot))
    const addedAngebote = csv.angebote.filter(csvAngebot => !xml.angebote.includes(csvAngebot))
    const removedTimeslots = ""
    const addedTimeslots = ""
    // console.log(Object.keys(weekdayItemIndex))
    // console.log(Object.keys(angebotItemIndex))
    /*
    const xml = {
        "rss": {
            "channel": {
                "item": [
                    ...weekdaysCsv.map((weekday, index) => ({
                        "title": weekday,
                        "wp:post_id": 100 + index,
                        "wp:post_name": { "$": weekday.toLowerCase() },
                        "wp:status": { "$": "publish" },
                        "wp:post_type": { "$": "mp-column" },
                        "wp:postmeta": [{
                            "wp:meta_key": { "$": "_edit_last" },
                            "wp:meta_value": { "$": 1 },
                        }, {
                            "wp:meta_key": { "$": "column_option" },
                            "wp:meta_value": { "$": "weekday" },
                        }, {
                            "wp:meta_key": { "$": "weekday" },
                            "wp:meta_value": { "$": weekdaysWordPress[index] },
                        }],
                    })),
                    ...angebote.map((angebot, index) => ({
                        "title": angebot,
                        "wp:post_id": 200 + index,
                        "wp:post_name": { "$": angebot.toLowerCase().replace(/\s+/g, "-") },
                        "wp:post_type": { "$": "mp-event" },
                        "wp:status": { "$": "publish" },
                        "wp:postmeta": [{
                            "wp:meta_key": { "$": "timetable_disable_url" },
                            "wp:meta_value": { "$": 1 },
                        }],
                    })),
                ],
                "timeslot": csv.map(event => ({
                    "column": { "$": 100 + weekdaysCsv.findIndex(weekday => weekday.startsWith(event.Wochentag)) },
                    "event": { "$": 200 + angebote.indexOf(event.Angebot) },
                    "event_start": { "$": event.Uhrzeit.split("-")[0]?.trim() + ":00" },
                    "event_end": { "$": event.Uhrzeit.split("-")[1]?.trim() + ":00" },
                    "user_id": { "$": -1 },
                    "description": { "$": event.Alter },
                })),
            },
        },
    }
    */
    return create({ version: "1.0", encoding: "UTF-8" })
        .ele(xml)
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
