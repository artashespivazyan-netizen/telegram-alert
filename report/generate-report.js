const fs = require("fs");

const data = JSON.parse(fs.readFileSync("./report_29.json", "utf8"));

const BUY_LABEL = "Գնման գումարը";
const SELL_LABEL = "Վաճառքի գումարը";

// Գործընկերների ID-ներ
const SAVINGS_MERCHANTS = {
    // Սուպերմարկետներ
    ZOVQ: 191529,
    EIGHTY_EIGHT: 210037,
    TITAN: 210196,
    PARMA: 191632,
    TSIRAN: 191530,
    KAISER: 191544,
    GURMENIA: 210140,
    EVRIKA: 191550,
    // Վայրեր
    TASHIR_PIZZA: 190911,
    ART_LUNCH: 191701,
    ERMIEL: 190541,
    CLEAN_HOUSE: 210123,
    PRIME_MEAT: 210124,
    // Բենզալցակայաններ
    ART_PETROL: 210386,
    VENLO: 191221,
    AVRA: 193399,
    GULF: 213644,
    RAN_OIL: 192387
};
const SAVINGS_IDS = new Set(Object.values(SAVINGS_MERCHANTS).map(String));

// Բենզալցակայանների ID-ներ
const PETROL_IDS = new Set([
    String(SAVINGS_MERCHANTS.RAN_OIL),
    String(SAVINGS_MERCHANTS.AVRA),
    String(SAVINGS_MERCHANTS.GULF),
    String(SAVINGS_MERCHANTS.VENLO),
    String(SAVINGS_MERCHANTS.ART_PETROL)
]);

// Բանալի բառեր ըստ կատեգորիաների
const SUPERMARKET_KEYWORDS = ["zovq", "88", "eighty", "titan", "parma", "tsiran", "kaiser", "gurmenia", "evrika", "eureka"];
const VAYRER_KEYWORDS = ["tashir", "art lunch", "ermiel", "clean house", "prime meat"];
const PETROL_KEYWORDS = ["ran oil", "avra", "gulf", "venlo", "art petrol"];

const matchesCategory = (name, keywords) => {
    const lower = String(name || "").toLowerCase();
    return keywords.some((kw) => lower.includes(kw));
};

const getMerchantId = (url) => {
    const m = /ServiceMemberImages\/(\d+)/.exec(url || "");
    return m ? m[1] : null;
};

const escapeHtml = (str) =>
    String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

const fmt = (n) => (typeof n === "number" && !isNaN(n) ? n.toFixed(2) : "0.00");
const fmtSigned = (n) => {
    if (typeof n !== "number" || isNaN(n)) return "0.00";
    return n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2);
};
const fmtPct = (n) => (typeof n === "number" && !isNaN(n) ? `${n.toFixed(2)}%` : "0.00%");

const TYPE_LABELS = {
    BUY: "ԳՆՈՒՄ",
    SELL: "ՎԱՃԱՌՔ"
};

const merchantStats = {};

for (const item of data.value) {
    const merchant = item.merchantName || "Անհայտ";

    if (!merchantStats[merchant]) {
        const merchantId = getMerchantId(item.merchantLogoUrl);

        const isSupermarket = matchesCategory(merchant, SUPERMARKET_KEYWORDS);
        const isVayrer = matchesCategory(merchant, VAYRER_KEYWORDS);
        const isPetrol = (merchantId !== null && PETROL_IDS.has(merchantId)) || matchesCategory(merchant, PETROL_KEYWORDS);

        const isTracked = (merchantId !== null && SAVINGS_IDS.has(merchantId)) || isSupermarket || isVayrer || isPetrol;

        let category = "other";
        if (isPetrol) {
            category = "petrol";
        } else if (isVayrer) {
            category = "vayrer";
        } else if (isSupermarket) {
            category = "supermarket";
        }

        merchantStats[merchant] = {
            merchantId,
            tracked: isTracked,
            category: category,
            totalBuy: 0,
            totalSell: 0,
            totalAmount: 0,
            totalSavings: 0,
            totalSellLoss: 0,
            buyCount: 0,
            sellCount: 0,
            transactions: []
        };
    }

    const stats = merchantStats[merchant];
    const infoItems = item.dealInfoItems || [];

    const buyItem = infoItems.find((x) => x.name === BUY_LABEL);
    const sellItem = infoItems.find((x) => x.name === SELL_LABEL);

    const isBuy = !!buyItem;
    const isSell = !!sellItem;

    const lotPrice = buyItem
        ? Math.abs(Number(buyItem.value))
        : sellItem
            ? Math.abs(Number(sellItem.value))
            : 0;

    const amount = Math.abs(Number(item.amount));

    let type = "";
    let diff = amount - lotPrice;
    let savings = 0;
    let savingsPct = amount > 0 ? (diff / amount) * 100 : 0;

    if (isBuy) {
        type = "BUY";
        savings = diff;
        stats.totalBuy += lotPrice;
        stats.totalAmount += amount;
        stats.buyCount++;
    } else if (isSell) {
        type = "SELL";
        const loss = amount - lotPrice;
        savings = -loss;
        stats.totalSell += lotPrice;
        stats.totalSellLoss += loss;
        stats.sellCount++;
    }

    stats.transactions.push({
        date: item.date,
        type,
        amount,
        lotPrice,
        savings,
        savingsPct,
        diff: diff
    });
}

