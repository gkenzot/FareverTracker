import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err.stack || err)));
page.on("console", (msg) => {
  if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
});

await page.goto("http://127.0.0.1:3001/", { waitUntil: "networkidle" });

// Seed a character + empty build in localStorage
await page.evaluate(() => {
  const id = "probe-char-1";
  localStorage.setItem(
    "farever-check:characters",
    JSON.stringify([{ id, name: "Probe", className: "Warrior" }])
  );
  localStorage.setItem("farever-check:active-character", id);
  localStorage.setItem(
    `farever-check:character-build:${id}`,
    JSON.stringify({ version: 1, sets: [{ id: "a", label: "A", equipment: {}, classSkills: {}, talents: {}, arsenal: {} }] })
  );
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(500);

await page.locator('button:has-text("Build")').first().click();
await page.waitForTimeout(1500);

const tabs = await page.locator('.build-lab-tabs button').allTextContents();
console.log("TABS:", tabs);

for (const name of ["Attributes", "Damage analysis", "Damage compare", "Weapons analysis"]) {
  const btn = page.locator(`.build-lab-tabs button:has-text("${name}")`);
  if (!(await btn.count())) {
    console.log("MISSING TAB", name);
    continue;
  }
  await btn.click();
  await page.waitForTimeout(800);
  const selected = await btn.getAttribute("aria-selected");
  const h2s = await page.locator(".build-lab-page h2").allTextContents();
  const bodyLen = (await page.locator(".build-lab-page").innerText()).length;
  console.log(`\n=== ${name} selected=${selected} bodyLen=${bodyLen} ===`);
  console.log("h2:", h2s);
  if (errors.length) {
    console.log("ERRORS so far:", errors);
    errors.length = 0;
  }
}

console.log("\nFINAL ERRORS:", JSON.stringify(errors, null, 2));
await browser.close();
