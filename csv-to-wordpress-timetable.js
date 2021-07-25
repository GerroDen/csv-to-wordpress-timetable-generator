const fs = require("fs")
const csvParser = require("csv-parser")
const { create } = require("xmlbuilder2")
const { groupBy } = require("lodash")

const weekdaysCsv = [
    "Montags",
    "Dienstags",
    "Mittwochs",
    "Donnerstags",
    "Freitags",
    "Samstags",
    "Sonntags",
]
const weekdaysWordPress = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
]

async function csvToWordPressTimetable(csvFile) {
    const csv = await parseCsv(csvFile)
    console.info(`finished loading CSV with ${csv.length} lines`)
    const angebote = Object.keys(groupBy(csv, entry => entry.Angebot))
    const xml = {
        "rss": {
            "@": {
                "version": "2.0",
                "xmlns:excerpt": "http://wordpress.org/export/1.2/excerpt/",
                "xmlns:content": "http://purl.org/rss/1.0/modules/content/",
                "xmlns:wfw": "http://wellformedweb.org/CommentAPI/",
                "xmlns:dc": "http://purl.org/dc/elements/1.1/",
                "xmlns:wp": "http://wordpress.org/export/1.2/",
            },
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
    };
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
