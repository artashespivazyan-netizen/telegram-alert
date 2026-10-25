const axios = require("axios");
const config = require("../config");

class CSAuctionIdramClient {

 async   getMerchantAuctionItemsByServiceMemberId(memberId) {
     const url = `${config.CS_AUCTION_IDRAM}/Bonus/GetMerchantAuctionItems`;
     console.log("URL " + url);
        const response =  await axios.get(
            `${config.CS_AUCTION_IDRAM}/Bonus/GetMerchantAuctionItems`,
            {
                params: {
                    end: 400,
                    serviceMemberId: memberId,
                    start: 0
                }
            }
        );

        console.log("response_test")
        console.log(JSON.stringify(response.data, null, 2));

        return response;
    }
}

module.exports = CSAuctionIdramClient;