const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send("Server running");
});

app.get('/signal', (req, res) => {
  res.json({
    price: 24000,
    vwap: 24020,
    rsi: 55,
    signal: "BUY CE"
  });
});

app.listen(PORT, () => console.log("Server started"));
