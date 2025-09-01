import express from "express";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { launch } from "puppeteer-stream";
import path from "path";
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

async function createBrowser({ url }) {
  const browser = await launch(puppeteer, {
    headless: false,
    slowMo: 50,
    defaultViewport: null,
    executablePath: "/usr/bin/google-chrome",
    args: defaultArgs,
    userDataDir: `${__dirname}/user`,
  });

  const context = browser.defaultBrowserContext();
  await context.overridePermissions(url, overridePermissions);

  return browser;
}

async function getPage(browser, url) {
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

async function joinMeet(page, username = "Recorder") {
  const nameInput = await page.locator('input[type="text"]', { timeout: 5000 });
  await nameInput.fill(username);

  let joinButton = page.locator("span.UywwFc-vQzf8d", {
    timeout: 5000,
  });
  if (joinButton) {
    await joinButton.click();
    console.log("Joined Meet");
  } else {
    console.log("Could not join meet!");
  }
}

const main = async () => {
  const browser = await createBrowser({ url: baseUrl });

  const loginPage = await getPage(browser, loginUrl);
  if (!(await isLoggedIn(loginPage))) {
    await loginPage(loginPage);
  }
  // const page = await getPage(browser, `${baseUrl}/fzj-qtha-rvg`);
  // await delay(5000);
  // await joinMeet(page, "Recorder");
};

main();
