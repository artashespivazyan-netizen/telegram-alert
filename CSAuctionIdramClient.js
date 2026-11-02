const axios = require("axios");
const http = require("http");
const https = require("https");
const config = require("./config");
const dns = require('dns');

// Reusable TCP/TLS connections to minimize handshake latency
const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 50 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 50 });

class CSAuctionIdramClient {
    constructor() {

        if (dns.setDefaultResultOrder) {
            dns.setDefaultResultOrder('ipv4first');
        }


        this.apiClient = axios.create({
            baseURL: config.CS_AUCTION_IDRAM,
            httpsAgent: new https.Agent({ family: 4, keepAlive: true }),
            timeout: 5000,
            httpAgent,
            headers: { "Accept-Encoding": "gzip,deflate,br" }
        });

        this.barkClient = axios.create({
            baseURL: config.BARK_SERVER_URL || "https://api.day.app",
            timeout: 4000,
            httpAgent,
            httpsAgent
        });

        this.barkKey = config.BARK_DEVICE_KEY || "9YnqS54wcgaYfiqve2eSGe";
        this.htmlRegex = /<[^>]*>?/gm;
    }

    /**
     * Fetch auction items for a specific merchant
     * @param {string|number} memberId
     */
    async getMerchantAuctionItemsByServiceMemberId(memberId) {
        return this.apiClient.get("/Bonus/GetMerchantAuctionItems", {
            params: {
                end: 400,
                serviceMemberId: memberId,
                start: 0
            }
        });
    }

    /**
     * Sends a push notification to iOS via Bark
     * @param {string} message - Notification text
     * @param {string} [title="Idram Alert"] - Notification title
     * @param {string} [actionUrl="idplus://"] - Direct app scheme or shortcut link
     */
    async sendBarkNotification(
        message,
        title = "Idram Alert",
        actionUrl = "idplus://"
    ) {
        const plainText = typeof message === "string"
            ? message.replace(this.htmlRegex, "")
            : String(message);

        const payload = {
            title,
            body: plainText,
         //   sound: "minuet",
            level: "timeSensitive",
            group: "IdramAuction",
            url: actionUrl
        };

        return this.barkClient.post(`/${this.barkKey}`, payload);
    }
}

module.exports = CSAuctionIdramClient;