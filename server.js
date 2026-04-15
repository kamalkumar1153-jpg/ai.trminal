const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// --- 1. FIREBASE SETUP (DIRECT CONFIG) ---
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "ai-pro-terminal",
            clientEmail: "firebase-adminsdk-fbsvc@ai-pro-terminal.iam.gserviceaccount.com",
            // Ye Render ke Environment Variable se aayega
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : ""
        }),
        databaseURL: "https://ai-pro-terminal-default-rtdb.us-central1.firebasedatabase.app"
    });
}
const db = admin.database();
const ref = db.ref("market_data");

// --- 2. UPSTOX CREDENTIALS ---
const API_KEY = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; 
const API_SECRET = "13pgvjdvul"; 
const REDIRECT_URI = "https://ai-trminal-1.onrender.com/callback"; 

let accessToken = "";

app.get('/login', (req, res) => {
    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${REDIRECT_URI}`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const response = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code: code,
            client_id: API_KEY,
            client_secret: API_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }));
        accessToken = response.data.access_token;
        res.send("<h1>Login Successful!</h1><p>Terminal is now LIVE. You can close this tab.</p>");
        startFetching(); 
    } catch (e) {
        res.status(500).send("Login Failed: " + (e.response?.data?.errors[0]?.message || e.message));
    }
});

async function startFetching() {
    console.log("Data Fetching Started...");
    setInterval(async () => {
        if (!accessToken) return;
        try {
            const quoteUrl = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX';
            const response = await axios.get(quoteUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
            });

            const data = response.data.data;
            const payload = {
                nifty: data['NSE_INDEX:Nifty 50'].last_price,
                sensex: data['BSE_INDEX:SENSEX'].last_price,
                timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            };

            await ref.update(payload);
            console.log("Updated Firebase:", payload.nifty);
        } catch (error) {
            console.error("Fetch Error:", error.message);
        }
    }, 5000); 
}

app.get('/', (req, res) => res.send("AI Terminal Backend is Running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));








