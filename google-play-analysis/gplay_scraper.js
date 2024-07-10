import gplay from "google-play-scraper";
import Excel from "exceljs";
import he from "he";

const WORKBOOK_NAME = "data_test.xlsx";
const PATH = 'Scrapers & Tools\\' + WORKBOOK_NAME;

const collections = [gplay.collection.TOP_FREE, gplay.collection.TOP_PAID, gplay.collection.GROSSING]
const workbook = new Excel.Workbook();
const sheetName = "google";

const consideredCategories = await gplay.categories();

const restrictedCategories = [
    gplay.category.FAMILY,
    gplay.category.GAME,
    gplay.category.COMICS,
    gplay.category.EDUCATION,
    gplay.category.ENTERTAINMENT,
    gplay.category.DATING,
    gplay.category.ART_AND_DESIGN,
    gplay.category.FINANCE
];

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
    console.log("Initialized Excel");
}

async function getUniqueRandomApps(numApps) {
    let appSet = new Set();
    const worksheet = workbook.getWorksheet(sheetName);
    let firstRow = true;
    worksheet.eachRow((row) => {
        if (!firstRow) {
            // Add the value from column B (cell 2) to the Set
            const appId = row.getCell(2).value;
            appSet.add(appId);
        }
        firstRow = false;
    });

    console.log(`Successfully loaded [${appSet.size}] app id's`)

    let total = 0;
    let appList = [];
    let usedCollections = [];
    let attempts = 0;
    // const categories = await gplay.categories();

    while (appList.length < numApps && attempts < numApps) {
        attempts++;
        let randomCollection = collections[Math.floor(Math.random() * collections.length)];
        const randomCategory = consideredCategories[Math.floor(Math.random() * consideredCategories.length)];
        let randomCountry = ['us', 'ca', 'au', 'gb'][Math.floor(Math.random() * 5)];

        try {
            let apps = await gplay.list({
                collection: randomCollection,
                category: randomCategory,
                num: 200,
                country: randomCountry,
                fullDetail: true,
                throttle: 10
            });

            apps = apps.filter(app => !appSet.has(app.appId));  // Filter out any already added apps
            apps = apps.sort(() => 0.5 - Math.random());  // Shuffle the new apps
            apps = apps.splice(0, 50); //At most 50 apps added from the same collection + category each cycle

            // Add up to the needed number of apps
            for (let app of apps) {
                if (appList.length >= numApps) break;
                if (!appSet.has(app.appId)) {
                    appList.push(app);
                    usedCollections.push(randomCollection);
                    appSet.add(app.appId);
                }
            }

            let found = [];
            for (let i = 0; i < appList.length; i++) {
                const app = appList[i];
                await saveAppDataToExcel(app, randomCollection).then(r => {
                    if (r) {
                        found.push(app);
                        total++;
                    }
                });
            }

            const d = new Date().toISOString();
            console.log(`Saved [${found.length}/${appList.length}] apps to Excel`);

            const millisPerApp = 350000 / appList.length;
            const appsRemaining = numApps - total;
            const millisRemaining = millisPerApp * appsRemaining;
            const minsRemaining = (millisRemaining / 1000) / 60;
            appList = appList.filter(app => !found.includes(app));

            console.log(`[${d}] Sleeping with queue of [${appList.length}] and written [${total}]`);
            console.log(`Estimated time remaining: [${minsRemaining}] minutes`)
            await sleep(300000);
        } catch (e) {
            console.error("Error fetching random apps:", e);
        }
    }

    console.log(`Successfully fetched ${appList.length} unique apps after ${attempts} attempts.`);
    return [appList, usedCollections];
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

async function saveAppDataToExcel(appDetails, usedCollection) {
    try {
        const worksheet = workbook.getWorksheet(sheetName);

        const permissions = await gplay.permissions({ appId: appDetails.appId });
        const dataSafety = await gplay.datasafety({ appId: appDetails.appId });

        const trimDescription = appDetails.descriptionHTML
            .replaceAll("<br><br>", "\\n")
            .replaceAll("<br>", "\\n")
            .replaceAll("<b>", "")
            .replaceAll("</b>", "")
            .replaceAll("<em>", "")
            .replaceAll("</em>", "");

        const decodedDescription = he.decode(trimDescription)

        worksheet.addRow([
            usedCollection,
            appDetails.appId,
            appDetails.url,
            appDetails.title,
            decodedDescription,
            JSON.stringify(appDetails.categories),
            appDetails.free,
            appDetails.contentRating,
            appDetails.minInstalls,
            JSON.stringify(permissions, null, 2),
            JSON.stringify(dataSafety, null, 2),
            appDetails.privacyPolicy
        ]);

        await workbook.xlsx.writeFile(PATH);
        return true;
    } catch (e) {
        console.error("Error writing to excel for appId [" + appDetails.appId + "]:", e);
    }
    return false;
}

async function fetchAndSaveApps(numApps) {
    await initExcel();
    await getUniqueRandomApps(numApps);
}

// getRandomApps().then(apps => console.log(JSON.stringify(apps, null, 2)));

fetchAndSaveApps(800).then(() => {
    console.log('All apps have been processed and saved.');
}).catch(error => {
    console.error('An error occurred:', error);
});