const store = require('app-store-scraper');
const Excel = require('exceljs');
const axios = require('axios');

const WORKBOOK_NAME = "data.xlsx";
const PATH = 'Scrapers & Tools\\' + WORKBOOK_NAME;

const flaskServerUrl = 'http://localhost:4242/scrape';
const workbook = new Excel.Workbook();
const sheetName = "apple";

const collections = [
    store.collection.TOP_FREE_MAC,
    store.collection.NEW_IOS,
    store.collection.TOP_FREE_IOS,
    store.collection.TOP_FREE_IPAD,
    store.collection.TOP_PAID_IOS,
    store.collection.TOP_PAID_IPAD
]

let initialized = false;

async function initExcel() {
    try {
        await workbook.xlsx.readFile(PATH);
        if (!workbook.getWorksheet(sheetName)) {
            console.log("Worksheet not found. Creating one instead.");
            process.exit(1);
        } else {
            console.log("Worksheet found.");
        }
    } catch (error) {
        process.exit(1);
    }
    initialized = true;
    console.log("Initialized Excel");
}

async function getUniqueRandomApps(numApps) {
    let appSet = new Set();
    let appList = [];
    let usedCollections = [];
    const categoryKeys = Object.keys(store.category);
    let attempts = 0;
    const maxAttempts = numApps * 5;  //Allow up to 5 attempts per app to find unique ones

    while (appList.length < numApps && attempts < maxAttempts) {
        attempts++;
        let randomCollection = collections[Math.floor(Math.random() * collections.length)];
        let randomCategoryKey = categoryKeys[Math.floor(Math.random() * categoryKeys.length)];
        let randomCategory = store.category[randomCategoryKey];
        let randomCountry = ['us', 'ca', 'au', 'gb'][Math.floor(Math.random() * 5)];

        try {
            let apps = await store.list({
                collection: randomCollection,
                category: randomCategory,
                num: 200,
                country: randomCountry,
                fullDetail: true
            });

            apps = apps.filter(app => !appSet.has(app.id));  //Filter out any already added apps
            apps.sort(() => 0.5 - Math.random());  //Shuffle the new apps
            apps.splice(0, 20); //At most 20 apps added from the same collection + category each cycle

            //Add up to the needed number of apps
            for (let app of apps) {
                if (appList.length >= numApps) break;
                if (!appSet.has(app.id)) {
                    appList.push(app);
                    usedCollections.push(randomCollection);
                    appSet.add(app.id);
                }
            }
        } catch (e) {
            console.error("Error fetching random apps:", e);
        }
    }

    console.log(`Successfully fetched ${appList.length} unique apps after ${attempts} attempts.`);
    return [appList, usedCollections];
}

async function saveAppDataToExcel(appDetails, usedCollection) {
    if (!initialized) await initExcel();

    try {
        const privacyInfo = await fetchPrivacyInfo(appDetails.url);
        let policyUrl = "";
        let permissions = "UNDISCLOSED";

        if (privacyInfo != null && privacyInfo.privacyPolicyUrl) {
            policyUrl = privacyInfo.privacyPolicyUrl;
            permissions = JSON.stringify(privacyInfo.privacyData);
        }

        const worksheet = workbook.getWorksheet(sheetName);

        worksheet.addRow([
            usedCollection,
            appDetails.id,
            appDetails.url,
            appDetails.title,
            appDetails.description,
            JSON.stringify(appDetails.genres),
            appDetails.free,
            appDetails.contentRating,
            permissions,
            policyUrl
        ]);

        // Step 5: Save the workbook
        await workbook.xlsx.writeFile(PATH);
        return true;
        // console.log('Data saved successfully for appId:', appDetails.appId);
    } catch (e) {
        console.error("Error writing to excel for appId [" + appDetails.appId + "]:", e);
    }
    return false;
}

//Fetch privacy information from Flask server
function fetchPrivacyInfo(appUrl) {
    return axios.get(flaskServerUrl, {
        params: { app_url: appUrl }
    }).then(response => response.data)
        .catch(error => {
            console.error('Error fetching privacy data:', error.message);
            return null;
        });
}

