require("dotenv").config();
const config = require("./config");
const axios = require("axios");
const Merchants = require("./Merchants");

const CSAuctionIdramClient = require("./clients/CSAuctionIdramClient");
const TelegramClient = require("./clients/TelegramClient");

const auctionIdramClient = new CSAuctionIdramClient();
const telegramClient = new TelegramClient();
let notified = false;

async function checkSell() {
  const data = {
      "id": null,
      "succeeded": true,
      "message": null,
      "exceptionCode": null,
      "value": [
          {
              "id": 15345993,
              "merchantLogoUrl": "https://cashback.idram.am/Drive/ServiceMemberImages/215140/Images/3a54d816-ca57-4819-a412-a2bdc199fc88.png",
              "date": "2026-10-24T09:20:52",
              "isPinned": false,
              "dealOperation": 3,
              "isRefund": false,
              "isRefundable": false,
              "dealId": 60146841,
              "parentDealId": null,
              "amount": 605.01,
              "presenterInfo": null,
              "dealInfoItems": [
                  {
                      "name": "Քարտի համարը",
                      "value": "1001637",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Գործարքի ID",
                      "value": "60146841",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Վճարման եղանակը",
                      "value": "Idram",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Իդրամ գործարքի ID",
                      "value": "26102400028158",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Գնման գումարը",
                      "value": "-541.56",
                      "uom": "֏",
                      "dealType": null
                  }
              ],
              "dealDetails": [],
              "dicDocTypeId": 5,
              "merchantName": "Gurmenia Gastrocafe and  Bakery",
              "branchName": null,
              "branchAddress": null,
              "sourceName": "Բոնուս",
              "uom": "Բոնուս",
              "dealType": 3,
              "title": null,
              "notes": null,
              "refundFeePercent": 0.0
          },
          {
              "id": 15342048,
              "merchantLogoUrl": "https://cashback.idram.am/Drive/ServiceMemberImages/215140/Images/3a54d816-ca57-4819-a412-a2bdc199fc88.png",
              "date": "2026-10-23T20:28:30",
              "isPinned": false,
              "dealOperation": 3,
              "isRefund": false,
              "isRefundable": false,
              "dealId": 60129750,
              "parentDealId": null,
              "amount": 411.82,
              "presenterInfo": null,
              "dealInfoItems": [
                  {
                      "name": "Քարտի համարը",
                      "value": "1001637",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Գործարքի ID",
                      "value": "60129750",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Վճարման եղանակը",
                      "value": "Idram",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Իդրամ գործարքի ID",
                      "value": "26102300348102",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Գնման գումարը",
                      "value": "-341.3",
                      "uom": "֏",
                      "dealType": null
                  }
              ],
              "dealDetails": [],
              "dicDocTypeId": 5,
              "merchantName": "Gurmenia Gastrocafe and  Bakery",
              "branchName": null,
              "branchAddress": null,
              "sourceName": "Բոնուս",
              "uom": "Բոնուս",
              "dealType": 3,
              "title": null,
              "notes": null,
              "refundFeePercent": 0.0
          },
          {
              "id": 15302756,
              "merchantLogoUrl": "https://cashback.idram.am/Drive/ServiceMemberImages/215140/Images/3a54d816-ca57-4819-a412-a2bdc199fc88.png",
              "date": "2026-10-20T20:46:47",
              "isPinned": false,
              "dealOperation": 3,
              "isRefund": false,
              "isRefundable": false,
              "dealId": 59955047,
              "parentDealId": null,
              "amount": 4083.33,
              "presenterInfo": null,
              "dealInfoItems": [
                  {
                      "name": "Քարտի համարը",
                      "value": "1001637",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Գործարքի ID",
                      "value": "59955047",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Վճարման եղանակը",
                      "value": "Idram",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Իդրամ գործարքի ID",
                      "value": "26102000413510",
                      "uom": null,
                      "dealType": null
                  },
                  {
                      "name": "Գնման գումարը",
                      "value": "-2657.14",
                      "uom": "֏",
                      "dealType": null
                  }
              ],
              "dealDetails": [],
              "dicDocTypeId": 5,
              "merchantName": "Gurmenia Gastrocafe and  Bakery",
              "branchName": null,
              "branchAddress": null,
              "sourceName": "Բոնուս",
              "uom": "Բոնուս",
              "dealType": 3,
              "title": null,
              "notes": null,
              "refundFeePercent": 0.0
          }
      ]
  }

    let totalAmount = 0;
    let totalPurchaseAmount = 0;

    data.value.forEach(deal => {
        // Sum amount
        totalAmount += Number(deal.amount || 0);

        // Find "Գնման գումարը" item
        deal.dealInfoItems.forEach(item => {
            if (item.name === "Գնման գումարը") {
                totalPurchaseAmount += Math.abs(Number(item.value || 0));
            }
        });
    });

    console.log("Total amount:", totalAmount);
    console.log("Total purchase amount:", totalPurchaseAmount);
    console.log("Difference:", totalAmount - totalPurchaseAmount);

    const amountAfterFee = totalAmount * (1 - 11 / 100);

    console.log("Amount after 11% fee:", amountAfterFee);

    if (amountAfterFee > totalPurchaseAmount) {
        console.log("Go and Sell");
    } else {
        console.log("Please do not sell");
    }

    const profit = amountAfterFee - totalPurchaseAmount;

    if (profit > 0) {
        console.log(`PASS: Profit after selling is ${profit.toFixed(2)}`);
    } else {
        throw new Error(
            `FAIL: Loss after selling is ${Math.abs(profit).toFixed(2)}`
        );
    }

}

checkSell();



