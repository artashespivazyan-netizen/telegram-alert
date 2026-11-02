const axios = require("axios");
const config = require("../config");

const requiredConfig = [
    "BARK_DEVICE_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_CHAT_ID"
].filter((key) => !config[key]);

if (requiredConfig.length > 0) {
    throw new Error(
        `Missing required environment configuration: ${requiredConfig.join(", ")}`
    );
}

const BARK_URL = `${config.BARK_SERVER_URL}/${config.BARK_DEVICE_KEY}`;
const TELEGRAM_URL = `${config.TELEGRAM_API_URL}/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
const TELEGRAM_CHAT_ID = config.TELEGRAM_CHAT_ID;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runAudioVisualTest() {
    console.log("👀 Get ready! Look at your iPhone screen...");
    for (let i = 3; i > 0; i--) {
        console.log(`Firing in ${i}...`);
        await sleep(1000);
    }
    console.log("🚀 DISPATCHING NOW!");

    const t0 = performance.now();

    // Fire both at the exact same instant
    await Promise.allSettled([
        // 1. Telegram (Plays standard Telegram chime)
        axios.post(TELEGRAM_URL, {
            chat_id: String(TELEGRAM_CHAT_ID),
            text: "🔴 <b>TELEGRAM ARRIVED</b>",
            parse_mode: "HTML"
        }),

        // 2. Bark (Configured with 'alarm' sound to distinctly contrast with Telegram)
        axios.post(BARK_URL, {
            title: "🔵 BARK ARRIVED",
            body: "Notice which banner dropped from the top first!",
            sound: "alarm", // loud, distinct horn/alarm sound
            level: "timeSensitive"
        })
    ]);

    console.log(`Dispatched in ${(performance.now() - t0).toFixed(1)}ms. Check which sound/banner hit first.`);
}

runAudioVisualTest();