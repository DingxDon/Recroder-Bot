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
stealth.enabledEvasions.delete("navigator.webdriver"); // Disable the problematic evasion
stealth.enabledEvasions.delete("iframe.contentWindow");
stealth.enabledEvasions.delete("media.codecs");
puppeteer.use(stealth);

let browser = null;
let meetings = [];

async function createMeeting(payload) {
  return {
    id: payload.id,
    isRecording: {
      audio: payload.isRecording?.audio ?? false,
      video: payload.isRecording?.video ?? false,
    },
    isStopped: payload.isStopped ?? false,
    page: null,
    stream: null,
    filePath: null,
  };
}

async function BotManager(obj, stop = false) {
  const { id } = obj;
  let meeting = meetings.find((m) => m.id === id);

  if (stop && meeting) {
    meeting.isStopped = true;
    if (meeting.stream) meeting.stream.destroy();
    if (meeting.page) await meeting.page.close();
  } else if (!stop) {
    if (!meeting) {
      meetings.push(await createMeeting(obj));
    } else {
      meeting.isStopped = false;
    }
  }
  return meetings;
}

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

async function joinMeet(page, recording) {
  try {
    const joinButton = page.locator("span.UywwFc-RLmnJb", {
      timeout: 5000,
    });
    await joinButton.click();
    console.log("join button Clicked");
    return await getRecorder(page, recording);
  } catch {
    console.log("can't find join button!");
    return null;
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
  console.log("recorder Started");

  const filePath = path.join(__dirname, `${Date.now()}${params.fileType}`);
  const file = fs.createWriteStream(filePath);

  stream.pipe(file);

  console.log(`Recording saved at: ${filePath}`);
  return { stream, filePath };
}

const main = async (id, recording) => {
  if (!browser) await createBrowser({ url: baseUrl });

  const page = await getPage(`${baseUrl}/${id}`);
  const meeting = meetings.find((m) => m.id === id);
  if (meeting) {
    meeting.page = page;
  }

  if (meeting && meeting.isStopped) {
    await page.close();
    return;
  }

  if (!(await isLoggedIn(page))) {
    await page.goto(loginUrl, { waitUntil: "networkidle2" });
    await loginUser(page);
    await page.goto(`${baseUrl}/${id}`, { waitUntil: "networkidle2" });
  }

  const result = await joinMeet(page, recording);

  if (meeting && result) {
    meeting.stream = result.stream;
    meeting.filePath = result.filePath;
  }
  return result;
};

app.post("/join", async (req, res) => {
  const { id, isRecording } = req.body;
  if (!id) return res.status(400).json({ error: "Invalid Params" });

  try {
    await BotManager(req.body);
    await main(id, isRecording);
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/stop/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Id not Provided" });

  try {
    await BotManager({ id }, true);
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.get("/stop-all", async (req, res) => {
  if (!browser)
    return res.status(400).json({ error: "No instance available to stop" });

  try {
    for (let meeting of meetings) {
      await BotManager(meeting, true);
    }
    await browser.close();
    browser = null;
    res.status(200).json("ok");
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  }
});

app.listen(8080, () => console.log("Server Started on port 8080"));
