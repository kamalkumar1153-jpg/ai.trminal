const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Setup
try {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.DATABASE_URL
        });
        console.log("Firebase Connected ✅");
    }
} catch (e) { console.log("Firebase Error: Check Env Variables"); }

const db = admin.database();
let history = []; 

// Indicators Calculation
function getIndicators(prices) {
    if (prices.length < 14) return { rsi: "--", macd: "--", ichi: "--" };

    // RSI
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
        let diff = prices[prices.length - i] - prices[prices.length - i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    const rsiVal = (100 - (100 / (1 + (gains / (losses || 1))))).toFixed(2);

    // MACD & Ichimoku (Simplified)
    const macdVal = rsiVal > 50 ? "BULLISH 📈" : "BEARISH 📉";
    const lastPrice = prices[prices.length - 1];
    const ichiVal = lastPrice > 24400 ? "ABOVE ☁️" : "BELOW ☁️";

    return { rsi: rsiVal, macd: macdVal, ichi: ichiVal };
}

async function updateMarket(token) {
    try {
        const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.push(nifty);
        if (history.length > 50) history.shift();

        const ind = getIndicators(history);
        let sig = "SCANNING...";
        if (ind.rsi !== "--") {
            sig = ind.rsi > 60 ? "🔥 BUY NIFTY (UPTREND)" : ind.rsi < 40 ? "❄️ SELL NIFTY (DOWNTREND)" : "⏳ SIDEWAYS";
        }

        if (admin.apps.length) {
            await db.ref("market_data").update({
                nifty, sensex, rsi: ind.rsi, macd: ind.macd, ichi: ind.ichi,
                signal: sig, status: "Live ✅", last_sync: new Date().toLocaleTimeString()
            });
        }
    } catch (e) { console.log("Upstox Error"); }
}

app.get('/', (req, res) => res.send('AI Terminal Online!'));

app.get('/login', (req, res) => {
    res.redirect(`https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.API_KEY}&redirect_uri=${process.env.REDIRECT_URI}`);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const resp = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code, client_id: process.env.API_KEY, client_secret: process.env.API_SECRET,
            redirect_uri: process.env.REDIRECT_URI, grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        setInterval(() => updateMarket(resp.data.access_token), 5000);
        res.send("<h1>Login Done!</h1>");
    } catch (e) { res.send("Error"); }
});

app.listen(port);