// Ճշգրիտ հաշվարկ՝ Խնայողություն = Գումար - Լոտի Գին
for (const stats of Object.values(merchantStats)) {
    stats.totalSavings = stats.totalAmount - stats.totalBuy;
    stats.netSavings = stats.totalSavings - stats.totalSellLoss;
    stats.savingsPercent = stats.totalAmount > 0
        ? (stats.totalSavings / stats.totalAmount) * 100
        : 0;
}

// Բոլոր հետևվող գործընկերները
const allTrackedMerchants = Object.entries(merchantStats)
    .filter(([_, s]) => s.tracked && (s.buyCount > 0 || s.sellCount > 0 || s.transactions.length > 0))
    .sort((a, b) => b[1].netSavings - a[1].netSavings);

// Բաժանում 3 կատեգորիաների
const supermarketMerchants = allTrackedMerchants.filter(([_, s]) => s.category === "supermarket");
const petrolMerchants = allTrackedMerchants.filter(([_, s]) => s.category === "petrol");
const vayrerMerchants = allTrackedMerchants.filter(([_, s]) => s.category === "vayrer");

// Կատեգորիաների ընդհանուր զուտ խնայողությունները Tab-երի վրա
const supermarketTotalNet = supermarketMerchants.reduce((sum, [_, s]) => sum + s.netSavings, 0);
const petrolTotalNet = petrolMerchants.reduce((sum, [_, s]) => sum + s.netSavings, 0);
const vayrerTotalNet = vayrerMerchants.reduce((sum, [_, s]) => sum + s.netSavings, 0);

// ՏԵՍԱԿԱՎՈՐՈՒՄ. Առաջինը նրանք, ովքեր ունեն ՄԻԱՅՆ ՎԱՃԱՌՔՆԵՐ (sellCount > 0 && buyCount === 0)
const sortedMerchants = Object.entries(merchantStats)
    .sort((a, b) => {
        const aOnlySell = a[1].sellCount > 0 && a[1].buyCount === 0;
        const bOnlySell = b[1].sellCount > 0 && b[1].buyCount === 0;

        if (aOnlySell && !bOnlySell) return -1;
        if (!aOnlySell && bOnlySell) return 1;

        const aProfit = a[1].totalSell - a[1].totalBuy;
        const bProfit = b[1].totalSell - b[1].totalBuy;
        return bProfit - aProfit;
    });

const trackedStats = allTrackedMerchants.map(([_, s]) => s);

const totalBuy = Object.values(merchantStats).reduce((sum, m) => sum + m.totalBuy, 0);
const totalSell = Object.values(merchantStats).reduce((sum, m) => sum + m.totalSell, 0);

const dailyProgress = totalSell - totalBuy;

const totalBuySavings = trackedStats.reduce((sum, m) => sum + (m.totalAmount - m.totalBuy), 0);
const totalSellLoss = trackedStats.reduce((sum, m) => sum + m.totalSellLoss, 0);
const totalNetSavings = totalBuySavings - totalSellLoss;

const signClass = (n) => (n >= 0 ? "text-success" : "text-danger");

