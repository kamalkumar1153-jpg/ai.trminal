const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');
const { MACD, RSI } = require('technicalindicators');

const app = express();
const port = process.env.PORT || 3000;

// --- FIREBASE SETUP ---
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.DATABASE_URL
});
const db = admin.database();

let history = { close: [] };

// --- 1. TOKEN RECOVERY SYSTEM ---
// Server start hote hi check karega ki kya koi purana token Firebase mein hai
async function autoStart() {
    console.log("Checking for saved token...");
    const snapshot = await db.ref("auth/token").once("value");
    const savedToken = snapshot.val();
    
    if (savedToken) {
        console.log("Token found! Starting automation...");
        setInterval(() => getMarketData(savedToken), 5000);
    } else {
        console.log("No token found. Please login via /login");
    }
}
autoStart();

async function getMarketData(accessToken) {
    try {
        const response = await axios.get('https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050', {
            headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
        });

        const niftyPrice = response.data.data['NSE_INDEX:Nifty 50'].last_price;
        history.close.push(niftyPrice);
        if (history.close.length > 50) history.close.shift();

        let signal = "ANALYZING...";
        let rsiVal = 50;

        if (history.close.length > 20) {
            const rsiArr = RSI.calculate({ values: history.close, period: 14 });
            rsiVal = rsiArr.length > 0 ? rsiArr[rsiArr.length - 1] : 50;
            
            const macdArr = MACD.calculate({ values: history.close, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
            const lastMACD = macdArr.length > 0 ? macdArr[macdArr.length - 1] : { MACD: 0, signal: 0 };

            if (rsiVal > 55 && lastMACD.MACD > lastMACD.signal) signal = "🔥 STRONG BUY";
            else if (rsiVal < 45 && lastMACD.MACD < lastMACD.signal) signal = "❄️ STRONG SELL";
            else signal = "⏳ SIDEWAYS (WAIT)";
        }

        await db.ref("market_data").update({
            nifty: niftyPrice,
            signal: signal,
            rsi: rsiVal.toFixed(2),
            status: "Connected ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
    } catch (error) {
        console.error("Token Expired or API Error");
        await db.ref("market_data/status").set("Login Expired ❌");
    }
}

// --- 2. LOGIN & TOKEN SAVING ---
app.get('/login', (req, res) => {
    const loginUrl = `https://api.upstox.com/v2/login/authorization/dialog?client_id=${process.env.API_KEY}&redirect_uri=${process.env.REDIRECT_URI}`;
    res.redirect(loginUrl);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const tokenResp = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code, client_id: process.env.API_KEY, client_secret: process.env.API_SECRET,
            redirect_uri: process.env.REDIRECT_URI, grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        const accessToken = tokenResp.data.access_token;
        
        // TOKEN KO FIREBASE ME SAVE KAREIN (Memory)
        await db.ref("auth/token").set(accessToken);
        
        setInterval(() => getMarketData(accessToken), 5000);
        res.send("<h1>Login Successful! Terminal Memory Updated.</h1>");
    } catch (err) {
        res.send("Login Failed: " + err.message);
    }
});

app.get('/', (req, res) => res.send('AI Pro Terminal is Running...'));
app.listen(port);












