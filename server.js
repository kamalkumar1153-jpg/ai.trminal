const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// SERVER CRASH PREVENTER
process.on('uncaughtException', (err) => console.log('Error Handled:', err.message));

// --- 1. SABSE PEHLE INITIALIZE KAREIN ---
try {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
        });
        console.log("Firebase Connected ✅");
    }
} catch (e) {
    console.log("CRITICAL ERROR: Firebase setup failed. Check your FIREBASE_SERVICE_ACCOUNT variable.");
}

// --- 2. AB DATABASE DEFINE KAREIN ---
const db = admin.database();

app.get('/', (req, res) => res.send('AI Terminal is Active 🚀'));

app.get('/login', (req, res) => {
    // Screenshot 1000424175 se aapki API Key
    const client_id = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a";
    const redirect = encodeURIComponent("https://ai-trminal-1.onrender.com/callback");
    res.redirect(`https://api.upstox.com/v2/login/authorization/dialog?client_id=${client_id}&redirect_uri=${redirect}`);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const resp = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code, 
            client_id: process.env.API_KEY, 
            client_secret: process.env.API_SECRET,
            redirect_uri: process.env.REDIRECT_URI, 
            grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        startSync(resp.data.access_token);
        res.send("<h1>Login Done! Prices are syncing.</h1>");
    } catch (e) {
        res.send("Login Failed: Upstox Portal mein Redirect URI check karein.");
    }
});

function startSync(token) {
    setInterval(async () => {
        try {
            const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

            // Database update tabhi hoga jab initialize ho chuka ho
            await db.ref("market_data").update({
                nifty: nifty,
                sensex: sensex,
                last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
            console.log(`Live: Nifty ${nifty}`);
        } catch (err) { console.log("Sync failed: Check token"); }
    }, 5000);
}

app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});










