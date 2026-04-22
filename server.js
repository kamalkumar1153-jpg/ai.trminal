const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();
const port = process.env.PORT || 3000;

// SERVER CRASH PREVENTER: Koi bhi unexpected error aane par server ko band nahi hone dega
process.on('uncaughtException', (err) => {
    console.error('Handled Exception:', err.message);
});

// --- 1. FIREBASE INITIALIZATION (SABSE PEHLE) ---
try {
    if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
        });
        console.log("Firebase Connected Successfully ✅");
    }
} catch (error) {
    console.error("Firebase Auth Error: Please check your FIREBASE_SERVICE_ACCOUNT variable format.");
}

const db = admin.database();

// Live Market Data Sync Function
function startMarketSync(accessToken) {
    setInterval(async () => {
        try {
            const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
            const response = await axios.get(url, {
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json' 
                }
            });

            const niftyData = response.data.data['NSE_INDEX:Nifty 50'];
            const sensexData = response.data.data['BSE_INDEX:SENSEX'];

            // Firebase update
            await db.ref("market_data").update({
                nifty: niftyData.last_price,
                sensex: sensexData.last_price,
                signal: niftyData.last_price > 24400 ? "🔥 BUY NIFTY" : "❄️ SELL NIFTY",
                last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            });
            
            console.log(`Live Update: Nifty ${niftyData.last_price}`);
        } catch (err) {
            console.error("Sync Error: Check if token is valid.");
        }
    }, 5000); // 5 seconds interval
}

// --- 2. ROUTES ---

app.get('/', (req, res) => res.send('AI Terminal is Running 🚀'));

app.get('/login', (req, res) => {
    // Screenshot 1000424175 se aapki API Key
    const client_id = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; 
    const redirect_uri = encodeURIComponent("https://ai-trminal-1.onrender.com/callback");
    res.redirect(`https://api.upstox.com/v2/login/authorization/dialog?client_id=${client_id}&redirect_uri=${redirect_uri}`);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const response = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code: code,
            client_id: process.env.API_KEY,
            client_secret: process.env.API_SECRET,
            redirect_uri: process.env.REDIRECT_URI,
            grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        startMarketSync(response.data.access_token);
        res.send("<h1>Login Successful! Dashboard is now Live.</h1>");
    } catch (error) {
        res.status(500).send("Login Failed: Verify Redirect URI in Upstox Portal.");
    }
});

// --- 3. BIND TO PORT ---
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is active on port ${port}`);
});











