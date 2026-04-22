const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// SERVER CRASH PREVENTER
process.on('uncaughtException', (err) => console.log('Error Handled:', err.message));

// FIREBASE SETUP (Safe Mode)
try {
    if (!admin.apps.length) {
        const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(sa),
            databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
        });
        console.log("Firebase Connected ✅");
    }
} catch (e) {
    console.log("Firebase Error: Variables check karein");
}

const db = admin.database();

// HOME ROUTE (Render ko 'Live' rakhne ke liye)
app.get('/', (req, res) => res.send('AI Terminal is Active 🚀'));

// LOGIN ROUTE
app.get('/login', (req, res) => {
    const client_id = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; // Screenshot se
    const redirect = encodeURIComponent("https://ai-trminal-1.onrender.com/callback");
    res.redirect(`https://api.upstox.com/v2/login/authorization/dialog?client_id=${client_id}&redirect_uri=${redirect}`);
});

// CALLBACK ROUTE
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

        // Token milte hi syncing shuru
        startSync(resp.data.access_token);
        res.send("<h1>Login Done! Dashboard Check Karein.</h1>");
    } catch (e) {
        res.send("Login Failed: Upstox Portal mein Redirect URI check karein.");
    }
});

// SYNC FUNCTION
function startSync(token) {
    setInterval(async () => {
        try {
            const res = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            await db.ref("market_data").update({
                nifty: nifty,
                last_sync: new Date().toLocaleTimeString()
            });
        } catch (err) { console.log("Sync Error"); }
    }, 5000);
}

// BIND TO PORT (Render ke liye sabse zaroori)
app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on port ${port}`);
});









