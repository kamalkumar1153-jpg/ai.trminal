const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// SERVER PROTECTOR: Ye line crash hone se bachati hai
process.on('uncaughtException', (err) => console.log('Handled:', err.message));

// --- STEP 1: FIREBASE INITIALIZATION (Order is Critical) ---
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
        });
        console.log("Firebase Connected ✅");
    }
} catch (error) {
    console.log("Firebase Init Error: Check your FIREBASE_SERVICE_ACCOUNT variable.");
}

const db = admin.database();

// --- STEP 2: ROUTES ---
app.get('/', (req, res) => res.send('AI Terminal Online 🚀'));

app.get('/login', (req, res) => {
    // Aapki Upstox API Key screenshot 1000424175 se
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

        startMarketSync(resp.data.access_token);
        res.send("<h1>Login Successful! Dashboard Syncing.</h1>");
    } catch (e) {
        res.send("Login Failed: Check Redirect URI.");
    }
});

function startMarketSync(token) {
    setInterval(async () => {
        try {
            const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
            const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
            
            const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            await db.ref("market_data").update({
                nifty: nifty,
                last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
            console.log("Syncing: " + nifty);
        } catch (err) { console.log("Sync failed"); }
    }, 5000);
}

// --- STEP 3: PORT BINDING ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
});












