const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Global variables data store karne ke liye
let marketData = {
    nifty: "--",
    sensex: "--",
    signal: "WAITING",
    last_update: "--:--:--"
};

// Error handling taaki server band na ho
process.on('uncaughtException', (err) => console.log('Error:', err.message));

// 1. Dashboard Ka Design (HTML)
const dashboardHTML = () => `
<!DOCTYPE html>
<html>
<head>
    <title>AI TRADER LIVE</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { background: #0b111e; color: white; font-family: sans-serif; text-align: center; padding: 20px; }
        .card { background: #1a2332; margin: 15px auto; padding: 20px; border-radius: 12px; max-width: 400px; border-bottom: 4px solid #2ecc71; }
        .price { font-size: 35px; font-weight: bold; color: #2ecc71; }
        .label { color: #94a3b8; font-size: 14px; text-transform: uppercase; }
        .signal { font-size: 24px; color: #f1c40f; font-weight: bold; }
    </style>
    <script>
        // Har 5 second mein page refresh karega bina load huye
        setInterval(() => { location.reload(); }, 5000);
    </script>
</head>
<body>
    <h2>🤖 AI LIVE TERMINAL</h2>
    <div class="card">
        <div class="label">NIFTY 50</div>
        <div class="price">${marketData.nifty}</div>
    </div>
    <div class="card">
        <div class="label">SENSEX</div>
        <div class="price">${marketData.sensex}</div>
    </div>
    <div class="card" style="border-color: #3498db;">
        <div class="label">AI SIGNAL</div>
        <div class="signal">${marketData.signal}</div>
    </div>
    <p style="color: #64748b;">Last Sync: ${marketData.last_update}</p>
</body>
</html>
`;

// 2. Market Sync Function
function startSync(token) {
    setInterval(async () => {
        try {
            const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
            const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } });
            
            const n = res.data.data['NSE_INDEX:Nifty 50'].last_price;
            const s = res.data.data['BSE_INDEX:SENSEX'].last_price;

            marketData.nifty = n;
            marketData.sensex = s;
            marketData.signal = n > 24400 ? "🔥 BUY CALL" : "❄️ SELL CALL";
            marketData.last_update = new Date().toLocaleTimeString();
            console.log("Updated: " + n);
        } catch (err) { console.log("Sync Error"); }
    }, 5000);
}

// 3. Routes
app.get('/', (req, res) => res.send(dashboardHTML()));

app.get('/login', (req, res) => {
    const client_id = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; // Aapki API Key
    const redirect = encodeURIComponent("https://ai-trminal-1.onrender.com/callback");
    res.redirect(`https://api.upstox.com/v2/login/authorization/dialog?client_id=${client_id}&redirect_uri=${redirect}`);
});

app.get('/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const resp = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code, client_id: process.env.API_KEY, client_secret: process.env.API_SECRET,
            redirect_uri: process.env.REDIRECT_URI, grant_type: 'authorization_code'
        }).toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

        startSync(resp.data.access_token);
        res.send("<h1>Login Successful! Redirecting to Dashboard...</h1><script>setTimeout(()=>window.location.href='/', 2000)</script>");
    } catch (e) { res.send("Login Failed"); }
});

app.listen(port, '0.0.0.0', () => console.log("Server Active"));













