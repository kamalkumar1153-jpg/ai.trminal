async function loadSignal() {
  try {
    const res = await fetch(" https://ai-trminal-2.onrender.com/market_data");
    const d = await res.json();

    console.log("DATA:", d);

    if (!d || d.error) {
      document.getElementById('signal').innerText = "NO DATA";
      return;
    }

    document.getElementById('signal').innerText = d.signal;
    document.getElementById('price').innerText = d.price;
    document.getElementById('vwap').innerText = d.vwap;
    document.getElementById('rsi').innerText = d.rsi;

  } catch (e) {
    console.log("ERROR:", e);
    document.getElementById('signal').innerText = "SERVER OFF";
  }
}

setInterval(loadSignal, 5000);
loadSignal();
