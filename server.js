const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const { RSI, MACD } = require('technicalindicators');

const app = express();
const port = process.env.PORT || 3000;

// --- FIREBASE INITIALIZATION ---
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: process.env.DATABASE_URL
    });
} catch (e) { console.error("Firebase Auth Error"); }

const db = admin.database();
let history = { nifty: [], sensex: [] };

async function getMarketData(token) {
    try {
        // Nifty & Sensex fetch
        const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nPrice = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sPrice = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.nifty.push(nPrice);
        if (history.nifty.length > 40) history.nifty.shift();

        // RSI Logic
        let rsiVal = 50;
        if (history.nifty.length > 14) {
            const rsis = RSI.calculate({ values: history.nifty, period: 14 });
            rsiVal = rsis[rsis.length - 1];
        }

        let signal = (rsiVal > 60) ? "🔥 STRONG BUY" : (rsiVal < 40) ? "❄️ STRONG SELL" : "⏳ SIDEWAYS";

        await db.ref("market_data").update({
            nifty: nPrice,
            sensex: sPrice,
            rsi: rsiVal.toFixed(2),
            signal: signal,
            status: "Live ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
    } catch (err) { console.log("Data Fetch Error"); }
}

app.get('/', (req, res) => res.send('Terminal Active'));
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
        setInterval(() => getMarketData(token), 5000);
        res.send("<h1>Terminal Started! Check Dashboard.</h1>");
    } catch (e) { res.send("Login Error: " + e.message); }
});

app.listen(port, () => console.log("Server Live"));

                                           












