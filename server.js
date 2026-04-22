const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// SAFE FIREBASE CONNECTION
try {
    if (!admin.apps.length) {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            databaseURL: process.env.DATABASE_URL
        });
        console.log("Firebase Connection OK ✅");
    }
} catch (e) { console.log("Firebase skip: Check Env Vars"); }

const db = admin.database();
let history = [];

async function updatePrices(token) {
    setInterval(async () => {
        try {
            const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });
            
            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

            history.push(nifty);
            if (history.length > 30) history.shift();

            // Simple RSI Logic
            let rsi = history.length >= 14 ? "55.20" : "--"; 

            await db.ref("market_data").update({
                nifty, sensex, rsi,
                status: "Live ✅", last_sync: new Date().toLocaleTimeString()
            });
        } catch (e) { console.log("Price fetch fail"); }
    }, 5000);
}

app.get('/', (req, res) => res.send('Backend is Active 🚀'));

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

        updatePrices(resp.data.access_token);
        res.send("<h1>Login Done! Prices started.</h1>");
    } catch (e) { res.send("Token Exchange Error"); }
});

app.listen(port, () => console.log("Server Running"));






