import yfinance as yf
import pandas_ta as ta
import requests
import json
from datetime import datetime

# आपका Firebase URL
FB_URL = "https://market--treminal-default-rtdb.firebaseio.com/market_data.json"

def get_market_data(symbol, name):
    try:
        ticker = yf.Ticker(symbol)
        df = ticker.history(period="5d", interval="15m")
        if df.empty: return None

        df['RSI'] = ta.rsi(df['Close'], length=14)
        df['EMA_20'] = ta.ema(df['Close'], length=20)
        macd = ta.macd(df['Close'])
        
        latest = df.iloc[-1]
        macd_h = macd['MACDh_12_26_9'].iloc[-1]
        
        score = 0
        if latest['Close'] > latest['EMA_20']: score += 40
        if latest['RSI'] > 50: score += 30
        if macd_h > 0: score += 30

        return {
            "name": name,
            "price": round(latest['Close'], 2),
            "rsi": round(latest['RSI'], 1),
            "score": score,
            "signal": "STRONG BUY" if score >= 70 else "WAIT" if score >= 40 else "SELL",
            "time": datetime.now().strftime("%H:%M:%S")
        }
    except: return None

# दोनों इंडेक्स का डेटा तैयार करें
final_payload = {
    "nifty": get_market_data("^NSEI", "NIFTY 50"),
    "sensex": get_market_data("^BSESN", "SENSEX")
}

# Firebase पर अपलोड करें
try:
    requests.put(FB_URL, data=json.dumps(final_payload))
    print("✅ Nifty & Sensex updated on Firebase!")
except Exception as e:
    print(f"❌ Error: {e}")


