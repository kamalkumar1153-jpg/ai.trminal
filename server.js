const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const port = process.env.PORT || 3000;

let marketData = {
    nifty: "Loading...",
    sensex: "Loading...",
    signal: "SCANNING",
    time: "--:--:--"
};

// Google Finance se Price nikalne ka function
async function getGooglePrice(ticker) {
    try {
        const url = `https://www.google.com/finance/quote/${ticker}`;
        const { data } = await axios.get(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const $ = cheerio.load(data);
        // Google Finance ki price class aksar 'ymv1yc' ya 'last_price' hoti hai
        const price = $(".YMl-qc.fxKbKc").first().text(); 
        return price.replace(',', '');
    } catch (e) {
        return "Error";
    }
}

// Data Update Function
async function updateAllPrices() {
    // NIFTY_50:INDEXNSE aur SENSEX:INDEXBOM tickers hain
    const n = await getGooglePrice("NIFTY_50:INDEXNSE");
    const s = await getGooglePrice("SENSEX:INDEXBOM");

    if(n !== "Error") marketData.nifty = n;
    if(s !== "Error") marketData.sensex = s;
    
    // Simple logic
    const niftyNum = parseFloat(marketData.nifty);
    marketData.signal = niftyNum > 24400 ? "🚀 BUY CALL" : "📉 SELL CALL";
    marketData.time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    console.log(`Google Update: Nifty ${marketData.nifty}`);
}

// Har 10 second mein fetch karega
setInterval(updateAllPrices, 10000);
updateAllPrices();

// Live Dashboard HTML
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>AI TERMINAL - GOOGLE DATA</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
            body { background: #0b111e; color: white; font-family: sans-serif; text-align: center; padding: 20px; }
            .card { background: #1a2332; margin: 15px auto; padding: 20px; border-radius: 15px; max-width: 400px; border-left: 5px solid #4285f4; }
            .price { font-size: 38px; font-weight: bold; color: #4285f4; }
            .label { color: #94a3b8; font-size: 14px; letter-spacing: 1px; }
            .signal { font-size: 26px; color: #f1c40f; margin-top: 10px; }
        </style>
        <script>setInterval(() => { location.reload(); }, 10000);</script>
    </head>
    <body>
        <h2 style="color: #4285f4;">📊 AI GOOGLE TERMINAL</h2>
        <div class="card">
            <div class="label">NIFTY 50</div>
            <div class="price">₹${marketData.nifty}</div>
        </div>
        <div class="card">
            <div class="label">SENSEX</div>
            <div class="price">₹${marketData.sensex}</div>
        </div>
        <div class="card" style="border-left-color: #f1c40f;">
            <div class="label">AI SIGNAL</div>
            <div class="signal">${marketData.signal}</div>
        </div>
        <p style="color: #64748b; font-size: 12px;">Data Source: Google Finance | Sync: ${marketData.time}</p>
    </body>
    </html>
    `);
});

app.listen(port, '0.0.0.0', () => console.log("Google Terminal is Live!"));














