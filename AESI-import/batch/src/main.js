import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';

const timeout = 60000;
const longTimeout = 10 * timeout;

async function main() {
    let [baseURL, userDataDir, folder, filename] = process.argv.slice(2);
    if (!baseURL || !userDataDir || !folder || !filename) {
        console.error("Arguments: baseURL userDataDir folder filename");
        return;
    }
    console.log([baseURL, userDataDir, folder, filename]);
    try {
        await fs.access(filename, fs.constants.R_OK);
    } catch(exc) {
        console.error("Invalid file: " + filename);
        return;
    }
    if (filename.endsWith('index.csv')) {
        console.error("Ignore index");
        return;
    }
    let runner = await Runner.create(baseURL, userDataDir);
    await runner.login('Codelist import', 'Codemapper2000');
    await runner.importCodeList(folder, filename);
    // await runner.forever();
    await runner.close();
}

class Runner {
    constructor(browser, page, baseURL) {
        this.browser = browser;
        this.page = page;
        this.baseURL = baseURL;
    }
    static async create(baseURL, userDataDir) {
        let args = ['--disable-web-security'];
        let options = {headless: false, userDataDir, args}; // slowMo: 20
        const browser = await puppeteer.launch(options);
        const pages = await browser.pages();
        const page = pages[0];
        // await page.setCacheEnabled(false);
        page.setDefaultTimeout(timeout);
        return new Runner(browser, page, baseURL);
    }
    async forever() {
        await this.page.goto(this.baseURL);
        await forever();
    }
    async login(username, password) {
        await this.page.goto(this.baseURL);
        await this.page.waitForNetworkIdle();
        let logout = await this.page.$('button.logout');
        if (logout) {
            console.log("already logged in");
            return;
        }
        let url = this.baseURL + "/login";
        await this.page.waitForNetworkIdle();
        await this.page.goto(url);
        await this.page.locator('input.username').fill(username);
        await this.page.locator('input.password').fill(password);
        await this.page.locator('button.login').click();
    }
    async importCodeList(folder, filename) {
        await this.page.goto(this.baseURL + '/folder/' + folder);
        await this.page.waitForNetworkIdle();
        await this.page.click('button.tool-import-codelist');
        let fileInput = await this.page.waitForSelector('input.mapping-file');
        await fileInput.uploadFile(filename);
        await this.page.locator('button.mapping-import').click();
        await this.page.locator('button.tool-mapping-save').click();
        await this.page.locator('textarea.save-summary').fill('SharePoint import');
        await this.page.locator('button.mapping-save').click();
        await this.page.waitForNetworkIdle();
        await this.page.waitForSelector('button.mapping-save', {hidden: true, timeout: longTimeout});
        await this.page.waitForNetworkIdle();
        console.log("Imported", folder, filename);
    }
    async close() {
        await this.browser.close();
    }
}

function forever() {
    return new Promise((resolve, reject) => {});
}

try {
    await main();
} catch(exn) {
    console.error(exn.toString());
}
