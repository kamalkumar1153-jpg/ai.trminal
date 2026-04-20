const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// ===== Firebase =====
let db = null;
try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(sa),
        databaseURL: process.env.DATABASE_URL
    });
    db = admin.database();
} catch (e) {
    console.log("Firebase Skip");
}

// ===== INDICATORS =====

function calculateRSI(data, period = 14) {
    if (data.length < period + 1) return null;

    let gain = 0, loss = 0;

    for (let i = data.length - period; i < data.length; i++) {
        let diff = data[i] - data[i - 1];
        if (diff > 0) gain += diff;
        else loss -= diff;
    }

    let rs = gain / (loss || 1);
    return (100 - (100 / (1 + rs))).toFixed(2);
}

function calculateEMA(data, period = 9) {
    if (data.length < period) return null;

    let k = 2 / (period + 1);
    let ema = data[0];

    for (let i = 1; i < data.length; i++) {
        ema = data[i] * k + ema * (1 - k);
    }

    return ema;
}

function calculateMACD(data) {
    if (data.length < 26) return null;

    let ema12 = calculateEMA(data, 12);
    let ema26 = calculateEMA(data, 26);

    return (ema12 - ema26).toFixed(2);
}

// ===== AUTO TRADING ENGINE =====

let history = [];
let currentTrade = null;
let balance = 100000; // ₹1L

function executeTrade(price, signal) {

    // BUY
    if (signal.includes("BUY") && !currentTrade) {
        currentTrade = {
            type: "BUY",
            entry: price,
            qty: 1
        };
        console.log("BUY @", price);
    }

    // SELL
    else if (signal.includes("SELL") && currentTrade) {
        let pnl = (price - currentTrade.entry) * currentTrade.qty;
        balance += pnl;

        console.log("SELL @", price, "PnL:", pnl);

        if (db) {
            db.ref("trades").push({
                entry: currentTrade.entry,
                exit: price,
                pnl,
                time: new Date().toLocaleTimeString()
            });
        }

        currentTrade = null;
    }
}

// ===== MARKET LOOP =====

async function updateMarketData(token) {
    setInterval(async () => {
        try {
            const res = await axios.get(
                'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX',
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            );

            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

            history.push(nifty);
            if (history.length > 60) history.shift();

            let rsi = calculateRSI(history);
            let ema = calculateEMA(history);
            let macd = calculateMACD(history);

            // SIGNAL LOGIC
            let signal = "⏳ WAIT";

            if (rsi && ema && macd) {
                if (rsi < 30 && nifty > ema) {
                    signal = "🚀 BUY";
                } else if (rsi > 70 && nifty < ema) {
                    signal = "🔻 SELL";
                } else if (nifty > ema) {
                    signal = "📈 BUY TREND";
                } else {
                    signal = "📉 SELL TREND";
                }
            }

            // AUTO TRADE
            executeTrade(nifty, signal);

            // SAVE DATA
            if (db) {
                await db.ref("market_data").set({
                    nifty,
                    sensex,
                    rsi: rsi || "--",
                    ema: ema ? ema.toFixed(2) : "--",
                    macd: macd || "--",
                    signal,
                    balance,
                    status: "Auto Trading ON 🤖",
                    time: new Date().toLocaleTimeString()
                });
            }

            console.log("Updated:", nifty, signal);

        } catch (e) {
            console.log("API Error:", e.message);
        }
    }, 5000);
}

// ===== ROUTES =====

app.get('/', (req, res) => {
    res.send("🚀 AI AUTO TRADING RUNNING");
});

app.get('/login', (req, res) => {
    const url = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.API_KEY}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
    res.redirect(url);
});

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

        res.send("✅ Auto Trading Started");

    } catch (e) {




