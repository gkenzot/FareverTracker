import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

await page.goto("http://127.0.0.1:3001/", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

// Click Build nav
const buildBtn = page.locator('button:has-text("Build")').first();
if (await buildBtn.count()) {
  await buildBtn.click();
  await page.waitForTimeout(2000);
}

const bodyText = await page.locator("body").innerText();
console.log("ERRORS:", JSON.stringify(errors, null, 2));
console.log("BODY_SNIPPET:", bodyText.slice(0, 800));
await browser.close();
