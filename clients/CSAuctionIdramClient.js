const axios = require("axios");
const config = require("../config");

class CSAuctionIdramClient {

 async   getMerchantAuctionItemsByServiceMemberId(memberId) {
     const url = `${config.CS_AUCTION_IDRAM}/Bonus/GetMerchantAuctionItems`;
     console.log("URL " + url);
     console.log("MemberId " + memberId);

     const params = {
         end: 400,
         serviceMemberId: memberId,
         start: 0
     };

     console.log("=== Axios Request ===");
     console.log("Method:", "GET");
     console.log("URL:", url);
     console.log("Params:", params);

     const response = await axios.get(url, {
         params
     });
        return response;
    }
}

module.exports = CSAuctionIdramClient;