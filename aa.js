require("dotenv").config();

global.performance = require('perf_hooks').performance;
const https = require('https');
const { getMerchants } = require("./Merchants");
const CSAuctionIdramClient = require("./CSAuctionIdramClient");

const auctionIdramClient = new CSAuctionIdramClient();

const THRESHOLDS = Object.freeze({
    PERSONAL: 9,
    BUSINESS: 11
});

const MIN_AMOUNT = 200;
const CONCURRENCY = 20;
const INTERVAL_MS = 6000;
const RUN_MODE = "ALL"
// 1. Flatten merchants list once upon startup
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

// Cleans raw env input (e.g., handles "https://api.day.app/KEY/" vs "KEY")
function sanitizeBarkKey(rawKey) {
    if (!rawKey) return "";
    return rawKey.replace(/^https?:\/\/api\.day\.app\/?/, "").replace(/\/+$/, "").trim();
}

// Direct Bark API POST request ensuring Unicode support and APNs delivery
function postBarkPush(deviceKey, title, body, actionUrl) {
    return new Promise((resolve, reject) => {
        const cleanKey = sanitizeBarkKey(deviceKey);
        if (!cleanKey) {
            return reject(new Error("Bark device key is empty or invalid. Check BARK_KEY in .env"));
        }

        const payload = JSON.stringify({
            device_key: cleanKey,
            title: title,
            body: body,
            url: actionUrl,
            group: "auction_deals",
            level: "timeSensitive"
        });

        const req = https.request(
            {
                hostname: "api.day.app",
                path: "/push",
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    "Content-Length": Buffer.byteLength(payload)
                },
                timeout: 8000
            },
            (res) => {
                let data = "";
                res.on("data", (chunk) => { data += chunk; });
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.code === 200) {
                            resolve(parsed);
                        } else {
                            reject(new Error(`Bark rejected push: ${data}`));
                        }
                    } catch (e) {
                        if (res.statusCode >= 200 && res.statusCode < 300) {
                            resolve(data);
                        } else {
                            reject(new Error(`Bark server error ${res.statusCode}: ${data}`));
                        }
                    }
                });
            }
        );

        req.on("error", (err) => reject(err));
        req.on("timeout", () => {
            req.destroy();
            reject(new Error("Bark request timed out (8s)"));
        });

        req.write(payload);
        req.end();
    });
}

// 3. Notification Dispatcher
// 1. Cache environment variables once at module startup
const BARK_KEY = process.env.BARK_KEY;

// 2. Pre-compile the Intl formatter once outside the function (0ms runtime overhead)
const timeFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Yerevan',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

async function sendNotification(merchantName, item, targetUrl, randomNumber) {
    if (!item) return;

    // Fast-path time formatting using the pre-compiled formatter
    const timestamp = timeFormatter.format(Date.now());

    // Single template literal allocation instead of 6 string concatenations
    const savingPercent = item.savingPercent;
    const title = `Խնայողություն: ${savingPercent}% (${merchantName})`;
    const body = `🏪 Գործընկեր: ${merchantName}
💰 Խնայողություն: ${savingPercent}%
💵 Վաճառքի գին: ${item.price}
💳 Լոտի արժեք: ${item.amount}
🔴 Համար: #${randomNumber}
🕒 Ժամ: ${timestamp}`;

    const actionUrl = targetUrl || "idplus://";

    try {
        if (BARK_KEY) {
            await postBarkPush(BARK_KEY, title, body, actionUrl);
        } else if (typeof auctionIdramClient.sendBarkNotification === "function") {
            await auctionIdramClient.sendBarkNotification(body, title, actionUrl);
        } else {
            console.error('❌ No valid BARK_KEY set in .env and client has no sendBarkNotification!');
            return;
        }

        // Log asynchronously after network completion
        console.log(`🔔 [Bark Sent] Push delivered for ${merchantName}`);
    } catch (err) {
        console.error(`❌ Bark dispatch error for ${merchantName}:`, err.message);
    }
}

// 4. Fast Merchant Checker
async function checkMerchant(merchant, randomNumber) {
        try {
            const response = await auctionIdramClient.getMerchantAuctionItemsByServiceMemberId(merchant.id);

            // Direct property chaining is faster than optional chaining (?.)
            const data = response && response.data;
            const value = data && data.value;
            if (!value) return;

            const auctionItems = value.auctionItems;
            if (!Array.isArray(auctionItems) || auctionItems.length === 0) return;

            const { id: merchantId, threshold: merchantThreshold, name: merchantName, url: merchantUrl } = merchant;

            let notificationPromises = null;

            for (let i = 0, len = auctionItems.length; i < len; i++) {
                const item = auctionItems[i];

                // 1. Fast boolean check
                if (item.isLocked) continue;

                // 2. Coerce numbers
                const amount = +item.amount;
                if (amount <= MIN_AMOUNT) continue;

                const savingPercent = +item.savingPercent;
                if (savingPercent <= merchantThreshold) continue;

                // 3. Fallback string concatenation without template literal overhead
                const itemId = item.id || (merchantId + '_' + item.price + '_' + item.amount);

                // 4. Set lookup
                if (!notifiedItemIds.has(itemId)) {
                    rememberNotified(itemId);

                    // Initialize promise array on first match only (avoids GC allocations on misses)
                    if (notificationPromises === null) {
                        notificationPromises = [];
                    }

                    // Fire the push notification immediately without blocking
                    notificationPromises.push(
                        sendNotification(merchantName, item, merchantUrl, randomNumber)
                    );
                }
            }

            // Wait only if any notifications were dispatched
            if (notificationPromises !== null) {
                await Promise.all(notificationPromises);
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

// 6. Drift-Compensated Loop
async function loop() {
    const cycleStart = performance.now();

    try {
        await checkCycle();
    } catch (error) {
        console.error("Critical run error:", error.message);
    } finally {
        const elapsed = performance.now() - cycleStart;
        const nextDelay = Math.max(0, INTERVAL_MS - elapsed);
        setTimeout(loop, nextDelay);
    }
}

// Diagnostics check on boot
(async () => {
    console.log(`🚀 Fast runner started in [${RUN_MODE}] mode (${STATIC_MERCHANT_LIST.length} merchants)...`);

    if (process.env.BARK_KEY) {
        console.log(`🔑 Bark key detected: ${sanitizeBarkKey(process.env.BARK_KEY).substring(0, 6)}******`);
    } else {
        console.warn(`⚠️ Warning: BARK_KEY is not defined in .env!`);
    }

    loop();
})();