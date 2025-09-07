import dotenv from "dotenv";
dotenv.config();

export const baseUrl = "https://meet.google.com";
export const loginUrl = "https://accounts.google.com";
export const defaultArgs = [
  "--disable-notifications",
  "--mute-audio",
  "--enable-automation",
  "--start-maximized",
  "--no-sandbox",
  "--disable-setuid-sandbox",
];
export const overridePermissions = ["microphone", "camera", "notifications"];
export const defaultUserAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
export const userConfig = {
  email: {
    selector: 'input[type="email"]',
    value: process.env.GOOGLE_EMAIL,
    action: (page) => page.click("#identifierNext"),
  },
  password: {
    selector: 'input[type="password"]',
    value: process.env.GOOGLE_PASSWORD,
    action: (page) => page.keyboard.press("Enter"),
  },
  typingDelay: 70,
};
