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
    const doc = create({ version: "1.0", encoding: "UTF-8" })
    const channel = doc.ele("rss")
        .att("version", "2.0")
        .att("xmlns:excerpt", "http://wordpress.org/export/1.2/excerpt/")
        .att("xmlns:content", "http://purl.org/rss/1.0/modules/content/")
        .att("xmlns:wfw", "http://wellformedweb.org/CommentAPI/")
        .att("xmlns:dc", "http://purl.org/dc/elements/1.1/")
        .att("xmlns:wp", "http://wordpress.org/export/1.2/")
        .ele("channel")
    weekdaysCsv.forEach((weekday, index) => {
        channel.ele("item")
        .ele("title").txt(weekday).up()
        .ele("wp:post_id").txt(100 + index).up()
        .ele("wp:post_name").dat(weekday.toLowerCase()).up()
        .ele("wp:status").dat("publish").up()
        .ele("wp:post_type").dat("mp-column").up()
        .ele("wp:postmeta")
        .ele("wp:meta_key").dat("_edit_last").up()
        .ele("wp:meta_value").dat(1).up()
        .up() // wp:postmeta
        .ele("wp:postmeta")
        .ele("wp:meta_key").dat("column_option").up()
        .ele("wp:meta_value").dat("weekday").up()
        .up() // wp:postmeta
        .ele("wp:postmeta")
        .ele("wp:meta_key").dat("weekday").up()
        .ele("wp:meta_value").dat(weekdaysWordPress[index]).up()
        .up() // wp:postmeta
    })
    angebote.forEach((angebot, index) => {
        channel.ele("item")
            .ele("title").txt(angebot).up()
            .ele("wp:post_id").txt(200 + index).up()
            .ele("wp:post_name").dat(angebot.toLowerCase().replace(/\s+/g, "-")).up()
            .ele("wp:post_type").dat("mp-event").up()
            .ele("wp:status").dat("publish").up()
            .ele("wp:postmeta")
            .ele("wp:meta_key").dat("timetable_disable_url").up()
            .ele("wp:meta_value").dat(1).up()
    })
    csv.forEach((event) => {
        channel.ele("timeslot")
            .ele("column").dat(100 + weekdaysCsv.findIndex(weekday => weekday.startsWith(event.Wochentag))).up()
            .ele("event").dat(200 + angebote.indexOf(event.Angebot)).up()
            .ele("event_start").dat(event.Uhrzeit.split("-")[0]?.trim()).up()
            .ele("event_end").dat(event.Uhrzeit.split("-")[1]?.trim()).up()
            .ele("user_id").dat(-1).up()
            .ele("description").dat(event.Alter).up()
    })
    return doc.end({ prettyPrint: true })
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
