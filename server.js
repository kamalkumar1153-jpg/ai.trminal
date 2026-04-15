const express = require('express');
const axios = require('axios');
const admin = require('firebase-admin');

const app = express();

// --- 1. FIREBASE SETUP (BINA JSON FILE KE) ---
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: "ai-pro-terminal",
            clientEmail: "firebase-adminsdk-fbsvc@ai-pro-terminal.iam.gserviceaccount.com",
            // Ye key Render dashboard ke Environment Variables se aayegi
            privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : ""type": "service_account",
  "project_id": "ai-pro-terminal",
  "private_key_id": "f16f518d7b7087d1896dd448bc015c71c07919d3",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDDisiU4Cd6QhK2\nj+7zHv/j4LMXc0w1Zal0UY53uaQTBxNjfs3jEd88sDFu9dkmFBXSvZG6AV0ceeGv\nZ9xNZUFTaYlrMIkIPUHk8FDsaDE6MJJEYkdOCQr9kirMVqYYr8Ujy7usZHlAuD+n\no3Bb6FkXMdP2xNrNKoWgKlf4MwYDU+0LtbNVG/tVXIFG4YlwMXOlwXIesR/W2aA0\nBKzMZQ7eu/5gc88xncFjdv0lxjYQmBGUMH4zaupwgimk1/q557/16T6Yx2T6avIS\no02CdL4M5m2M/wazSX+IFhzEftrs/O5cUiNZwOm47T12p5d1XYILoVxHJapNlOwX\n52ENnlc3AgMBAAECggEALLQBKBvYmpgZXBgqqfUXzfpUJxPKQ9jSdQ+iENflXR48\nff4CxpsS3HZxTqswsgZceNmyw4HFThnFEQse76iq1w1lB5bIdRRACL0x2uH1AxcQ\nkUagg4QIubCdTSqv/SvN12GfrYkouTWGA+aW7MQA/g77pMobNVU3yEZ15v2PLdou\nbHSlvOWnRx2S8dIQUXPLvt0WCU/dIcVtyFliZ9NMYf+9a1KPO8bVUNBeUwXdYVPq\nGTBAilJ/zxf9OJ5yUBacVyVRc4UgclenS009uPJqCZ9hxdlcVey9XTGS02x6Gz8t\nnjGj5Ft3k9YesWFjIF7QBVjTqBRzl0JowjX2AlO6AQKBgQD7/GmdZy12aR6hXw/8\nYHFY0Cpc7LqYOq3miLDoMPv/PcjJ53vtG5zXTeOuSEAqFNzRZtgsyCpYTD0R3rRj\nBssXg+JcFYNjKRauayNU7XMB7EVqReyyhmtnoyG5p84l8rtMhTirudf97jHD8UuW\ngA9VYQwyotiCD9YMZsYXfKiGAQKBgQDGqDIIqTG1lLN2rfRjYxRuryGQF6Au/PLB\n85Vm3cwBiSVzE6dWARajb+0c5b0yClpAVnMJnqpGXptkVCJlzmIq4VFYuHsEmnQu\nAZ9gM1Zh1SrX+eouQVYE7erpjKuxBtgmfobUH31GzpuMQaKhjzA3CQF93P4uFMn9\nAq49UZuNNwKBgQDhrM/R3oQC1mZOU9r3RlB9IAGws3rxtyvjmWwGp0go8eaPnLeK\nRP6UfPd6MM72YTTafWcBxErYRX80L+YSAhWFe+IQYlwHRNdBYkaEWxxzDm2knfc8\nc9JhQOKFaVng9qD0CSQV+B0PGHKNb98obIxPBNltyBZrdU9YT/r9MfGkAQKBgBQj\nsQ7XuEZkUN1TPVdmEAg4kPp+qqqY0jN/ckH/clMliDpmX6yEZ7sh+bPYRpnwGr4z\nBW6QO0rvBGnjbalMhv854HlSGoaY8fZIC9RA4B0C81j56RfPX90YEZyjujQ0MW2V\nni2bE6Q+Bd7uOIKQdZ7ettv/r3UUfnW789Ybk915AoGBALQEg4kvYfY5ManSoz0U\n/EnLLSQhSSs0rxRel60p+JszOun7y1DqRs7nQq6dhx0/iIU5TywW8uunjCdup9oM\nnZhheA2UawIhTFkv++GulAh3z0IeX5ruMXIUBymttGtl/5p2tT8g5vFOpQGETmT9\nI3/BFWm4/OhfIQnNUV17ibwb\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@ai-pro-terminal.iam.gserviceaccount.com",
  "client_id": "109883802601035416713",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40ai-pro-terminal.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
} "
        }),
        databaseURL: https://ai-pro-terminal-default-rtdb.firebaseio.com/
    });
}
const db = admin.database();
const ref = db.ref("market_data");

// --- 2. UPSTOX CREDENTIALS ---
const API_KEY = "c6e93739-0e7f-4c2e-9a35-8e0e44ea015a"; 
const API_SECRET = "13pgvjdvul"; 
const REDIRECT_URI = "https://ai-trminal-1.onrender.com/callback"; 

let accessToken = "";

app.get('/login', (req, res) => {
    const url = `https://api.upstox.com/v2/login/authorization/dialog?response_type=code&client_id=${API_KEY}&redirect_uri=${REDIRECT_URI}`;
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    try {
        const response = await axios.post('https://api.upstox.com/v2/login/authorization/token', 
        new URLSearchParams({
            code: code,
            client_id: API_KEY,
            client_secret: API_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code'
        }));
        accessToken = response.data.access_token;
        res.send("<h1>Login Successful!</h1><p>Terminal is now LIVE. You can close this tab.</p>");
        startFetching(); 
    } catch (e) {
        res.status(500).send("Login Failed: " + (e.response?.data?.errors[0]?.message || e.message));
    }
});

async function startFetching() {
    console.log("Data Fetching Started...");
    setInterval(async () => {
        if (!accessToken) return;
        try {
            const quoteUrl = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty 50,BSE_INDEX|SENSEX';
            const response = await axios.get(quoteUrl, {
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Accept': 'application/json' }
            });

            const data = response.data.data;
            const payload = {
                nifty: data['NSE_INDEX:Nifty 50'].last_price,
                sensex: data['BSE_INDEX:SENSEX'].last_price,
                timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
            };

            await ref.update(payload);
            console.log("Updated Firebase:", payload.nifty);
        } catch (error) {
            console.error("Fetch Error:", error.message);
        }
    }, 5000); // 5 Seconds update
}

app.get('/', (req, res) => res.send("AI Terminal Backend is Running!"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server live on port ${PORT}`));







