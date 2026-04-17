const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const { MACD, RSI, IchimokuCloud } = require('technicalindicators');

const app = express();
const port = process.env.PORT || 3000;

// --- FIREBASE SETUP ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DATABASE_URL
});
const db = admin.database();

// Indicators ke liye data store
let history = { close: [], high: [], low: [] };

async function getMarketData(accessToken) {
    try {
        // 1. Get Live Data (LTP)
        const response = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050', {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
        });

        const niftyPrice = response.data.data['NSE_INDEX:Nifty 50'].last_price;
        
        // 2. Historical Data (Fake data logic for calculation - As Upstox Free has limits)
        // Note: Real trading mein hum yahan 100 candles fetch karte hain
        // Abhi hum calculations ko current price se update kar rahe hain
        updateHistory(niftyPrice);

        // 3. INDICATORS CALCULATION
        const rsiValue = RSI.calculate({ values: history.close, period: 14 }).pop() || 50;
        const macdData = MACD.calculate({ 
            values: history.close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 
        }).pop() || { MACD: 0, signal: 0 };
        
        const ichimoku = IchimokuCloud.calculate({
            high: history.high, low: history.low, conversionPeriod: 9, basePeriod: 26, spanPeriod: 52, displacement: 26
        }).pop();

        // 4. MASTER SIGNAL LOGIC (Confirmations)
        let finalSignal = "WAITING FOR CONFIRMATION...";
        
        const isBullish = rsiValue > 55 && macdData.MACD > macdData.signal && (ichimoku ? niftyPrice > ichimoku.spanA : true);
        const isBearish = rsiValue < 45 && macdData.MACD < macdData.signal && (ichimoku ? niftyPrice < ichimoku.spanA : true);

        if (isBullish) finalSignal = "🔥 STRONG BUY NIFTY (CONFIRMED)";
        else if (isBearish) finalSignal = "❄️ STRONG SELL NIFTY (CONFIRMED)";

        // 5. Update Firebase
        await db.ref("market_data").update({
            nifty: niftyPrice,
            signal: finalSignal,
            rsi: rsiValue.toFixed(2),
            last_sync: new Date().toLocaleTimeString()
        });

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

function updateHistory(price) {
    history.close.push(price);
    history.high.push(price + 2);
    history.low.push(price - 2);
    if (history.close.length > 100) {
        history.close.shift();
        history.high.shift();
        history.low.shift();
    }
}

// ... Baki ka Login aur Server setup purana wala rahega ...











