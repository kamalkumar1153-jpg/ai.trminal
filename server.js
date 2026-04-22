const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// CRITICAL: Server crash hone se rokne ke liye
process.on('uncaughtException', (err) => {
    console.error('SERVER ERROR IGNORED:', err.message);
});

// Firebase Initialization
try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
        });
        console.log("Firebase Connected ✅");
    }
} catch (e) {
    console.error("Firebase Auth Error: Check your FIREBASE_SERVICE_ACCOUNT variable");
}

const db = admin.database();

// Live Market Sync Function
async function startMarketSync(token) {
    setInterval(async () => {
        try {
            const response = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX', {
                headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
            });

            const nifty = response.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = response.data.data['BSE_INDEX:SENSEX'].last_price;

            await db.ref("market_data").update({
                nifty: nifty,
                sensex: sensex,
                signal: nifty > 24400 ? "BUY NIFTY" : "SELL NIFTY",
                last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
            console.log(`Updated: Nifty ${nifty}`);
        } catch (err) {
            console.log("Sync Error: Token might be expired");
        }
    }, 5000); // Har 5 second mein update
}

// Routes
app.get('/', (req, res) => res.send('AI Terminal is Active 🚀'));

app.get('/login', (req, res) => {
    const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.API_KEY}&redirect_uri=${encodeURIComponent(process.env.REDIRECT_URI)}`;
    res.redirect(loginUrl);
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
        res.send("<h1>Login Successful! Prices are now syncing to Firebase.</h1>");
    } catch (e) {
        res.send("Login Error: Check Redirect URI in Upstox Portal.");
    }
});

// Port Binding (Important for Render)
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on port ${port}`);
});








