const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Setup
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL
    });
} catch (e) { console.log("Firebase Error"); }

const db = admin.database();
let history = [];

// Asli RSI Calculation Logic (Bina library ke)
function calculateRSI(prices, period = 14) {
    if (prices.length <= period) return "--";
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = prices[prices.length - i] - prices[prices.length - i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let rs = gains / (losses || 1);
    return (100 - (100 / (1 + rs))).toFixed(2);
}

async function getPrices(token) {
    try {
        const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.push(nifty);
        if (history.length > 100) history.shift();

        const rsiVal = calculateRSI(history);
        let signal = "SCANNING...";
        
        if (rsiVal !== "--") {
            if (rsiVal > 60) signal = "🔥 BUY NIFTY (UPTREND)";
            else if (rsiVal < 40) signal = "❄️ SELL NIFTY (DOWNTREND)";
            else signal = "⏳ SIDEWAYS MARKET";
        }

        await db.ref("market_data").update({
            nifty: nifty,
            sensex: sensex,
            rsi: rsiVal,
            macd: rsiVal > 50 ? "BULLISH" : "BEARISH",
            ichi: nifty > 24400 ? "ABOVE" : "BELOW",
            signal: signal,
            status: "Live ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
    } catch (e) { console.log("Upstox Fetch Error"); }
}

app.get('/', (req, res) => res.send('AI Terminal Active'));
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

        const token = resp.data.access_token;
        setInterval(() => getPrices(token), 5000);
        res.send("<h1>Login Successful! Prices Starting...</h1>");
    } catch (e) { res.send("Error: " + e.message); }
});

app.listen(port, () => console.log("Server Running"));













