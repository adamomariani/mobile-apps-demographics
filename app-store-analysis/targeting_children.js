const Excel = require('exceljs');
const store = require('app-store-scraper');
const fs = require('fs');

//Calculated significance threshold for keyword occurrences
const BASE_THRESHOLD_TITLES = 3;
const BASE_THRESHOLD_REVIEWS = 6;

const MENTION_KIDS_COLUMN = 'F';
const WORKBOOK_NAME = "data.xlsx";
const PATH = 'Scrapers & Tools\\' + WORKBOOK_NAME;
const logFile = 'output.log';

//Keywords & Synonyms from thesaurus
const KEYWORDS = ["child", "kid", "toddler"];
//A weight of 0.5 means that half the mentions are necessary for a keyword (i.e. half the threshold)
const weights = {"child": 1, "kid": 1, "toddler": 0.75};
const synonyms = {
    "child": ["children", "youngster", "offspring"],
    "kid": ["kids", "son", "daughter"],
    "toddler": ["toddlers", "pre-k", "babies", "baby", "infant", "preschooler", "kindergarten", "tot"]
};

async function checkApps() {
    const workbook = new Excel.Workbook();
    await workbook.xlsx.readFile(PATH);
    const worksheet = workbook.getWorksheet('apple');
    let found = false;

    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (row.getCell(MENTION_KIDS_COLUMN) !== null && row.getCell(MENTION_KIDS_COLUMN).value !== "") {
            continue;
        }
        const appId = row.getCell('A').value;
        const title = row.getCell('B').value;
        const description = row.getCell('C').value;

        let counts = countKeywords([title, description]);
        fs.appendFileSync(logFile, `App ID: ${appId}, Initial count: ${counts}\n`);

        for (let count in counts) {
            const threshold = Math.round(weights[count] * BASE_THRESHOLD_TITLES);

            if (counts >= threshold) {
                row.getCell(MENTION_KIDS_COLUMN).value = 'TRUE';
                found = true;
            } else {
                const reviewCounts = await analyzeReviews(appId);
                fs.appendFileSync(logFile, `App ID: ${appId}, Review count: ${reviewCounts}\n`);

                for (let reviewCount in reviewCounts) {
                    const reviewThreshold = Math.round(weights[reviewCount] * BASE_THRESHOLD_REVIEWS);

                    if (reviewCount >= reviewThreshold) {
                        row.getCell(MENTION_KIDS_COLUMN).value = 'TRUE';
                        found = true;
                    }
                }

                if (!found) {
                    row.getCell(MENTION_KIDS_COLUMN).value = 'FALSE';
                }
            }
            await row.commit();
        }
    }

    await workbook.xlsx.writeFile(PATH);
    console.log('Excel file and log file have been updated.');
}

function countKeywords(texts) {
    let total = {};
    for (let text of texts) {
        for (let keyword of KEYWORDS) {
            let regex = new RegExp(`\\b${keyword}\\b`, 'gi');
            let matches = (text.match(regex) || []).length;

            if (!(keyword in total)) {
                total[keyword] = 0;
            }

            total[keyword] += matches;

            for (let synonym of synonyms[keyword]) {
                regex = new RegExp(`\\b${synonym}\\b`, 'gi');
                matches = (text.match(regex) || []).length;

                total[keyword] += matches;
            }
        }
    }
    return total;
}

async function analyzeReviews(appId) {
    let totalMentions = {};
    try {
        await store.reviews({
            id: appId,
            page: 1
        }).then(reviews => {
            for (let review of reviews) {
                const total = countKeywords([review.title, review.text]);

                for (let word in total) {
                    if (!(word in totalMentions)) {
                        totalMentions[word] = 0;
                    }

                    totalMentions[word] += total[word];
                }
            }
        });
    } catch (error) {
        error = JSON.stringify(error);
        console.error(`Error fetching reviews for appId ${appId}: ${error}`);
    }
    return totalMentions;
}

checkApps().catch(console.error);