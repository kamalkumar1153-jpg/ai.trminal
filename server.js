const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// Firebase Setup
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DATABASE_URL
});
const db = admin.database();

async function getPrices(token) {
    try {
        const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        await db.ref("market_data").update({
            nifty: nifty,
            sensex: sensex,
            status: "Live ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
    } catch (e) { console.log("Price fetch error"); }
}

app.get('/', (req, res) => res.send('Server is Running!'));

app.get('/login', (req, res) => {
    const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.API_KEY}&redirect_uri=${process.env.REDIRECT_URI}`;
    res.redirect(loginUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokenResp = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code, client_id: process.env.API_KEY, client_secret: process.env.API_SECRET,
            redirect_uri: process.env.REDIRECT_URI, grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const token = tokenResp.data.access_token;
        setInterval(() => getPrices(token), 5000);
        res.send("<h1>Terminal Active!</h1>");
    } catch (err) { res.send("Error: " + err.message); }
});

app.listen(port, () => console.log("Server Started"));


                                           












