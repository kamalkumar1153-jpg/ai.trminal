const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

// --- APNA TOKEN YAHAN DALEIN ---
const ACCESS_TOKEN = 'eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIyRUNDRTMiLCJqdGkiOiI2OWQ4YWVkZTc2N2VlYTE5OWNiNTU0MTYiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaWF0IjoxNzc1ODA4MjIyLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NzU4NTg0MDB9.3RIwnyzdMoWXYqfeQbN42BKuy6XPdVEu1s3MMI7refA';

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

