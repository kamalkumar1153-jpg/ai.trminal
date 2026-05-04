const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

// Home route
app.get('/', (req, res) => {
  res.send("Server running");
});

// 🔥 IMPORTANT: Signal route
app.get('/signal', (req, res) => {
  res.json({
    price: 24100,
    vwap: 24080,
    rsi: 56,
    signal: "BUY CE"
  });
});

app.listen(PORT, () => console.log("Server started"));
