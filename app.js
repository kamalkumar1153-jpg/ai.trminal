async function loadSignal() {

  // Demo data (taaki site chale)
  const price = 24000 + Math.random() * 100;
  const vwap = 24020;
  const rsi = 50 + Math.random() * 20 - 10;

  let signal = "WAIT";

  if (price > vwap && rsi > 55) signal = "BUY CE";
  else if (price < vwap && rsi < 45) signal = "BUY PE";

  document.getElementById('signal').innerText = signal;
  document.getElementById('price').innerText = price.toFixed(2);
  document.getElementById('vwap').innerText = vwap;
  document.getElementById('rsi').innerText = rsi.toFixed(2);
}

setInterval(loadSignal, 3000);
loadSignal();