const renderSavingsTable = (merchantList) => {
    const statsList = merchantList.map(([_, s]) => s);
    const sumBuyCount = statsList.reduce((s, m) => s + m.buyCount, 0);
    const sumLotPrice = statsList.reduce((s, m) => s + m.totalBuy, 0);
    const sumAmount = statsList.reduce((s, m) => s + m.totalAmount, 0);
    const sumSavings = statsList.reduce((s, m) => s + (m.totalAmount - m.totalBuy), 0);
    const sumNet = statsList.reduce((s, m) => s + m.netSavings, 0);
    const avgSavingsPercent = sumAmount > 0 ? (sumSavings / sumAmount) * 100 : 0;

    let rowsHtml = merchantList.map(([merchant, stats], idx) => {
        const rowSavings = stats.totalAmount - stats.totalBuy;
        const rowPercent = stats.totalAmount > 0 ? (rowSavings / stats.totalAmount) * 100 : 0;
        const pctClamped = Math.min(Math.max(rowPercent, 0), 100);

        return `
        <tr>
            <td class="text-center row-id">${idx + 1}</td>
            <td>
                <div class="merchant-cell">
                    <span class="merchant-name">${escapeHtml(merchant)}</span>
                </div>
            </td>
            <td class="text-right font-medium">${stats.buyCount}</td>
            <td class="text-right font-mono">${fmt(stats.totalBuy)} <span class="currency">֏</span></td>
            <td class="text-right font-mono">${fmt(stats.totalAmount)} <span class="currency">֏</span></td>
            <td class="text-right font-mono font-bold">${fmt(rowSavings)} <span class="currency">֏</span></td>
            <td class="text-right font-mono font-bold ${signClass(stats.netSavings)}">
                ${fmt(stats.netSavings)} <span class="currency">֏</span>
            </td>
            <td class="text-right">
                <div class="percent-wrapper">
                    <span class="percent-text">${fmtPct(rowPercent)}</span>
                    <div class="mini-progress-bar">
                        <div class="mini-progress-fill" style="width: ${pctClamped}%;"></div>
                    </div>
                </div>
            </td>
        </tr>
        `;
    }).join("");

    return `
        <div class="table-responsive">
            <table class="compact-table">
                <thead>
                    <tr>
                        <th class="text-center" style="width: 36px;">#</th>
                        <th>Գործընկեր</th>
                        <th class="text-right">Գնումներ</th>
                        <th class="text-right">Լոտի Գին</th>
                        <th class="text-right">Գումար</th>
                        <th class="text-right">Խնայողություն</th>
                        <th class="text-right">Զուտ Խնայողություն</th>
                        <th class="text-right">Խնայողություն %</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml.length > 0 ? rowsHtml : `<tr><td colspan="8" class="text-center" style="padding: 16px; color: var(--text-subtle);">Գործարքներ չկան</td></tr>`}
                </tbody>
                <tfoot>
                    <tr class="table-total-row">
                        <td colspan="2">Ընդամենը</td>
                        <td class="text-right">${sumBuyCount}</td>
                        <td class="text-right font-mono">${fmt(sumLotPrice)} ֏</td>
                        <td class="text-right font-mono">${fmt(sumAmount)} ֏</td>
                        <td class="text-right font-mono">${fmt(sumSavings)} ֏</td>
                        <td class="text-right font-mono font-bold ${signClass(sumNet)}">${fmt(sumNet)} ֏</td>
                        <td class="text-right">${fmtPct(avgSavingsPercent)}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
    `;
};

