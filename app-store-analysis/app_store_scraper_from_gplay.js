//Used to scrape App Store listing information
const store = require('app-store-scraper');
//Used to read and write to Excel
const Excel = require('exceljs');
//Used to communicate with local Flask server
const axios = require('axios');
const fs = require("fs");

//Path to Excel file
const WORKBOOK_NAME = 'data_test.xlsx';
const PATH = 'Scrapers & Tools\\' + WORKBOOK_NAME;
const logFile = 'matched_applications.log';

//Flask server URL
const flaskServerUrl = 'http://localhost:4242/scrape';
const workbook = new Excel.Workbook();
const gSheetName = "google";
const sheetName = "found";
//Initialize Excel once
let initialized = false;

/**
 * Function to find and initialize Excel workbook.
 */
async function initExcel() {
    try {
        await workbook.xlsx.readFile(PATH);
        if (!workbook.getWorksheet(sheetName)) {
            const worksheet = workbook.addWorksheet(sheetName);
            worksheet.addRow(['collection', 'appId', 'url', 'title', 'description', 'categories', 'free', 'contentRating', 'permissions', 'privacyPolicyUrl', 'gPlayId']);
        }
    } catch (error) {
        const worksheet = workbook.addWorksheet(sheetName);
        worksheet.addRow(['collection', 'appId', 'url', 'title', 'description', 'categories', 'free', 'contentRating', 'permissions', 'privacyPolicyUrl', 'gPlayId']);
    }
    initialized = true;
    console.log("Initialized Excel");
}

/**
 * Given a list of app names and ids coming from the Google Play Store, this method attempts to find the corresponding app
 * on the Apple App store by searching for apps with similar names.
 * @param appNames the names of apps found on the Google Play Store
 * @param appIds the ids of all apps on Google Play used as foreign key
 * @returns a 2D-Array containing the list of apps found on the App Store and their corresponding
 * Play Store ID on the first and second indexes respectively
 */
async function getApps(appNames, appIds) {
    let appList = [[], []];
    //Total number of apps found
    let success = 0;

    for (let i = 0; i < appNames.length; i++) {
        try {
            const givenName = trimName(appNames[i]);

            //Search for the app
            let app = await store.search({
                term: givenName,
                num: 1
            });

            if (app != null && app[0] != null) {
                const foundName = trimName(app[0].title);
                const levDistance = lev(givenName.toLowerCase(), foundName.toLowerCase());
                if (levDistance < 3) {
                    appList[0].push(app[0]);
                    appList[1].push(appIds[i]);
                    success++;
                    fs.appendFileSync(logFile, "Found match on App Store for [" + givenName + "]\n");
                    // console.log("Found match on App Store for [" + givenName + "]");
                } else {
                    fs.appendFileSync(logFile, "Failed to match app on App Store for [" + givenName + "]\n");
                    // console.log("Failed to match app on App Store for [" + givenName + "]");
                }
            } else {
                fs.appendFileSync(logFile, "Failed to find any app on App Store for [" + givenName + "]\n");
                // console.log("Failed to find any app on App Store for [" + givenName + "]");
            }
        } catch (error) {
            fs.appendFileSync(logFile, "Error making request on App Store for [" + appNames[i] + "]");
        }

        if ((i+1) % 50 === 0) {
            try {
                console.log(`Iterated over [${i}/${appNames.length}] apps`)
                console.log(`Sleeping for 3 minutes [${new Date().toISOString()}]`);
                await sleep(180000);
            } catch (e) {
                console.error("Error sleeping, moving to next cycle");
            }
        }
    }
    console.log("Found [" + success + "/" + appNames.length + "] apps");
    return appList;
}

/**
 * Simple function used to remove non-alphanumeric characters from app names.
 * This ensures that for instance: "Duolingo: Learn Languages" matches "Duolingo - Learn Languages"
 * @param name the given app name to trim
 * @returns the new app name to be used
 */
function trimName(name) {
    let text = name.replace(/[^a-zA-Z0-9 ]/g, '');
    text = text.replace(/\s{2,}/g, ' ');
    text = text.trim();
    return text;
}

/**
 * Method used to save the given application information to the pre-defined Excel workbook.
 * @param appDetails application details coming from its listing on the Apple App store
 * @param appId the corresponding ID of this application on the Google Play Store
 */
async function saveAppDataToExcel(appDetails, appId) {
    //First attempt to fetch the privacy information using the Flask server
    const privacyInfo = await fetchPrivacyInfo(appDetails.url);
    let policyUrl = "";
    let permissions = "UNDISCLOSED";

    if (privacyInfo != null) {
        policyUrl = privacyInfo.privacyPolicyUrl;
        permissions = JSON.stringify(privacyInfo.privacyData, null, 2);
    }

    //Write all the information to the Excel worksheet
    const worksheet = workbook.getWorksheet(sheetName);

    worksheet.addRow([
        "GPLAY",
        appDetails.id,
        appDetails.url,
        appDetails.title,
        appDetails.description,
        JSON.stringify(appDetails.genres),
        appDetails.free,
        appDetails.contentRating,
        permissions,
        policyUrl,
        appId
    ]);

    await workbook.xlsx.writeFile(PATH);
}

