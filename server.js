const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Init
let db = null;
try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            databaseURL: process.env.DATABASE_URL
        });
    }
    db = admin.database();
} catch (e) {
    console.log("Firebase Init Skip");
}

// ====== INDICATORS ======

// RSI Calculation
function calculateRSI(data, period = 14) {
    if (data.length < period + 1) return null;

    let gains = 0, losses = 0;

    for (let i = data.length - period; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        if (diff >= 0) gains += diff;
        else losses -= diff;
    }

    let rs = gains / (losses || 1);
    return (100 - (100 / (1 + rs))).toFixed(2);
}

// EMA Calculation
function calculateEMA(data, period = 9) {
    if (data.length < period) return null;

    let k = 2 / (period + 1);
    let ema = data[0];

    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
    }

    return ema.toFixed(2);
}

// ====== MARKET DATA ======

let history = [];

async function updateMarketData(token) {
    setInterval(async () => {
        try {
            const res = await axios.get(
                'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX',
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Accept': 'application/json'
                    }
                }
            );

            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

            // Store history
            history.push(nifty);
            if (history.length > 50) history.shift();

            // Indicators
            let rsi = calculateRSI(history);
            let ema = calculateEMA(history);

            // Smart Signal Logic
            let signal = "⏳ SCANNING";

            if (rsi && ema) {
                if (rsi < 30 && nifty > ema) {
                    signal = "🚀 STRONG BUY";
                } else if (rsi > 70 && nifty < ema) {
                    signal = "🔻 STRONG SELL";
                } else if (nifty > ema) {
                    signal = "📈 BUY TREND";
                } else if (nifty < ema) {
                    signal = "📉 SELL TREND";
                }
            }

            // Firebase Update
            if (db) {
                await db.ref("market_data").update({
                    nifty,
                    sensex,
                    rsi: rsi || "--",
                    ema: ema || "--",
                    signal,
                    status: "Live ✅",
                    last_sync: new Date().toLocaleTimeString()
                });
            }

            console.log("Updated:", nifty, signal);

        } catch (e) {
            console.log("API Error:", e.message);
        }
    }, 5000);
}

// ====== ROUTES ======

app.get('/', (req, res) => {
    res.send('🚀 AI Trading Terminal Online!');
});

// Login
app.get('/login', (req, res) => {
    const url = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.API_KEY}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
    res.redirect(url);
});

// Callback
app.get('/callback', async (req, res) => {
    const { code } = req.query;

    try {
        const resp = await axios.post(
            'https://api.upstox.com/v2/login/authorization/token',
            new URLSearchParams({
                code,
                client_id: process.env.API_KEY,
                client_secret: process.env.API_SECRET,
                redirect_uri: process.env.REDIRECT_URI,
                grant_type: 'authorization_code'
            }).toString(),
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );

        updateMarketData(resp.data.access_token);

        res.send("<h1>✅ Login Successful! AI Terminal Live 🚀</h1>");

    } catch (e) {
        console.log("Token Error:", e.message);
        res.send("❌ Error during Token Exchange");
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});




