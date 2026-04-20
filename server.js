async function getPrices(token) {
    try {
        const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        // History maintain karein (Indicators ke liye 14-20 candles chahiye)
        history.nifty.push(nifty);
        if (history.nifty.length > 50) history.nifty.shift();

        let rsiVal = "--";
        let signal = "SCANNING...";

        if (history.nifty.length >= 14) {
            const rsis = RSI.calculate({ values: history.nifty, period: 14 });
            rsiVal = rsis.length > 0 ? rsis[rsis.length - 1].toFixed(2) : "--";

            // Signal Logic
            if (rsiVal > 60) signal = "🔥 BUY NIFTY (UPTREND)";
            else if (rsiVal < 40) signal = "❄️ SELL NIFTY (DOWNTREND)";
            else signal = "⏳ SIDEWAYS MARKET";
        }

        // Firebase ko data bhein jo Dashboard ke labels se match kare
        await db.ref("market_data").update({
            nifty: nifty,
            sensex: sensex,
            rsi: rsiVal,
            macd: (rsiVal > 50 ? "BULLISH" : "BEARISH"), // Temporary logic for MACD label
            ichi: (nifty > 24400 ? "ABOVE" : "BELOW"),   // Temporary logic for ICHI label
            signal: signal,
            status: "Connected ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });
    } catch (e) { console.log("Fetch Error"); }
}



                                           












