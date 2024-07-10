const ExcelJS = require('exceljs');

const WORKBOOK_NAME = 'data.xlsx';
const PATH = 'Scrapers & Tools\\' + WORKBOOK_NAME;

async function processExcel() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(PATH);
    const worksheet = workbook.getWorksheet('comparison');

    worksheet.eachRow(function (row, rowNumber) {
        if (rowNumber > 1) {
            if (row.getCell(1).value !== null && row.getCell(1).value !== "") {
                const appName1 = row.getCell('B').value.toLowerCase();
                const appName2 = row.getCell('E').value.toLowerCase();
                const appDesc1 = row.getCell('C').value.toLowerCase();
                const appDesc2 = row.getCell('F').value.toLowerCase();

                const title_distance = lev(appName1, appName2);
                const title_ratio = lev(appName1, appName2, true);

                const desc_distance = lev(appDesc1, appDesc2);
                const desc_ratio = lev(appDesc1, appDesc2, true);

                row.getCell('G').value = title_distance;
                row.getCell('H').value = title_ratio;
                row.getCell('I').value = desc_distance;
                row.getCell('J').value = desc_ratio;
            }
        }
    });

    await workbook.xlsx.writeFile(PATH);
    console.log('Excel file has been updated!');
}

processExcel().catch(console.error);

/**
 * Method to calculate the Lenvenshtein distance and ratio between two given words.
 * @param a the first word appearing also on the formula
 * @param b the second word appearing also on the formula
 * @param ratio the levenshtein ratio is returned when true, false by default
 * @return {*|number} the levenshtein distance or ratio
 */
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