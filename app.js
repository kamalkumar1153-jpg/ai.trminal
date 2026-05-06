async function loadSignal() {
  try {
    const res = await fetch("/signal");
    const data = await res.json();

    if (data.error) {
      document.getElementById("nifty").innerText = "Error";
      document.getElementById("sensex").innerText = "Error";
      return;
    }

    document.getElementById("nifty").innerText =
      `${data.nifty.signal} @ ${data.nifty.price}`;

    document.getElementById("sensex").innerText =
      `${data.sensex.signal} @ ${data.sensex.price}`;

  } catch (e) {
    console.log(e);
  }
}

setInterval(loadSignal, 5000);
loadSignal();
