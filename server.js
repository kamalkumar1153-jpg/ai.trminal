const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// --- FIREBASE SETUP ---
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "ai-pro-terminal",
            clientEmail: "firebase-adminsdk-fbsvc@ai-pro-terminal.iam.gserviceaccount.com",
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : ""
        }),
        databaseURL: "https://ai-pro-terminal-default-rtdb.us-central1.firebasedatabase.app"
    });
}

const db = admin.database();

const API_KEY = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; 
const API_SECRET = "13pgvjdvul"; 
const REDIRECT_URI = "https://ai-trminal-1.onrender.com/callback"; 

let lastPrice15Min = 0;
let currentSignal = "WAITING...";

app.get('/', (req, res) => res.send("AI Pro Terminal Signal System LIVE"));

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
        
        const accessToken = response.data.access_token;
        res.send("<h1>Login Success! Signals Active.</h1>");
        
        // --- DATA & SIGNAL LOOP ---
        setInterval(async () => {
            try {
                const quoteUrl = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX';
                const resQuote = await axios.get(quoteUrl, {
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
                });
                
                const niftyPrice = resQuote.data.data['NSE_INDEX:Nifty 50'].last_price;
                const sensexPrice = resQuote.data.data['BSE_INDEX:SENSEX'].last_price;

                // --- 15 MIN SIGNAL LOGIC ---
                // Agar pichla price nahi hai, toh pehla price set karo
                if (lastPrice15Min === 0) lastPrice15Min = niftyPrice;

                if (niftyPrice > lastPrice15Min + 5) { // 5 point ka buffer
                    currentSignal = "BUY NIFTY (UPTREND)";
                } else if (niftyPrice < lastPrice15Min - 5) {
                    currentSignal = "SELL NIFTY (DOWNTREND)";
                }

                // Update Firebase
                await db.ref("market_data").update({
                    nifty: niftyPrice,
                    sensex: sensexPrice,
                    signal: currentSignal,
                    last_sync: new Date().toLocaleTimeString('en-IN')
                });

            } catch (err) { console.log("Loop Error: ", err.message); }
        }, 5000);

        // Har 15 minute mein 'lastPrice15Min' ko update karne ka timer
        setInterval(() => {
            db.ref("market_data/nifty").once('value', (snapshot) => {
                lastPrice15Min = snapshot.val();
                console.log("15 Min Reference Price Updated: ", lastPrice15Min);
            });
        }, 15 * 60 * 1000); // 15 Minutes

    } catch (e) { res.status(500).send("Login Failed"); }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));











