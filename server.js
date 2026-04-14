const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// 1. FIREBASE CONNECTION
const serviceAccount = require("./serviceAccountKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://ai-pro-terminal-default-rtdb.firebaseio.com"
});
const db = admin.database();
const ref = db.ref("market_data");

// 2. UPSTOX CREDENTIALS (Apni details yahan dalein)
const API_KEY = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a";
const API_SECRET = " 13pgvjdvul";
const REDIRECT_URI = "https://ai-trminal-1.onrender.com/callback"; 

let accessToken = "";

// 3. ROUTES
app.get('/', (req, res) => {
    res.send("Server is Running! Please go to /login to start.");
});

app.get('/login', (req, res) => {
    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${REDIRECT_URI}`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const response = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code: code, client_id: API_KEY, client_secret: API_SECRET,
            redirect_uri: REDIRECT_URI, grant_type: 'authorization_code'
        }));
        accessToken = response.data.access_token;
        res.send("<h1>Login Successful!</h1> Terminal Live ho gaya hai.");
        startFetching();
    } catch (e) { res.send("Login Error: " + e.message); }
});

async function startFetching() {
    setInterval(async () => {
        if(!accessToken) return;
        try {
            const quotes = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            const nifty = quotes.data.data['NSE_INDEX:Nifty 50'].last_price;
            const sensex = quotes.data.data['BSE_INDEX:SENSEX'].last_price;
            
            await ref.set({
                nifty: nifty,
                sensex: sensex,
                timestamp: new Date().toLocaleTimeString()
            });
        } catch (e) { console.log("Fetch Error:", e.message); }
    }, 5000);
}

app.listen(process.env.PORT || 3000);




