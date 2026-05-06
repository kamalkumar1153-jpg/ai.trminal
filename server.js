const express = require('express');
const yahooFinance = require('yahoo-finance2').default;
const path = require('path');

const app = express();

app.use(express.static('public'));

function calculateEMA(prices, period) {
  const k = 2 / (period + 1);
  let ema = prices[0];

  for (let i = 1; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return ema;
}

function calculateRSI(prices, period = 14) {
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }

  let rs = gains / losses;
  return 100 - (100 / (1 + rs));
}

async function getSignal(symbol) {
  const result = await yahooFinance.chart(symbol, {
    interval: '5m',
    range: '1d'
  });

  const prices = result.indicators.quote[0].close.filter(p => p);

  const lastPrice = prices[prices.length - 1];
  const ema9 = calculateEMA(prices.slice(-20), 9);
  const ema21 = calculateEMA(prices.slice(-30), 21);
  const rsi = calculateRSI(prices.slice(-15));

  let signal = "HOLD";

  if (lastPrice > ema9 && ema9 > ema21 && rsi > 55) {
    signal = "BUY";
  } else if (lastPrice < ema9 && ema9 < ema21 && rsi < 45) {
    signal = "SELL";
  }

  return {
    price: lastPrice.toFixed(2),
    ema9: ema9.toFixed(2),
    ema21: ema21.toFixed(2),
    rsi: rsi.toFixed(2),
    signal
  };
}

app.get('/signal', async (req, res) => {
  try {
    const nifty = await getSignal("^NSEI");
    const sensex = await getSignal("^BSESN");

    res.json({
      nifty,
      sensex,
      time: new Date()
    });

  } catch (e) {
    res.json({ error: "API Error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));