/**
 * Fetch privacy information from Flask server.
 * @param appUrl the corresponding app url
 */
function fetchPrivacyInfo(appUrl) {
    return axios.get(flaskServerUrl, {
        params: { app_url: appUrl }
    }).then(response => response.data)
        .catch(error => {
            console.error('Error fetching privacy data:', error.message);
            return null;
        });
}

/**
 * Method used to start the process of retrieving app information from Google Play Store apps through 'fetchAppList',
 * find corresponding apps on the Apple App store through 'getApps' and save them to a different worksheet through 'saveAppDataToExcel'.
 */
async function fetchAndSaveApps() {
    try {
        //Get list of app names and ids from the Google Play worksheet
        const appList = await fetchAppList();
        const appNames = appList[0];
        const appIds = appList[1];

        //Use getApps to retrieve the corresponding apps on the iOS store
        const apps = await getApps(appNames, appIds);
        let success = 0;
        let total = 0;

        //For each found app, save the data and corresponding Play Store ID to Excel
        for (let i = 0; i < apps[0].length; i++) {
            try {
                await saveAppDataToExcel(apps[0][i], apps[1][i]);
                success++;
            } catch (e) {
                console.error(`Error saving app [${apps[1][i]}] to excel`);
            }
            total++;

            if (total % 50 === 0) {
                console.log(`[${new Date().toISOString()}] Saved [${success}/${total}] apps of [${appNames.length}] apps`);
            }
        }
    } catch (error) {
        console.error('[fetchAndSaveApps] error occurred:', error);
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Retrieve a list of app names and ids from the Google Play worksheet. These are returned in a 2D-Array
 * containing app names and app IDs in the first and second indexes respectively.
 */
async function fetchAppList() {
    //Load the workbook if not initialized
    if (!initialized) await initExcel();

    //Get the Google Play Store worksheet
    const worksheet = workbook.getWorksheet(gSheetName);
    if (!worksheet) {
        console.error('Worksheet not found: ' + gSheetName);
        return [[], []];
    }

    //Skip apps that have already been fetched
    const foundApps = await fetchFoundAppList();
    let appTitles = [];
    let appIds = [];

    //Loop through rows, starting from the second row to skip the header
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            const appId = row.getCell('A').value; //Column B for app IDs
            const appTitle = row.getCell('B').value; //Column D for app titles
            if (!foundApps.includes(appId)) {
                appIds.push(appId);
                appTitles.push(appTitle);
            }
        }
    });

    console.log("Successfully read [" + appIds.length + "] google play entries")
    return [appTitles, appIds];
}

/**
 * Retrieve a list of Google Play Store app ids that have already been processed within the worksheet.
 * These are returned in an array and will be skipped in the retrieval stage.
 */
async function fetchFoundAppList() {
    //Get the Google Play Store worksheet
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
        console.error('Worksheet not found: ' + sheetName);
        return [];
    }
    let appIds = [];

    //Loop through rows, starting from the second row to skip the header
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
            const gAppId = row.getCell("K").value;
            appIds.push(gAppId);
        }
    });

    console.log("Skipping [" + appIds.length + "] pre-fetched apps")
    return appIds;
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
            await sleep(5000);
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

// refreshAllApps(1).then(r => {
//     if (r) {
//         console.log("All apps have been processed successfully.");
//     } else {
//         console.log("Process finished gracefully, not all apps are refreshed")
//     }
// }).catch(error => {
//     console.error("An error occurred:", error);
// });

fetchAndSaveApps().then(r => {
    refreshAllApps(3).then(r => {
        if (r) {
            console.log("All apps have been processed successfully.");
        } else {
            console.log("Process finished gracefully, not all apps are refreshed")
        }
    });
}).catch(error => {
    console.error("An error occurred:", error);
});


function lev(a, b, ratio = false) {
    const n = a.length;
    const m = b.length;

    if (a === b) {
        return 0;
    } else if (n === 0) {
        return m;
    } else if (m === 0) {
        return n;
    }

    //Create Levenshtein matrix for each 'subproblem' (i,j) of a and b
    let levMatrix = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));

    //Initialize the first row and column
    for (let i = 0; i <= n; i++) {
        levMatrix[i][0] = i;
    }
    for (let j = 0; j <= m; j++) {
        levMatrix[0][j] = j;
    }

    //Fill the rest of the matrix
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            levMatrix[i][j] = Math.min(
                levMatrix[i - 1][j] + 1,
                levMatrix[i][j - 1] + 1,
                levMatrix[i - 1][j - 1] + cost
            );
        }
    }

    if (ratio) {
        return ((n + m) - levMatrix[n][m]) / (n + m);
    } else {
        return levMatrix[n][m];
    }
}