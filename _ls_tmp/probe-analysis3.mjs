import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(String(err.stack || err)));
page.on("console", (msg) => {
  if (["error", "warning"].includes(msg.type())) {
    errors.push(`${msg.type()}: ${msg.text()}`);
  }
});

await page.goto("http://127.0.0.1:3001/", { waitUntil: "networkidle" });
await page.evaluate(() => {
  const id = "probe-char-1";
  localStorage.setItem(
    "farever-check:characters",
    JSON.stringify([{ id, name: "Probe", className: "Warrior" }])
  );
  localStorage.setItem("farever-check:active-character", id);
  localStorage.setItem(
    `farever-check:character-build:${id}`,
    JSON.stringify({
      version: 2,
      sets: [
        {
          id: "set-a",
          label: "A",
          equipment: {},
          classSkills: { runesBySkillId: {}, activeSkillIds: [], activeSkillsTouched: false },
          talents: { pointsById: {} },
          arsenal: { selectedIds: [] }
        }
      ]
    })
  );
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.locator(".side-section >> text=Build").click();
await page.waitForSelector(".build-lab-tabs");
await page.waitForTimeout(1500);

async function dump(label) {
  const html = await page.locator(".build-lab-page").innerHTML().catch(() => "GONE");
  const text = await page.locator(".build-lab-page").innerText().catch(() => "GONE");
  console.log(`\n##### ${label} #####`);
  console.log("errors:", errors.splice(0));
  console.log("text:", text.slice(0, 600));
  console.log("has Skill:", html.includes("Skill"));
  console.log("has Boss:", html.includes("Boss"));
  console.log("has Secondary:", html.includes("secondary") || html.includes("Secondary") || html.includes("Fer"));
  console.log("has paper-doll/eq:", html.includes("eq-") || html.includes("paper"));
}

await dump("initial (equipment)");

const analysisTab = page.locator(".build-lab-tabs >> text=Damage analysis");
console.log("analysis tab count", await analysisTab.count());
await analysisTab.click();
await page.waitForTimeout(1500);
await dump("after analysis click");

const compareTab = page.locator(".build-lab-tabs >> text=Damage compare");
console.log("compare tab count", await compareTab.count());
await compareTab.click();
await page.waitForTimeout(1500);
await dump("after compare click");

await browser.close();
