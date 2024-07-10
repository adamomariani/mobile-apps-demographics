const OpenAI = require("openai");
const Excel = require('exceljs');

//!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
//!!!!!!!!!!ENSURE MODEL, MODEL_COLUMN, API KEY & ORGANIZATION ID ARE CORRECT!!!!!!!!!!!!
//!!!!!!!!!!!!!!!!!!!!!!!!!!!(OPERATE ON TEST FILES)!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

//CONSTANTS:
const API_KEY = "...";
const WORKBOOK_NAME = "data.xlsx";
const EXCEL_PATH = 'Scrapers & Tools\\' + WORKBOOK_NAME;
const MODEL_COLUMN = "P";
const MODEL = "gpt-3.5-turbo-0125";
const SYSTEM_MESSAGE = "You will receive a JSON object containing information regarding a mobile application gathered from a random  listing on an app store. The JSON object will have the following information: app title, app description, and app categories. Your job is to create a JSON response with one key 'targetedAge' paired with an array of targeted age groups as value. Age groups are: children (12 and under), teens (13 to 17) and adults (18+). Your response will always be in the same format: {\"targetedAge\": [\"adults\",\"teens\", \"children\"]}";

const workbook = new Excel.Workbook();
const sheetName = "google";
const openai = new OpenAI({
    apiKey: API_KEY,
    organization: "..."
});

/**
 * Step #1: Initialize
 * Function to find and initialize Excel workbook.
 */
async function initExcel() {
    try {
        await workbook.xlsx.readFile(EXCEL_PATH);
        if (!workbook.getWorksheet(sheetName)) {
            console.error("Could not find the specified worksheet")
            process.exit(1);
        }
    } catch (error) {
        console.error("Error encountered during setup:", error);
        process.exit(1);
    }
    console.log("Initialized Excel");
}

/**
 * Step #2: Go through each line in the worksheet and return an array of messages to be sent to OpenAI,
 * along with their row number within the worksheet. Collect only the relevant app info for the model.
 */
async function iterateApps() {
    const worksheet = workbook.getWorksheet(sheetName);
    let appsDetails = [];

    //Loop through rows, starting from the second row to skip the header
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            if (!row.getCell(MODEL_COLUMN).value || row.getCell(MODEL_COLUMN).value === "") {
                const appTitle = row.getCell('D').value;
                const appDescription = row.getCell('E').value;
                const appCategories = row.getCell('F').value;
                const appContentRating = row.getCell('E').value;
                // const privacyPolicyText = row.getCell('M').value;
                //FOUR FEATURES:
                // const appDetails = "{\"title\": \"" + appTitle + "\", " +
                //     "\"description\": \"" + appDescription + "\", " +
                //     "\"categories\": " + appCategories + ", " +
                //     "\"contentRating\": \"" + appContentRating + "\"}";

                //THREE FEATURES:
                // const appDetails = "{\"title\": \"" + appTitle + "\", " +
                //     "\"description\": \"" + appDescription + "\", " +
                //     "\"contentRating\": \"" + appContentRating + "\"}";

                //THREE FEATURES V2:
                const appDetails = "{\"title\": \"" + appTitle + "\", " +
                    "\"description\": \"" + appDescription + "\", " +
                    "\"categories\": " + appCategories + "}";

                //TWO FEATURES:
                // const appDetails = "{\"title\": \"" + appTitle + "\", " +
                //     "\"description\": \"" + appDescription + "\"}";

                appsDetails.push({appDetails, rowNumber});
            }
        }
    });

    console.log("Successfully read [" + appsDetails.length + "] entries")

    return appsDetails;
}

/**
 * Step #3: Sends a message to OpenAI, awaits a response and returns it
 * @param appDetails this row's app details as returned by iterateApps
 */
async function chat(appDetails) {
    try {
        const completion = await openai.chat.completions.create({
            messages: [{role: "system", content: SYSTEM_MESSAGE}, {role: "user", content: appDetails}],
            model: MODEL,
            max_tokens: 100,
            temperature: 0.25
        });

        if (completion.choices[0].message.role === "assistant") {
            return completion.choices[0].message.content;
        } else {
            console.error("The completion API responded with a non-assistant role [" + completion.choices[0].message.role + "]");
        }
    } catch (e) {
        console.error("Error retrieving response from OpenAI:", e);
    }
    return null;
}

/**
 * Step #4: Write the response received from OpenAI to the Excel worksheet
 * @param rowNumber this app's row number within the worksheet
 * @param text the response text to be added
 */
async function updateExcel(rowNumber, text) {
    try {
        const worksheet = workbook.getWorksheet(sheetName);
        const row = worksheet.getRow(rowNumber);

        row.getCell(MODEL_COLUMN).value = text;
        await workbook.xlsx.writeFile(EXCEL_PATH);
        return true;
    } catch (e) {
        console.error("Error attempting to write refreshed data to Excel in row [" + rowNumber + "]:", e);
    }
    return false;
}

async function main() {
    await initExcel();
    const appsDetails = await iterateApps();

    console.log(`Retrieved [${appsDetails.length}] viable apps.`);

    //METRICS:
    let successResponses = 0;
    let successWrites = 0;
    let total = 0;

    console.log("Model in use: " + MODEL);

    for (const {appDetails, rowNumber} of appsDetails) {
        total++;
        const response = await chat(appDetails);

        if (response) {
            successResponses++;
            await updateExcel(rowNumber, response).then(r => {
                if (r) {
                    successWrites++;
                }
            });
        }

        if (total % 10 === 0 || total === appsDetails.length) {
            console.log("Successful OpenAI Responses [" + successResponses + "/" + total + "]");
            console.log("Successful Excel Writes [" + successWrites + "/" + total + "]");
        }
    }
}

main().then(() => {
    console.log("Process ended gracefully");
}).catch(e => console.error("Error encountered:", e));
