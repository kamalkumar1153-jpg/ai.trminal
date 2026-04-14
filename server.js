const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase Setup
const serviceAccount = require("./var admin = require("firebase-admin");

var serviceAccount = require("path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
});
 "); 
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
});

const db = admin.database();
const ref = db.ref("market_data");

// RSI Calculation Function
function calculateRSI(closes) {
    let changes = [];
    for (let i = 1; i < closes.length; i++) {
        changes.push(closes[i] - closes[i - 1]);
    }
    let gains = changes.map(ch => ch > 0 ? ch : 0);
    let losses = changes.map(ch => ch < 0 ? Math.abs(ch) : 0);
    
    let avgGain = gains.slice(0, 14).reduce((a, b) => a + b) / 14;
    let avgLoss = losses.slice(0, 14).reduce((a, b) => a + b) / 14;

    for (let i = 14; i < gains.length; i++) {
        avgGain = (avgGain * 13 + gains[i]) / 14;
        avgLoss = (avgLoss * 13 + losses[i]) / 14;
    }
    
    let rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

async function updateMarketLogic(token) {
    try {
        // 1. Fetch 15m Candles (Minimum 30 candles for accurate RSI)
        const candleRes = await axios.get('https://api.upstox.com/v2/historical-candle/intraday/NSE_INDEX%7CNifty%2050/15minute', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const quotes = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const candles = candleRes.data.data.candles; // [ts, o, h, l, c, v]
        const closePrices = candles.map(c => c[4]).reverse(); 
        const latestCandle = candles[0];

        const rsi = calculateRSI(closePrices);
        const niftyLTP = quotes.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensexLTP = quotes.data.data['BSE_INDEX:SENSEX']?.last_price || 0;

        const payload = {
            nifty: niftyLTP,
            sensex: sensexLTP,
            rsi15m: rsi,
            high15m: latestCandle[2],
            low15m: latestCandle[3],
            close15m: latestCandle[4],
            timestamp: new Date().toLocaleTimeString()
        };

        await ref.set(payload);
        return payload;
    } catch (e) { console.log("Error:", e.message); return null; }
}

app.get('/market-data', async (req, res) => {
    const data = await updateMarketLogic(req.query.token);
    res.json(data);
});

app.listen(process.env.PORT || 3000);


