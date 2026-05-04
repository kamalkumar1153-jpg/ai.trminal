const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const TOKEN = process.env.UPSTOX_TOKEN;

// ===== CONFIG =====
const PAPER_MODE = true; // 🔒 keep true initially
const INSTRUMENT = "NSE_INDEX|Nifty 50";

// ===== INDICATORS =====
function RSI(closes) {
  let gain = 0, loss = 0;
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  const rs = gain / (loss || 1);
  return 100 - (100 / (1 + rs));
}

function VWAP(candles) {
  let pv = 0, vol = 0;
  candles.forEach(c => {
    const tp = (c.high + c.low + c.close) / 3;
    pv += tp * c.volume;
    vol += c.volume;
  });
  return pv / (vol || 1);
}

// ===== SENTIMENT (simple) =====
async function getSentiment() {
  try {
    const res = await axios.get("https://gnews.io/api/v4/search?q=nifty&token=demo"); // replace token
    let score = 0;
    res.data.articles.slice(0,5).forEach(a => {
      if (a.title.toLowerCase().includes("gain")) score += 0.2;
      if (a.title.toLowerCase().includes("fall")) score -= 0.2;
    });
    return Math.max(-1, Math.min(1, score));
  } catch {
    return 0;
  }
}

// ===== STRIKE =====
function getStrike(price) {
  const atm = Math.round(price / 50) * 50;
  return { CE: atm, PE: atm };
}

// ===== OI BIAS (mock if endpoint unavailable) =====
async function getOIBias() {
  // 👉 Replace with real option chain parsing if you have endpoint
  const r = Math.random();
  if (r > 0.6) return "BULLISH";
  if (r < 0.4) return "BEARISH";
  return "NEUTRAL";
}

// ===== SIGNAL =====
function getSignal(price, vwap, rsi, oiBias, sentiment) {
  let score = 0;

  if (price > vwap) score += 1; else score -= 1;
  if (rsi > 55) score += 1; else if (rsi < 45) score -= 1;

  if (oiBias === "BULLISH") score += 1;
  if (oiBias === "BEARISH") score -= 1;

  score += sentiment; // -1 to +1

  if (score >= 2) return { signal: "BUY CE", confidence: Math.min(90, 50 + score*10) };
  if (score <= -2) return { signal: "BUY PE", confidence: Math.min(90, 50 + Math.abs(score)*10) };
  return { signal: "WAIT", confidence: 40 };
}

// ===== ORDER (paper/live) =====
async function placeOrder(symbol, qty) {
  if (PAPER_MODE) {
    return { status: "PAPER_TRADE", symbol, qty };
  }

  // ⚠️ Enable only after testing
  return axios.post("https://api.upstox.com/v2/order/place", {
    quantity: qty,
    product: "MIS",
    validity: "DAY",
    order_type: "MARKET",
    transaction_type: "BUY",
    instrument_token: symbol
  }, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
}

// ===== MAIN API =====
app.get('/signal', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // LTP
    const ltpRes = await axios.get(
      `https://api.upstox.com/v2/market-quote/ltp?instrument_key=${INSTRUMENT}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );
    const price = ltpRes.data.data[INSTRUMENT].last_price;

    // Candles
    const candleRes = await axios.get(
      `https://api.upstox.com/v2/historical-candle/${INSTRUMENT}/1minute/${today}/${today}`,
      { headers: { Authorization: `Bearer ${TOKEN}` } }
    );

    const raw = candleRes.data.data.candles.slice(-20);
    const candles = raw.map(c => ({
      open: c[1], high: c[2], low: c[3], close: c[4], volume: c[5]
    }));

    const closes = candles.map(c => c.close);

    const rsi = RSI(closes);
    const vwap = VWAP(candles);
    const sentiment = await getSentiment();
    const oiBias = await getOIBias();

    const { signal, confidence } = getSignal(price, vwap, rsi, oiBias, sentiment);
    const strike = getStrike(price);

    res.json({
      price,
      rsi: Number(rsi.toFixed(2)),
      vwap: Number(vwap.toFixed(2)),
      sentiment,
      oiBias,
      signal,
      strike,
      confidence,
      paperMode: PAPER_MODE
    });

  } catch (err) {
    console.log(err.response?.data || err.message);
    res.json({ error: "API ERROR" });
  }
});

app.listen(PORT, () => console.log("🚀 PRO BOT RUNNING"));
