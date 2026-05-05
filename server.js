const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());

// होम पेज पर मैसेज (ताकि "Cannot GET /" न दिखे)
app.get('/', (req, res) => {
    res.send('AI Pro Terminal API is Running...');
});

// मार्केट डेटा लाने का फंक्शन
async function fetchStock(symbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=1d`;
        const response = await axios.get(url);
        const data = response.data.chart.result[0];
        const price = data.meta.regularMarketPrice;
        const closeArr = data.indicators.quote[0].close;
        const lastClose = closeArr[closeArr.length - 1];
        const prevClose = closeArr[closeArr.length - 2];

        // स्मार्ट सिग्नल लॉजिक
        let score = lastClose > prevClose ? 80 : 40;
        let signal = score >= 70 ? "BULLISH" : "WAITING";

        return {
            price: price.toLocaleString('en-IN'),
            score: score,
            signal: signal,
            rsi: (Math.random() * (70 - 30) + 30).toFixed(1) // RSI सिमुलेशन
        };
    } catch (error) {
        return { price: "0.00", score: 0, signal: "ERR", rsi: "0" };
    }
}

// API Endpoint
app.get('/market_data', async (req, res) => {
    const nifty = await fetchStock('^NSEI');
    const sensex = await fetchStock('^BSESN');
    
    res.json({
        nifty,
        sensex,
        last_update: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is live on port ${PORT}`));


