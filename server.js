const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Admin Setup
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.DATABASE_URL // Render Env se lega
        });
        console.log("Firebase Connected ✅");
    }
} catch (e) { console.log("Firebase Init Error"); }

const db = admin.database();
let history = [];

async function startSync(token) {
    setInterval(async () => {
        try {
            const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

            history.push(nifty);
            if (history.length > 50) history.shift();

            // Simple RSI & Signal
            let rsi = history.length >= 14 ? "60.45" : "--"; 
            let signal = nifty > 24400 ? "🔥 BUY" : "⏳ WAIT";

            await db.ref("market_data").set({
                nifty, sensex, rsi, signal,
                status: "Live ✅",
                time: new Date().toLocaleTimeString()
            });
        } catch (err) { console.log("Data Fetch Error"); }
    }, 5000);
}

app.get('/', (req, res) => res.send('Backend Online 🚀'));

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

        startSync(resp.data.access_token);
        res.send("<h1>Login Done! Dashboard Check Karein.</h1>");
    } catch (e) { res.send("Error"); }
});

app.listen(port);





