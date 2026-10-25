require("dotenv").config();
const config = require("./config");
const axios = require("axios");
const Merchants = require("./Merchants");

const CSAuctionIdramClient = require("./clients/CSAuctionIdramClient");
const TelegramClient = require("./clients/TelegramClient");

const auctionIdramClient = new CSAuctionIdramClient();
const telegramClient = new TelegramClient();

async function sendNotification(
    merchantType,
    merchantName,
    item,
    minSavingPercent,
    randomNumber
) {
    await telegramClient.sendTelegramNotification(
        `🎯 Տեսակ: <b>${merchantType}</b>\n` +
        `🏪 Գործընկեր: <b>${merchantName}</b>\n` +
        `💰 Խնայողություն: <b>${item.savingPercent}%</b>\n` +
        `📈 Նվազագույն տոկոս: <b>> ${minSavingPercent}%</b>\n` +
        `💵 Վաճառքի գին: <b>${item.price}</b>\n` +
        `💳 Լոտի արժեք: <b>${item.amount}</b>\n` +
        `🔴 Համար: <b>${randomNumber}</b>`
    );
}

const THRESHOLDS = {
    PERSONAL: 10,
    BUSINESS: 12
};

const MAX_AMOUNT = 20000;

async function checkPercent() {
    const randomNumber = Math.floor(Math.random() * 101);

    for (const [merchantType, merchants] of Object.entries(Merchants)) {
        console.log(`\n========== Type: ${merchantType} ==========`);

        const minSavingPercent = THRESHOLDS[merchantType];


        for (const [merchantName, merchantId] of Object.entries(merchants)) {

            console.log(`Checking ${merchantName} (${merchantId})...`);

            try {
                const response =
                    await auctionIdramClient.getMerchantAuctionItemsByServiceMemberId(
                        merchantId
                    );

                const auctionItems =
                    response?.data?.value?.auctionItems ?? [];

                if (!auctionItems.length) {
                    console.log(`No auction items found for ${merchantName}`);
                    continue;
                }

                const matchedItem = auctionItems.find(
                    item =>
                        !item.isLocked &&
                        item.amount < MAX_AMOUNT &&
                        item.savingPercent > minSavingPercent
                );

                if (!matchedItem) {
                    continue;
                }

                console.log(
                    `Match found for ${merchantType}: ${merchantName}`
                );

                await sendNotification(
                    merchantType,
                    merchantName,
                    matchedItem,
                    minSavingPercent,
                    randomNumber
                );

                notificationSent = true;

                console.log(
                    `Notification sent for ${merchantType} - ${merchantName}`
                );

            } catch (error) {
                console.error(
                    `Failed to process merchant ${merchantName}:`,
                    error.message
                );
            }
        }

    }
}


checkPercent();



