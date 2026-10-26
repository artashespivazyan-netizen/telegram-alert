require("dotenv").config();

async function checkSell() {

    const fs = require("fs");

    const jsonData = fs.readFileSync("./sell.json", "utf8");
    const data = JSON.parse(jsonData);

    let totalAmount = 0;
    let totalPurchaseAmount = 0;

    data.value.forEach(deal => {

        // Sum amount
        totalAmount += Number(deal.amount || 0);

        // Find "Գնման գումարը" item
        deal.dealInfoItems.forEach(item => {
            if (item.name === "Գնման գումարը") {
                totalPurchaseAmount += Math.abs(
                    Number(item.value || 0)
                );
            }
        });
    });

// Display values with 2 decimal places
    console.log("Total amount:", totalAmount.toFixed(2));
    console.log("Total purchase amount:", totalPurchaseAmount.toFixed(2));
    console.log(
        "Difference:",
        (totalAmount - totalPurchaseAmount).toFixed(2)
    );

// Calculate amount after 11% fee
    const amountAfterFee = totalAmount * (1 - 11 / 100);

    console.log(
        "Amount after 11% fee:",
        amountAfterFee.toFixed(2)
    );

    if (amountAfterFee > totalPurchaseAmount) {
        console.log("Go and Sell");
    } else {
        console.log("Please do not sell");
    }

    const profit = amountAfterFee - totalPurchaseAmount;

    try {

        if (profit > 0) {
            console.log(
                `PASS: Profit after selling is ${profit.toFixed(2)}`
            );
        } else {
            throw new Error(
                `FAIL: Loss after selling is ${Math.abs(profit).toFixed(2)}`
            );
        }

    } catch (error) {
        console.error("Exception:", error.message);
    }

}

checkSell();