let html = `<!DOCTYPE html>
<html lang="hy">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Օրական Հաշվետվություն</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">

<style>
:root {
    /* Soft Charcoal Black & Lavender-Violet Palette */
    --bg-page: #131217;
    --card-bg: #1c1a24;
    --card-bg-hover: #23202e;
    
    --text-main: #f3f0fb;
    --text-muted: #9d96b0;
    --text-subtle: #6c6680;
    
    --border-light: rgba(180, 160, 230, 0.08);
    --border-card: rgba(180, 160, 230, 0.14);
    
    --brand-violet: #9d7dfa;
    --brand-violet-hover: #b397ff;
    --brand-violet-soft: rgba(157, 125, 250, 0.12);
    --brand-violet-border: rgba(157, 125, 250, 0.28);

    --success: #34d399;
    --success-soft: rgba(52, 211, 153, 0.12);
    --danger: #fb7185;
    --danger-soft: rgba(251, 113, 133, 0.12);
    
    --radius-sm: 6px;
    --radius-md: 10px;
    --radius-lg: 14px;
    
    --shadow-soft: 0 4px 20px -2px rgba(0, 0, 0, 0.45);
    --shadow-hover: 0 8px 25px -2px rgba(157, 125, 250, 0.12);
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: var(--bg-page);
    background-image: 
        radial-gradient(at 0% 0%, rgba(157, 125, 250, 0.06) 0px, transparent 60%),
        radial-gradient(at 100% 100%, rgba(124, 58, 237, 0.04) 0px, transparent 60%);
    color: var(--text-main);
    padding: 24px 18px;
    line-height: 1.45;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
}

.dashboard-container {
    max-width: 1240px;
    margin: 0 auto;
}

/* Header */
.main-header {
    display: flex;
    justify-content: flex-start;
    align-items: center;
    margin-bottom: 20px;
}

.main-header .title-area h1 {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 8px;
}

/* KPI Overview Grid */
.kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
}

.kpi-card {
    background: var(--card-bg);
    border-radius: var(--radius-md);
    padding: 14px 16px;
    border: 1px solid var(--border-card);
    box-shadow: var(--shadow-soft);
    transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}

.kpi-card:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-hover);
    border-color: var(--brand-violet-border);
}

.kpi-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
}

.kpi-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted);
}

.kpi-icon-pill {
    width: 28px;
    height: 28px;
    border-radius: 7px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1px solid rgba(255, 255, 255, 0.05);
}

.kpi-icon-pill svg {
    width: 15px;
    height: 15px;
}

.icon-blue { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.icon-purple { background: var(--brand-violet-soft); color: var(--brand-violet); }
.icon-emerald { background: var(--success-soft); color: var(--success); }
.icon-cyan { background: rgba(14, 165, 233, 0.15); color: #38bdf8; }

.kpi-value {
    font-size: 20px;
    font-weight: 800;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: -0.02em;
}

/* Dashboard Main Panel */
.dashboard-card {
    background: var(--card-bg);
    border-radius: var(--radius-lg);
    border: 1px solid var(--border-card);
    box-shadow: var(--shadow-soft);
    margin-bottom: 20px;
    overflow: hidden;
}

.card-header-styled {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border-light);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
    background: #181620;
}

.card-header-styled h2 {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 6px;
}

.tabs-control {
    display: flex;
    background: #111016;
    border: 1px solid var(--border-light);
    padding: 3px;
    border-radius: 8px;
    gap: 3px;
    flex-wrap: wrap;
}

.tab-btn {
    border: none;
    background: transparent;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.tab-btn:hover {
    color: var(--text-main);
}

.tab-val {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    font-weight: 700;
    color: var(--success);
}

.tab-btn.active {
    background: var(--brand-violet);
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(157, 125, 250, 0.35);
}

.tab-btn.active .tab-val {
    color: #e0e7ff;
}

.tab-pane {
    display: none;
}

.tab-pane.active {
    display: block;
}

/* Compact Table Layout */
.compact-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    text-align: left;
}

.compact-table th {
    background: #16141d;
    color: var(--text-muted);
    font-size: 11px;
    font-weight: 600;
    padding: 9px 12px;
    border-bottom: 1px solid var(--border-light);
    white-space: nowrap;
}

.compact-table td {
    padding: 10px 12px;
    border-bottom: 1px solid var(--border-light);
    font-size: 13px;
    color: var(--text-main);
    white-space: nowrap;
}

.compact-table tbody tr {
    transition: background-color 0.12s ease;
}

.compact-table tbody tr:hover {
    background-color: var(--card-bg-hover);
}

.compact-table .row-id {
    color: var(--text-subtle);
    font-weight: 600;
    font-size: 11px;
}

.merchant-cell {
    display: flex;
    align-items: center;
    gap: 8px;
}

.merchant-name {
    font-size: 14px;
    font-weight: 800;
    color: var(--text-main);
    letter-spacing: -0.01em;
}

.font-mono {
    font-family: 'JetBrains Mono', monospace;
}

.font-medium { font-weight: 600; }
.font-bold { font-weight: 700; }

.currency {
    color: var(--text-muted);
    font-size: 11px;
    margin-left: 2px;
}

.percent-wrapper {
    display: inline-flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    width: 75px;
}

.percent-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    color: var(--text-main);
}

.mini-progress-bar {
    width: 100%;
    height: 3px;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 3px;
    overflow: hidden;
}

.mini-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--brand-violet), var(--success));
    border-radius: 3px;
}

.table-total-row td {
    background: #14131a;
    border-top: 1.5px solid var(--brand-violet-border);
    font-weight: 800;
    font-size: 13px;
    padding: 12px 14px;
}

.section-subtitle {
    font-size: 15px;
    font-weight: 700;
    margin: 24px 0 12px 2px;
    color: var(--text-main);
    display: flex;
    align-items: center;
    gap: 6px;
}

/* 2 CARDS PER LINE (GRID) */
.cards-2col-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    align-items: start;
}

.accordion-item {
    background: var(--card-bg);
    border: 1px solid var(--border-card);
    border-radius: var(--radius-md);
    overflow: hidden;
    box-shadow: var(--shadow-soft);
    transition: border-color 0.15s ease;
}

.accordion-item:hover {
    border-color: var(--brand-violet-border);
}

.accordion-summary {
    padding: 11px 15px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    user-select: none;
    list-style: none;
    background: var(--card-bg);
    transition: background 0.15s ease;
}

.accordion-summary:hover {
    background: var(--card-bg-hover);
}

.accordion-summary::-webkit-details-marker {
    display: none;
}

.accordion-title {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.merchant-name-text {
    font-size: 14.5px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.015em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.badge-tag {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
}

.badge-tag-buy { background: var(--danger-soft); color: var(--danger); border: 1px solid rgba(251, 113, 133, 0.2); }
.badge-tag-sell { background: var(--success-soft); color: var(--success); border: 1px solid rgba(52, 211, 153, 0.2); }

.summary-right-zone {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
}

.result-block {
    width: 185px;
    text-align: left;
    display: inline-block;
    white-space: nowrap;
    font-size: 12.5px;
}

.chevron-icon {
    width: 15px;
    height: 15px;
    color: var(--brand-violet);
    transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
}

.accordion-item[open] .chevron-icon {
    transform: rotate(180deg);
}

.accordion-content {
    border-top: 1px solid var(--border-light);
    background: #14131a;
    overflow-x: auto;
}

/* Card Tables: compact and strictly no-wrap */
.card-table th {
    padding: 8px 10px;
    font-size: 10.5px;
    white-space: nowrap;
}

.card-table td {
    padding: 9px 10px;
    font-size: 12.5px;
    white-space: nowrap;
}

.status-pill {
    display: inline-flex;
    padding: 2px 5px;
    border-radius: 4px;
    font-size: 9px;
    font-weight: 700;
    white-space: nowrap;
}

.pill-buy { background: var(--danger-soft); color: var(--danger); }
.pill-sell { background: var(--success-soft); color: var(--success); }

.text-success { color: var(--success) !important; }
.text-danger { color: var(--danger) !important; }
.text-right { text-align: right; }
.text-center { text-align: center; }

@media (max-width: 1100px) {
    .cards-2col-grid { grid-template-columns: 1fr; }
    .result-block { width: auto; }
}

@media (max-width: 850px) {
    .kpi-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 520px) {
    .kpi-grid { grid-template-columns: 1fr; }
}
</style>
</head>
<body>

<div class="dashboard-container">
    <header class="main-header">
        <div class="title-area">
            <h1>
                <span>📊</span> Օրական Հաշվետվություն
            </h1>
        </div>
    </header>

    <!-- KPI Grid -->
    <section class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Ընդհանուր Գնումներ</span>
                <div class="kpi-icon-pill icon-blue">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                    </svg>
                </div>
            </div>
            <div class="kpi-value text-danger">${fmt(totalBuy)} <span class="currency">֏</span></div>
        </div>

        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Ընդհանուր Վաճառքներ</span>
                <div class="kpi-icon-pill icon-purple">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                </div>
            </div>
            <div class="kpi-value text-success">${fmt(totalSell)} <span class="currency">֏</span></div>
        </div>

        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Օրական Շարժ</span>
                <div class="kpi-icon-pill icon-emerald">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"/>
                    </svg>
                </div>
            </div>
            <div class="kpi-value ${signClass(dailyProgress)}">${fmtSigned(dailyProgress)} <span class="currency">֏</span></div>
        </div>

        <div class="kpi-card">
            <div class="kpi-header">
                <span class="kpi-label">Զուտ Խնայողություն</span>
                <div class="kpi-icon-pill icon-cyan">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
            </div>
            <div class="kpi-value ${signClass(totalNetSavings)}">${fmt(totalNetSavings)} <span class="currency">֏</span></div>
        </div>
    </section>

    <!-- Խնայողությունների հատված -->
    <div class="dashboard-card">
        <div class="card-header-styled">
            <h2>💰 Խնայողություն</h2>
            <div class="tabs-control">
                <button class="tab-btn active" onclick="openTab(event, 'tab-supermarkets')">
                    <span>🛒 Սուպերմարկետներ</span>
                    <span class="tab-val">= ${fmt(supermarketTotalNet)} ֏</span>
                </button>
                <button class="tab-btn" onclick="openTab(event, 'tab-petrol')">
                    <span>⛽ Բենզալցակայաններ</span>
                    <span class="tab-val">= ${fmt(petrolTotalNet)} ֏</span>
                </button>
                <button class="tab-btn" onclick="openTab(event, 'tab-vayrer')">
                    <span>📍 Վայրեր</span>
                    <span class="tab-val">= ${fmt(vayrerTotalNet)} ֏</span>
                </button>
            </div>
        </div>

        <!-- 1. Սուպերմարկետներ -->
        <div id="tab-supermarkets" class="tab-pane active">
            ${renderSavingsTable(supermarketMerchants)}
        </div>

        <!-- 2. Բենզալցակայաններ -->
        <div id="tab-petrol" class="tab-pane">
            ${renderSavingsTable(petrolMerchants)}
        </div>

        <!-- 3. Վայրեր -->
        <div id="tab-vayrer" class="tab-pane">
            ${renderSavingsTable(vayrerMerchants)}
        </div>
    </div>

    <!-- Այլ Գործարքներ (2 քարտ մեկ տողում, առանց # սյունակի և առանց ֏ նշանի) -->
    <h3 class="section-subtitle">🏢 Այլ Գործարքներ</h3>
    <div class="cards-2col-grid">
`;

