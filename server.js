const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase initialization with error handling
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL
    });
    console.log("Firebase initialized");
} catch (e) {
    console.error("Firebase Init Error: Check your Env Variables");
}

const db = admin.database();
let history = { nifty: [] };

// --- INDICATOR MATH ---
function calculateRSI(prices) {
    if (prices.length < 14) return "--";
    let gains = 0, losses = 0;
    for (let i = 1; i <= 14; i++) {
        let diff = prices[prices.length - i] - prices[prices.length - i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    let rs = gains / (losses || 1);
    return (100 - (100 / (1 + rs))).toFixed(2);
}

async function getMarketData(token) {
    try {
        const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nPrice = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sPrice = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.nifty.push(nPrice);
        if (history.nifty.length > 50) history.nifty.shift();

        const rsi = calculateRSI(history.nifty);
        
        // Simple MACD/ICHI logic without library
        let macd = (history.nifty.length > 26) ? (nPrice > history.nifty[history.nifty.length - 26] ? "BULLISH 📈" : "BEARISH 📉") : "--";
        let ichi = (nPrice > 24400) ? "ABOVE ☁️" : "BELOW ☁️";

        let signal = "SCANNING...";
        if (rsi !== "--") {
            if (rsi > 60 && macd.includes("BULLISH")) signal = "🚀 STRONG BUY (UPTREND)";
            else if (rsi < 40 && macd.includes("BEARISH")) signal = "🆘 STRONG SELL (DOWNTREND)";
            else signal = "⏳ SIDEWAYS MARKET";
        }

        await db.ref("market_data").update({
            nifty: nPrice,
            sensex: sPrice,
            rsi: rsi,
            macd: macd,
            ichi: ichi,
            signal: signal,
            status: "Connected ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
    } catch (err) { console.log("Fetch error"); }
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

        setInterval(() => getMarketData(resp.data.access_token), 5000);
        res.send("<h1>Login Successful! Check Dashboard.</h1>");
    } catch (e) { res.send("Error: " + e.message); }
});

app.listen(port, () => console.log("Server Live"));















