const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

// मार्केट डेटा लाने का फंक्शन (Yahoo Finance API का उपयोग)
async function getMarketData() {
    try {
        const symbols = ['^NSEI', '^BSESN', 'RELIANCE.NS', 'SBIN.NS'];
        let results = {};

        for (let sym of symbols) {
            // Yahoo Finance Query
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=15m&range=1d`;
            const resp = await axios.get(url);
            const quote = resp.data.chart.result[0].indicators.quote[0];
            const price = resp.data.chart.result[0].meta.regularMarketPrice;
            
            // सरल सिग्नल लॉजिक
            const closeArr = quote.close;
            const lastClose = closeArr[closeArr.length - 1];
            const prevClose = closeArr[closeArr.length - 2];
            
            let signal = lastClose > prevClose ? "STRONG BUY" : "WAIT";
            let score = lastClose > prevClose ? 85 : 45;

            results[sym.replace('^', '').replace('.NS', '')] = {
                price: price.toFixed(2),
                score: score,
                signal: signal,
                time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            };
        }
        return results;
    } catch (err) {
        return { error: "API limit or connection issue" };
    }
}

// API Endpoint
app.get('/market_data', async (req, res) => {
    const data = await getMarketData();
    res.json(data);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

