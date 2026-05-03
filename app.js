async function loadSignal() {
  const res = await fetch("https://your-backend.onrender.com/signal");
  const data = await res.json();

  document.getElementById('signal').innerText = data.signal;
  document.getElementById('price').innerText = data.price.toFixed(2);
  document.getElementById('vwap').innerText = data.vwap.toFixed(2);
  document.getElementById('rsi').innerText = data.rsi.toFixed(2);
}

setInterval(loadSignal, 5000);
loadSignal();
