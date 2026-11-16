const { chromium } = require("playwright");
const BASE = "http://127.0.0.1:8000";
const OUT = "/tmp/opencode/asha-qa";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      "/home/dangerking8x/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome",
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--use-file-for-fake-audio-capture=/tmp/ashasetu_hinglish.wav",
    ],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    permissions: ["microphone"],
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.log("PAGEERROR:", error.message));
  page.on("console", (message) => {
    if (message.type() === "error") console.log("CONSOLE:", message.text());
  });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Priya/ }).click();
  await page.waitForURL(`${BASE}/`);
  await page.goto(`${BASE}/record`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Start recording" }).click();
  await page.waitForTimeout(8500);
  const stop = page.getByRole("button", { name: "Stop recording" });
  console.log("stop visible:", await stop.isVisible());
  await stop.click();
  await page.waitForURL(/\/review\/[a-f0-9]+/, { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1200);
  console.log("review url:", page.url());
  const transcript = await page.locator("textarea").first().inputValue().catch(() => "");
  console.log("first textarea value:", transcript.slice(0, 160));
  await page.screenshot({ path: `${OUT}/15-review-recorded.png`, fullPage: true });

  const confirm = page.getByRole("button", { name: /Confirm & read back/ });
  await confirm.scrollIntoViewIfNeeded();
  await confirm.click();
  await page.waitForURL(/\/readback\/[a-f0-9]+/, { timeout: 90000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(7000);
  console.log("readback url:", page.url());
  const quote = await page.locator("blockquote").textContent();
  console.log("readback text:", (quote || "").slice(0, 220));
  const times = await page.locator("audio").evaluate((audio) => ({
    duration: audio.duration,
    src: audio.currentSrc ? audio.currentSrc.slice(0, 30) : null,
  }));
  console.log("audio:", JSON.stringify(times));
  await page.screenshot({ path: `${OUT}/16-readback-recorded.png`, fullPage: true });

  await context.close();

  const supervisor = await browser.newContext({
    viewport: { width: 1280, height: 1000 },
    serviceWorkers: "block",
    acceptDownloads: true,
  });
  const dash = await supervisor.newPage();
  await dash.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await dash.getByRole("button", { name: /Dr\. Rao/ }).click();
  await dash.waitForURL("**/dashboard");
  await dash.waitForLoadState("networkidle");
  await dash.waitForTimeout(900);
  const downloadPromise = dash.waitForEvent("download");
  await dash.getByRole("button", { name: "Export CSV" }).click();
  const download = await downloadPromise;
  const path = await download.path();
  console.log("download:", download.suggestedFilename(), path);
  const fs = require("fs");
  const csv = fs.readFileSync(path, "utf8");
  console.log("csv lines:", csv.split("\n").length, "header:", csv.split("\n")[0].slice(0, 90));
  await dash.screenshot({ path: `${OUT}/17-dashboard-after-e2e.png`, fullPage: true });

  await browser.close();
  console.log("done");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
