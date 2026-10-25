require("dotenv").config();
const config = require("./config");
const axios = require("axios");

let notified = false;

async function sendTelegramMessage(message) {
    try {
        const url = `${config.TELEGRAM_URL}/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;

        const payload = {
            chat_id: `${config.TELEGRAM_CHAT_ID}`,
            text: "🚀 Hello from Node.js!"
        };

console.log(url);
console.log(payload);
        await axios.post(url, payload);
        console.log("Message sent");
    } catch (error) {
        console.error("Telegram Error:");
        if (error.response) {
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(error.message);
        }
    }
}

async function checkPercent() {
    const response = await axios.get("https://petstore.swagger.io/v2/pet/2");
    const id = response.data.id;

    if (id == 2 && !notified) {
        await sendTelegramMessage(`🚨 Alert! Percent is ${id}%`);
        notified = true;
    }
}

setInterval(checkPercent, 3000);
checkPercent();