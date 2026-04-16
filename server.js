const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// --- SABSE ASAAN INITIALIZATION ---
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "ai-pro-terminal",
            clientEmail: "firebase-adminsdk-fbsvc@ai-pro-terminal.iam.gserviceaccount.com",
            // Ye line Render ki private key ko har haal mein fix kar degi
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        databaseURL: "https://ai-pro-terminal-default-rtdb.us-central1.firebasedatabase.app"
    });
}

const db = admin.database();
const ref = db.ref("market_data");

// ✅ Ye line check karegi ki connection hua ya nahi
ref.child("server_status").set("Online - " + new Date().toLocaleTimeString());

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
            code: code, client_id: API_KEY, client_secret: API_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code'
        }));
        accessToken = response.data.access_token;
        res.send("<h1>Login Successful! Market data starting...</h1>");
        
        // Data khichna shuru karein
        setInterval(async () => {
            try {
                const quoteUrl = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX';
                const resQuote = await axios.get(quoteUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
                });
                const d = resQuote.data.data;
                await ref.update({
                    nifty: d['NSE_INDEX:Nifty 50'].last_price,
                    sensex: d['BSE_INDEX:SENSEX'].last_price,
                    time: new Date().toLocaleTimeString('en-IN')
                });
            } catch (err) { console.log("Fetch Error: ", err.message); }
        }, 5000);

    } catch (e) { res.status(500).send("Login Failed"); }
});

app.listen(process.env.PORT || 3000);








