const axios = require("axios");
const config = require("./config");

async function deleteMessages(messageIds) {
    const url =
        `${config.TELEGRAM_API_URL}/bot` +
        `${config.TELEGRAM_BOT_TOKEN}/deleteMessage`;

    for (const messageId of messageIds) {
        try {
            const response = await axios.post(url, {
                chat_id: config.TELEGRAM_CHAT_ID,
                message_id: messageId
            });

            if (response.data.ok) {
                console.log(`Deleted message ID: ${messageId}`);
            }
        } catch (error) {
            console.error(
                `Failed to delete message ID ${messageId}:`,
                error.response?.data || error.message
            );
        }
    }
}

// Replace with IDs you actually obtained from Telegram
const messageIds = [101, 102, 103, 104, 105];

deleteMessages(messageIds);