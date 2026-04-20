const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase initialization
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.DATABASE_URL
        });
    }
} catch (e) { console.log("Firebase bypass"); }

const db = admin.database();
let history = []; // Price data store karne ke liye

// RSI Calculation function
function calculateRSI(prices) {
    if (prices.length < 14) return "--";
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
        let diff = prices[prices.length - i] - prices[prices.length - i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    return (100 - (100 / (1 + (gains / (losses || 1))))).toFixed(2);
}

async function updateMarketData(token) {
    try {
        const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.push(nifty);
        if (history.length > 50) history.shift();

        const rsiVal = calculateRSI(history);
        const macdVal = rsiVal !== "--" ? (rsiVal > 50 ? "BULLISH 📈" : "BEARISH 📉") : "--";
        const ichiVal = nifty > 24400 ? "ABOVE ☁️" : "BELOW ☁️";

        let sig = "SCANNING...";
        if (rsiVal !== "--") {
            if (rsiVal > 60) sig = "🔥 BUY NIFTY (UPTREND)";
            else if (rsiVal < 40) sig = "❄️ SELL NIFTY (DOWNTREND)";
            else sig = "⏳ SIDEWAYS MARKET";
        }

        await db.ref("market_data").update({
            nifty, sensex, rsi: rsiVal, macd: macdVal, ichi: ichiVal, signal: sig,
            status: "Connected ✅", last_sync: new Date().toLocaleTimeString()
        });
    } catch (e) { console.log("Fetch Error"); }
}

app.get('/', (req, res) => res.send('AI Terminal is Online!'));

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

        setInterval(() => updateMarketData(resp.data.access_token), 5000);
        res.send("<h1>Terminal Active!</h1>");
    } catch (e) { res.send("Login Error: " + e.message); }
});

app.listen(port);



