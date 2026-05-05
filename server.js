const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

// 1. CORS को इनेबल करें ताकि GitHub वेबसाइट डेटा ले सके
app.use(cors());

// 2. होम रूट - यह चेक करने के लिए कि सर्वर चालू है या नहीं
app.get('/', (req, res) => {
    res.send('<h1>AI Terminal Server is Active ✅</h1><p>Use <b>/market_data</b> for JSON feed.</p>');
});

// 3. मार्केट डेटा एंडपॉइंट
app.get('/market_data', async (req, res) => {
    try {
        // Yahoo Finance API (Nifty 50 और Sensex के लिए)
        // हम User-Agent हेडर जोड़ रहे हैं ताकि Yahoo ब्लॉक न करे
        const config = {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        };

        const symbols = {
            nifty: '^NSEI',
            sensex: '^BSESN'
        };

        let results = {};

        for (let [name, sym] of Object.entries(symbols)) {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=15m&range=1d`;
            const resp = await axios.get(url, config);
            
            const meta = resp.data.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose;

            // टेक्निकल इंडिकेटर्स (डेमो कैलकुलेशन)
            results[name] = {
                price: price.toLocaleString('en-IN'),
                rsi: (Math.random() * (70 - 30) + 30).toFixed(1), // लाइव RSI के लिए TA-Lib चाहिए, अभी रैंडम है
                score: Math.floor(Math.random() * (85 - 45) + 45),
                signal: price > prevClose ? "BULLISH" : "BEARISH"
            };
        }

        results.last_update = new Date().toLocaleTimeString('en-IN', { 
            timeZone: 'Asia/Kolkata',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        res.json(results);

    } catch (err) {
        console.error("Fetch Error:", err.message);
        res.status(500).json({ error: "Market data fetch failed" });
    }
});

// 4. पोर्ट सेटिंग्स (Termux के लिए 8080 सबसे बेस्ट है)
const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`
🚀 AI PRO TERMINAL SERVER LIVE
------------------------------
Local:   http://localhost:${PORT}
Network: http://127.0.0.1:${PORT}
    `);
});




