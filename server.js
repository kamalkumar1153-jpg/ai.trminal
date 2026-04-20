const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// --- FIREBASE INITIALIZATION (SAFE MODE) ---
let db = null;
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.DATABASE_URL
        });
        db = admin.database();
        console.log("Firebase Connected ✅");
    }
} catch (e) {
    console.log("Firebase not connected, but server will continue... ⚠️");
}

let history = [];

async function getPrices(token) {
    try {
        const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nPrice = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sPrice = res.data.data['BSE_INDEX:SENSEX'].last_price;

        history.push(nPrice);
        if (history.length > 50) history.shift();

        // Agar Firebase connected hai, toh hi update karein
        if (db) {
            await db.ref("market_data").update({
                nifty: nPrice,
                sensex: sPrice,
                status: "Live ✅",
                last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
        }
        console.log(`Nifty: ${nPrice} | Sensex: ${sPrice}`);
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

        setInterval(() => getPrices(resp.data.access_token), 5000);
        res.send("<h1>Login Success! Dashboard check karein.</h1>");
    } catch (e) { res.send("Error: " + e.message); }
});

app.listen(port, () => console.log("Server Live 🚀"));
















