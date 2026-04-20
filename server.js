async function getPrices(token) {
    try {
        const url = 'https://api.upstox.com/v2/market-quote/quotes?symbol=NSE_INDEX|Nifty%2050,BSE_INDEX|SENSEX';
        const res = await axios.get(url, {
            headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
        });

        const nifty = res.data.data['NSE_INDEX:Nifty 50'].last_price;
        const sensex = res.data.data['BSE_INDEX:SENSEX'].last_price;

        // Data History for Indicators
        history.nifty.push(nifty);
        if (history.nifty.length > 100) history.nifty.shift();

        let rsiVal = "--", macdStatus = "--", ichiStatus = "--", finalSignal = "SCANNING...";

        // 1. RSI Calculation (Period 14)
        if (history.nifty.length >= 14) {
            const rsis = RSI.calculate({ values: history.nifty, period: 14 });
            rsiVal = rsis.length > 0 ? rsis[rsis.length - 1].toFixed(2) : "--";
        }

        // 2. MACD Calculation (12, 26, 9)
        if (history.nifty.length >= 26) {
            const macdInput = { values: history.nifty, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false };
            const macdResult = MACD.calculate(macdInput);
            if (macdResult.length > 0) {
                const latest = macdResult[macdResult.length - 1];
                macdStatus = latest.MACD > latest.signal ? "BULLISH 📈" : "BEARISH 📉";
            }
        }

        // 3. Ichimoku Cloud (9, 26, 52) - Simplified Logic
        if (history.nifty.length >= 52) {
            const high = Math.max(...history.nifty.slice(-9));
            const low = Math.min(...history.nifty.slice(-9));
            const conversionLine = (high + low) / 2;
            ichiStatus = nifty > conversionLine ? "ABOVE ☁️" : "BELOW ☁️";
        }

        // --- MASTER SIGNAL LOGIC ---
        if (rsiVal > 60 && macdStatus.includes("BULLISH") && ichiStatus.includes("ABOVE")) {
            finalSignal = "🚀 STRONG BUY (ALL CONFIRMED)";
        } else if (rsiVal < 40 && macdStatus.includes("BEARISH") && ichiStatus.includes("BELOW")) {
            finalSignal = "🆘 STRONG SELL (ALL CONFIRMED)";
        } else if (rsiVal !== "--") {
            finalSignal = rsiVal > 50 ? "WAITING FOR CONFIRMATION..." : "SIDEWAYS MARKET";
        }

        // Update Firebase
        await db.ref("market_data").update({
            nifty: nifty,
            sensex: sensex,
            rsi: rsiVal,
            macd: macdStatus,
            ichi: ichiStatus,
            signal: finalSignal,
            status: "Live ✅",
            last_sync: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })
        });

    } catch (e) { 
        console.log("Upstox Connection Error: ", e.message); 
    }
}





                                           












