const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

// --- APNA TOKEN YAHAN DALEIN ---
const ACCESS_TOKEN = ' eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIyRUNDRTMiLCJqdGkiOiI2OWQ5ZTY2MjIwMTk3ZjE2ZDM2ZmNhZTciLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaWF0IjoxNzc1ODg3OTcwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NzU5NDQ4MDB9.9BQsT1tqEXUgAmcwbC5Uew3WMAseQyAU0ixcfqHzzYM';

app.get('/market-data', async (req, res) => {
  try {
    // Nifty aur Sensex dono ke liye sahi instrument keys
    const url = 'https://api.upstox.com/v2/market-quote/quotes?instrument_key=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX';
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Accept': 'application/json'
      }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Upstox API Error', details: error.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Bridge active on port ${PORT}`);
});