for (const [merchant, stats] of sortedMerchants) {
    if (stats.tracked) continue;

    const profit = stats.totalSell - stats.totalBuy;

    html += `
        <details class="accordion-item">
            <summary class="accordion-summary">
                <div class="accordion-title">
                    <span class="merchant-name-text">${escapeHtml(merchant)}</span>
                    ${stats.buyCount > 0 ? `<span class="badge-tag badge-tag-buy">Գնումներ՝ ${stats.buyCount}</span>` : ""}
                    ${stats.sellCount > 0 ? `<span class="badge-tag badge-tag-sell">Վաճառքներ՝ ${stats.sellCount}</span>` : ""}
                </div>
                
                <div class="summary-right-zone">
                    <span class="result-block font-mono font-bold ${signClass(profit)}">
                        Արդյունք՝ ${fmtSigned(profit)} ֏
                    </span>
                    <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"/>
                    </svg>
                </div>
            </summary>

            <div class="accordion-content">
                <table class="compact-table card-table">
                    <thead>
                        <tr>
                            <th>Ամսաթիվ</th>
                            <th>Տեսակ</th>
                            <th class="text-right">Գումար</th>
                            <th class="text-right">Լոտի Գին</th>
                            <th class="text-right">Տարբերություն</th>
                            <th class="text-right">Խնայողություն %</th>
                        </tr>
                    </thead>
                    <tbody>
    `;

    stats.transactions.forEach((trx) => {
        const badgeClass = trx.type === "BUY" ? "pill-buy" : "pill-sell";
        html += `
                        <tr>
                            <td style="color: var(--text-muted); font-size: 11px;">
                                ${new Date(trx.date).toLocaleString("hy-AM")}
                            </td>
                            <td><span class="status-pill ${badgeClass}">${TYPE_LABELS[trx.type] || trx.type}</span></td>
                            <td class="text-right font-mono font-medium">${fmt(trx.amount)}</td>
                            <td class="text-right font-mono font-medium">${fmt(trx.lotPrice)}</td>
                            <td class="text-right font-mono font-bold ${signClass(trx.diff)}">${fmtSigned(trx.diff)}</td>
                            <td class="text-right font-mono font-bold ${signClass(trx.diff)}">${fmtPct(trx.savingsPct)}</td>
                        </tr>
        `;
    });

    html += `
                    </tbody>
                </table>
            </div>
        </details>
    `;
}

html += `
    </div>
</div>

<script>
function openTab(evt, tabId) {
    const tabPanes = document.querySelectorAll('.tab-pane');
    tabPanes.forEach(pane => pane.classList.remove('active'));

    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    evt.currentTarget.classList.add('active');
}
</script>

</body>
</html>
`;

fs.writeFileSync("bonus-report.html", html);
console.log("✅ bonus-report.html generated successfully with clean right-aligned numbers and no wrapping");