const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Auth
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL
    });
} catch (e) { console.log("Firebase Setup Error"); }

const db = admin.database();
let history = []; // Price storage for indicators

// --- INDICATORS MATH LOGIC ---

function calculateRSI(prices, period = 14) {
    if (prices.length <= period) return "--";
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
        let diff = prices[prices.length - i] - prices[prices.length - i - 1];
        if (diff >= 0) gains += diff; else losses -= diff;
    }
    return (100 - (100 / (1 + (gains / (losses || 1))))).toFixed(2);
}

function calculateEMA(prices, period) {
    let k = 2 / (period + 1);
    let ema = prices[0];
    for (let i = 1; i < prices.length; i++) {
        ema = (prices[i] * k) + (ema * (1 - k));
    }
    return ema;
}

async function getMarketSignals(token) {
    try {
        const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.push(nifty);
        if (history.length > 100) history.shift();

        // 1. RSI
        const rsiVal = calculateRSI(history);

        // 2. MACD (Simplified EMA 12/26)
        let macdStatus = "--";
        if (history.length >= 26) {
            const ema12 = calculateEMA(history.slice(-12), 12);
            const ema26 = calculateEMA(history.slice(-26), 26);
            macdStatus = (ema12 > ema26) ? "BULLISH 📈" : "BEARISH 📉";
        }

        // 3. Ichimoku (9-period Conversion Line)
        let ichiStatus = "--";
        if (history.length >= 9) {
            const high9 = Math.max(...history.slice(-9));
            const low9 = Math.min(...history.slice(-9));
            const conversionLine = (high9 + low9) / 2;
            ichiStatus = (nifty > conversionLine) ? "ABOVE ☁️" : "BELOW ☁️";
        }

        // --- MASTER SIGNAL ---
        let finalSignal = "SCANNING...";
        if (rsiVal > 60 && macdStatus.includes("BULLISH") && ichiStatus.includes("ABOVE")) {
            finalSignal = "🚀 STRONG BUY (CONFIRMED)";
        } else if (rsiVal < 40 && macdStatus.includes("BEARISH") && ichiStatus.includes("BELOW")) {
            finalSignal = "🆘 STRONG SELL (CONFIRMED)";
        } else {
            finalSignal = rsiVal !== "--" ? "SIDEWAYS / WAITING" : "ANALYZING...";
        }

        await db.ref("market_data").update({
            nifty, sensex, rsi: rsiVal, macd: macdStatus, ichi: ichiStatus,
            signal: finalSignal, status: "Live ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });

    } catch (e) { console.log("Data Error"); }
}

app.get('/', (req, res) => res.send('Terminal Online 🚀'));
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

        setInterval(() => getMarketSignals(resp.data.access_token), 5000);
        res.send("<h1>Login Successful! Prices updating...</h1>");
    } catch (e) { res.send("Error: " + e.message); }
});

app.listen(port);














