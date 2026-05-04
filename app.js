async function loadSignal() {
  const res = await fetch("https://your-backend.onrender.com/signal");
  const d = await res.json();

  if (d.error) {
    document.getElementById('signal').innerText = "ERROR";
    return;
  }

  document.getElementById('signal').innerText = d.signal + " ("+d.confidence+"%)";
  document.getElementById('price').innerText = d.price;
  document.getElementById('vwap').innerText = d.vwap;
  document.getElementById('rsi').innerText = d.rsi;

  // optional extra UI
  console.log(d);
}

setInterval(loadSignal, 5000);
loadSignal();
