const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// --- FIREBASE INITIALIZATION ---
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "ai-pro-terminal",
            clientEmail: "firebase-adminsdk-fbsvc@ai-pro-terminal.iam.gserviceaccount.com",
            // Render ki private key ka fix
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : ""
        }),
        databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
    });
}

const db = admin.database();

// 🔥 YE LINE "NULL" KO KHATAM KAREGI (Connection Test)
db.ref("status").set("Server Connected at " + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));

const API_KEY = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; 
const API_SECRET = "13pgvjdvul"; 
const REDIRECT_URI = "https://ai-trminal-1.onrender.com/callback"; 

let accessToken = "";

// Home Page
app.get('/', (req, res) => {
    res.send("<h1>AI Pro Terminal Backend is LIVE</h1><p>Check Firebase for status update.</p>");
});

// Login Route
app.get('/login', (req, res) => {
    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${REDIRECT_URI}`;
    res.redirect(url);
});

// Callback Route
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
        res.send("<h1>Login Successful! Market data starting...</h1>");
        
        // Data Fetching Loop
        setInterval(async () => {
            if (!accessToken) return;
            try {
                const quoteUrl = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX';
                const resQuote = await axios.get(quoteUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
                });
                
                const d = resQuote.data.data;
                await db.ref("market_data").update({
                    nifty: d['NSE_INDEX:Nifty 50']?.last_price || "Market Closed",
                    sensex: d['BSE_INDEX:SENSEX']?.last_price || "Market Closed",
                    last_update: new Date().toLocaleTimeString('en-IN')
                });
            } catch (err) {
                console.log("Fetch Error: ", err.message);
            }
        }, 5000);

    } catch (e) {
        res.status(500).send("Login Failed: " + e.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});









