import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

await page.goto("http://127.0.0.1:3001/", { waitUntil: "networkidle" });
await page.waitForTimeout(500);

// Create a character so build page has content
const charactersBtn = page.locator('button[title="Manage characters"], button:has-text("settings")').first();
await page.locator('button:has-text("Build")').first().click();
await page.waitForTimeout(800);

const before = await page.locator(".build-lab-page").innerText().catch(() => "NO PAGE");
console.log("--- BEFORE analysis click ---");
console.log(before.slice(0, 400));

await page.locator('button[role="tab"]:has-text("Damage analysis")').click();
await page.waitForTimeout(1000);

const after = await page.locator(".build-lab-page").innerText().catch(() => "NO PAGE");
console.log("--- AFTER analysis click ---");
console.log(after.slice(0, 800));
console.log("ERRORS:", JSON.stringify(errors, null, 2));

const analysisActive = await page.locator('button[role="tab"]:has-text("Damage analysis").active, button[role="tab"][aria-selected="true"]:has-text("Damage analysis")').count();
console.log("analysis tab selected count:", analysisActive);

const skillHeader = await page.locator("h2:has-text('Skill')").count();
const bossHeader = await page.locator("h2:has-text('Boss level')").count();
console.log("Skill h2:", skillHeader, "Boss h2:", bossHeader);

await browser.close();
