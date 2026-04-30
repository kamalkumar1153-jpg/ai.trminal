import yfinance as yf
import pandas_ta as ta
import json
from datetime import datetime

# इन शेयर्स को हम ट्रैक करेंगे
STOCKS = ["^NSEI", "^BSESN", "RELIANCE.NS", "HDFCBANK.NS", "TCS.NS", "SBIN.NS"]

def get_market_signals():
    results = {}
    for symbol in STOCKS:
        try:
            ticker = yf.Ticker(symbol)
            df = ticker.history(period="5d", interval="15m")
            if df.empty: continue

            # टेक्निकल एनालिसिस
            df['RSI'] = ta.rsi(df['Close'], length=14)
            df['EMA_20'] = ta.ema(df['Close'], length=20)
            macd = ta.macd(df['Close'])
            macd_h = macd['MACDh_12_26_9'].iloc[-1]
            latest = df.iloc[-1]

            # स्कोरिंग लॉजिक (0-100)
            score = 0
            if latest['Close'] > latest['EMA_20']: score += 40
            if latest['RSI'] > 50: score += 30
            if macd_h > 0: score += 30

            name = symbol.replace('.NS', '').replace('^', '')
            results[name] = {
                "price": round(latest['Close'], 2),
                "rsi": round(latest['RSI'], 1),
                "score": score,
                "signal": "STRONG BUY" if score >= 70 else "WAIT" if score >= 40 else "SELL",
                "alert": True if score >= 70 else False
            }
        except: continue
    return results

# फाइनल आउटपुट
data_to_save = {
    "last_update": datetime.now().strftime("%H:%M:%S"),
    "data": get_market_signals()
}

with open('market_scan.json', 'w') as f:
    json.dump(data_to_save, f, indent=4)
print("✅ JSON Updated Successfully")

