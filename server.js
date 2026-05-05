const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());

// होम पेज - ताकि ब्राउज़र में 'Not Found' न दिखे
app.get('/', (req, res) => {
    res.send('AI Terminal Server is Active ✅. Use /market_data for JSON.');
});

// मुख्य डेटा एंडपॉइंट
app.get('/market_data', async (req, res) => {
    try {
        // Yahoo Finance से लाइव डेटा (Nifty & Sensex)
        const symbols = ['^NSEI', '^BSESN'];
        const results = {};

        for (let sym of symbols) {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=15m&range=1d`;
            const resp = await axios.get(url);
            const meta = resp.data.chart.result[0].meta;
            
            const key = sym === '^NSEI' ? 'nifty' : 'sensex';
            results[key] = {
                price: meta.regularMarketPrice.toLocaleString('en-IN'),
                score: Math.floor(Math.random() * (90 - 40) + 40), // डेमो स्कोर
                rsi: (Math.random() * (70 - 30) + 30).toFixed(1),
                signal: meta.regularMarketPrice > meta.chartPreviousClose ? "BULLISH" : "WAITING"
            };
        }
        
        results.last_update = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch market data" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));



