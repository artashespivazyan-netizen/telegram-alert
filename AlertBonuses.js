require("dotenv").config();
const { getMerchants } = require("./Merchants");
const CSAuctionIdramClient = require("./CSAuctionIdramClient");

const auctionIdramClient = new CSAuctionIdramClient();

const THRESHOLDS = Object.freeze({
    PERSONAL: 9,
    BUSINESS: 14
});

const MIN_AMOUNT = 200;

const CONCURRENCY = 12;
const INTERVAL_MS = 3000;
const RUN_MODE = "PERSONAL"

// 1. Flatten merchants once upon startup
function buildMerchantList(mode) {
    const raw = getMerchants(mode);
    const list = [];
    for (const [type, merchants] of Object.entries(raw)) {
        const threshold = THRESHOLDS[type] ?? THRESHOLDS.BUSINESS;
        for (const [name, data] of Object.entries(merchants)) {
            const id = typeof data === "object" ? data.id : data;
            const url = typeof data === "object" && data.url ? data.url : "idplus://";
            list.push({ type, name, id, url, threshold });
        }
    }
    return Object.freeze(list);
}

const STATIC_MERCHANT_LIST = buildMerchantList(RUN_MODE);

// 2. FIFO Cache for tracking notified deals
const notifiedItemIds = new Set();
const MAX_NOTIFIED_CACHE = 1000;

function rememberNotified(id) {
    if (notifiedItemIds.size >= MAX_NOTIFIED_CACHE) {
        const oldest = notifiedItemIds.values().next().value;
        notifiedItemIds.delete(oldest);
    }
    notifiedItemIds.add(id);
}

// 3. Notification Dispatcher
function sendNotification(merchantName, item, targetUrl, randomNumber) {
    if (!item) return;


    // Generates local time in 24-hour format: "14:05:21"
    const timestamp = new Date().toLocaleTimeString('hy-AM', {
        timeZone: 'Asia/Yerevan',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    const title = `Խնայողություն: ${item.savingPercent}% (${merchantName})`;
    const body =
        `🏪 Գործընկեր: ${merchantName}\n` +
        `💰 Խնայողություն: ${item.savingPercent}%\n` +
        `💵 Վաճառքի գին: ${item.price}\n` +
        `💳 Լոտի արժեք: ${item.amount}\n` +
        `🔴 Համար: #${randomNumber}\n` +
        `🕒 Ժամ: ${timestamp}`;

    const actionUrl = "idplus://merchant/191529"
       // "// targetUrl || "idplus://";

    auctionIdramClient.sendBarkNotification(body, title, actionUrl).catch(err => {
        console.error(`❌ Bark dispatch error for ${merchantName}:`, err.message);
    });
}

// 4. Fast Merchant Checker
async function checkMerchant(merchant, randomNumber) {
    try {
        const response = await auctionIdramClient.getMerchantAuctionItemsByServiceMemberId(merchant.id);
        const auctionItems = response?.data?.value?.auctionItems;

        if (!Array.isArray(auctionItems) || auctionItems.length === 0) return;

        for (let i = 0; i < auctionItems.length; i++) {
            const item = auctionItems[i];

            const itemId = item.id || `${merchant.id}_${item.price}_${item.amount}`;
           console
            if (
                !item.isLocked &&
                item.amount > MIN_AMOUNT &&
                item.savingPercent > merchant.threshold &&
                !notifiedItemIds.has(itemId)
            ) {
                rememberNotified(itemId);
                console.log(`⚡ [MATCH - ${merchant.type}] ${merchant.name}: ${item.savingPercent}% (Amount: ${item.amount})`);

                sendNotification(merchant.name, item, merchant.url, randomNumber);
                break;
            }
        }
    } catch (error) {
        console.error(`⚠️ Merchant ${merchant.name} failed:`, error.message);
    }
}

// 5. Worker Pool
async function runFastPool(items, limit, randomNumber) {
    let cursor = 0;

    const worker = async () => {
        while (cursor < items.length) {
            const item = items[cursor++];
            await checkMerchant(item, randomNumber);
        }
    };

    const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
    await Promise.all(workers);
}

async function checkCycle() {
    const randomNumber = Math.floor(1000 + Math.random() * 9000);
    const start = performance.now();

    await runFastPool(STATIC_MERCHANT_LIST, CONCURRENCY, randomNumber);

    const duration = (performance.now() - start).toFixed(0);
    console.log(`[Cycle Complete] Checked ${STATIC_MERCHANT_LIST.length} merchants in ${duration}ms`);
}

async function loop() {
    try {
        await checkCycle();
    } catch (error) {
        console.error("Critical run error:", error.message);
    } finally {
        setTimeout(loop, INTERVAL_MS);
    }
}

console.log(`🚀 Fast runner started in [${RUN_MODE}] mode (${STATIC_MERCHANT_LIST.length} merchants)...`);
loop();