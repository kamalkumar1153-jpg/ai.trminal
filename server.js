const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Setup (Try-Catch ke sath taaki error na aaye)
try {
    if (!admin.apps.length) {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            databaseURL: process.env.DATABASE_URL
        });
        console.log("Firebase OK ✅");
    }
} catch (e) { console.log("Firebase Error: Check Env Vars"); }

const db = admin.database();
let history = []; 

async function startTrading(token) {
    setInterval(async () => {
        try {
            const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
            const res = await axios.get(url, {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

            history.push(nifty);
            if (history.length > 50) history.shift();

            // Simple Indicators Math
            let rsi = history.length >= 14 ? "62.45" : "--"; // Example Logic
            let macd = nifty > 24400 ? "BULLISH 📈" : "BEARISH 📉";
            let ichi = nifty > 24420 ? "ABOVE ☁️" : "BELOW ☁️";
            let signal = rsi !== "--" ? "🔥 BUY NIFTY" : "SCANNING...";

            await db.ref("market_data").update({
                nifty, sensex, rsi, macd, ichi, signal,
                status: "Live ✅", last_sync: new Date().toLocaleTimeString()
            });
        } catch (err) { console.log("Fetch Error"); }
    }, 5000);
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

        startTrading(resp.data.access_token);
        res.send("<h1>Login Successful! Prices Started.</h1>");
    } catch (e) { res.send("Login Failed"); }
});

app.listen(port);


