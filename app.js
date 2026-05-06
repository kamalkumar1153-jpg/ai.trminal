async function loadSignal() {
  const res = await fetch("/signal");
  const data = await res.json();

  document.getElementById("nifty").innerText =
    `${data.nifty.signal} @ ${data.nifty.price}`;

  document.getElementById("sensex").innerText =
    `${data.sensex.signal} @ ${data.sensex.price}`;
}

setInterval(loadSignal, 5000);
loadSignal();
