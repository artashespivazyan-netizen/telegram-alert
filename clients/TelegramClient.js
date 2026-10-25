const axios = require("axios");
const config = require("../config");

class CSAuctionIdramClient {

    async sendTelegramNotification(message) {
        const url = `${config.TELEGRAM_API_URL}/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`;
        const payload = {
            chat_id: `${config.TELEGRAM_CHAT_ID}`,
            text: message,
            parse_mode: "HTML"
        };
        await axios.post(url, payload);
    }
}

module.exports = CSAuctionIdramClient;