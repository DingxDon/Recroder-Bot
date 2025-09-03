import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { getStream, launch } from "puppeteer-stream";
import path from "path";
import fs from "fs";
import {
  defaultArgs,
  overridePermissions,
  defaultUserAgent,
  userConfig,
  loginUrl,
  baseUrl,
} from "./constants.js";
const __dirname = path.resolve();
const app = express();
app.use(express.json());

const stealth = StealthPlugin();
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteer.use(stealth);

let browser = null;

async function createBrowser({ url }) {
  browser = await launch(puppeteer, {
    headless: false,
    defaultViewport: null,
    executablePath: "/usr/bin/google-chrome",
    args: defaultArgs,
    userDataDir: `${__dirname}/user`,
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, overridePermissions);

  return browser;
}

async function getPage(url) {
  const page = await browser.newPage();

  await page.setUserAgent(defaultUserAgent);
  await page.goto(url, {
    waitUntil: "networkidle2",
  });

  return page;
}

async function isLoggedIn(page) {
  const cookies = await page.cookies();
  const loggedIn = cookies.some(
    (c) => c.domain.includes("google.com") && c.name === "SID"
  );

  console.log(loggedIn ? "already logged in." : "not logged in");

  return loggedIn;
}

async function loginUser(page) {
  const { email, password, typingDelay } = userConfig;

  for (const step of [email, password]) {
    await page.waitForSelector(step.selector, { visible: true });
    await page.type(step.selector, step.value, { delay: typingDelay });
    await Promise.all([
      step.action(page),
      page.waitForNavigation({ waitUntil: "networkidle2" }),
    ]);
  }
}

async function joinMeet(page, recoding, username = "Recorder") {
  try {
    const joinButton = page.locator("span.UywwFc-vQzf8d", {
      timeout: 5000,
    });
    await joinButton.click();
    console.log("join button Clicked");
    getRecorder(page, recoding);
  } catch {
    console.log("can't find join button!");
  }
}

async function getRecorder(
  page,
  params = { audio: true, video: true, fileType: ".mp4" }
) {
  const stream = await getStream(page, {
    audio: params.audio,
    video: params.video,
  });

  const path = path.join(__dirname, `${Date.now()}${params.fileType}`);
  const file = fs.createWriteStream(path);

  stream.pipe(file);

  console.log(`Recording saved at: ${path}`);
  return path;
}

const main = async (id, recoding) => {
  await createBrowser({ url: baseUrl });
  const page = await getPage(`${baseUrl}/${id}`);

  if (!(await isLoggedIn(page))) {
    await page.goto(loginUrl, { waitUntil: "networkidle2" });
    await loginUser(page);
    await page.goto(`${baseUrl}/${id}`, { waitUntil: "networkidle2" });
  }

  await joinMeet(page, recoding, "Recorder");
};

app.post("/join", async (req, res) => {
  const { id, recoding } = req.body;
  if (!id) return res.status(400).json({ error: "Invalid Params" });

  try {
    await main(id, recoding);
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.post("/stop", async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "Invalid Params" });

  try {
    browser.close();
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.listen(8080, () => console.log("Server Started on port 8080"));