async function fetchAndSaveApps(numApps) {
    const apps = await getUniqueRandomApps(numApps);
    let success = 0;

    for (let i = 0; i < apps[0].length; i++) {
        const app = apps[0][i];
        await saveAppDataToExcel(app, apps[1][i]).then(r => {
            if (r) {success++;}
        });
        if ((i+1) % 5 === 0) {
            console.log("Saved [" + success + "/" + (i+1) + "] apps to Excel");
        }
    }
}

/**
 * After the data from all apps is written to the Excel file, this method goes over each entry and
 * marks all the ones with missing Privacy Policies likely due to server failures. For each one,
 * it calls 'refreshExcelData' to attempt to retrieve the information from the Flask server again.
 *
 * @param iterations the amount of refreshes to perform, each separated by a timeout of 5 seconds
 * @return true if all apps are refreshed successfully by the last iteration cycle, false otherwise
 */
async function refreshAllApps(iterations) {
    if (!initialized) await initExcel();
    const worksheet = workbook.getWorksheet(sheetName);
    let missingRecords = [];

    try {
        for (let i = 0; i < iterations; i++) {
            missingRecords = [];
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber > 1 && (row.getCell("J").value === null || row.getCell("J").value === "")) {
                    const appUrl = row.getCell("C").value;
                    const appId = row.getCell("B").value;
                    console.log("Adding app [" + appId + "] for refresh");
                    missingRecords.push({ appUrl, rowIndex: rowNumber });
                }
            });

            if (missingRecords.length === 0) {
                console.log("Successfully refreshed all apps");
                break;
            }

            //Refresh apps one by one
            let successCount = 0;
            for (const { appUrl, rowIndex } of missingRecords) {
                const success = await refreshExcelData(appUrl, rowIndex);
                if (!success) {
                    console.error("Failed to refresh app [" + appUrl + "]");
                } else {
                    successCount++;
                    console.log("Successfully refreshed app [" + appUrl + "]")
                }
            }

            console.log("Finished refresh cycle, refreshed [" + successCount + "/" + missingRecords.length + "] apps");
            await setTimeout(5000);
        }
    } catch (e) {
        console.error("Error refreshing apps and trying again", e);
    }

    const totalRefreshed = missingRecords.length === 0 ? worksheet.rowCount - 1 : missingRecords.length;
    return totalRefreshed === worksheet.rowCount - 1;
}

/**
 * This method makes a new request to the Flask server to retrieve data privacy information for the specified
 * app url.
 * @param appUrl the url of the app to fetch
 * @param rowIndex the app's row index within the worksheet
 * @return true if successful and the data is written to the proper cell on the Excel worksheet, false otherwise
 */
async function refreshExcelData(appUrl, rowIndex) {
    const privacyInfo = await fetchPrivacyInfo(appUrl);
    let policyUrl = "";
    let permissions = "UNDISCLOSED";

    if (privacyInfo != null && privacyInfo.privacyPolicyUrl) {
        try {
            policyUrl = privacyInfo.privacyPolicyUrl;
            permissions = JSON.stringify(privacyInfo.privacyData, null, 2);

            const worksheet = workbook.getWorksheet(sheetName);
            const row = worksheet.getRow(rowIndex);

            row.getCell("I").value = permissions;
            row.getCell("J").value = policyUrl;

            await workbook.xlsx.writeFile(PATH);
            return true;
        } catch (e) {
            console.error("Error attempting to write refreshed data to Excel in row [" + rowIndex + "]:", e);
        }
    }

    return false;
}

// refreshAllApps(2).then(r => {
//     if (r) {
//         console.log("All apps have been processed successfully.");
//     } else {
//         console.log("Process finished gracefully, not all apps are refreshed")
//     }
// }).catch(error => {
//     console.error("An error occurred:", error);
// });


fetchAndSaveApps(1000).then(() => {
    console.log('All apps have been processed and saved.');
}).catch(error => {
    console.error('An error occurred:', error);
});
