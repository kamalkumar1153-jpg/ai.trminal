import yfinance as yf
import pandas_ta as ta
import json
from datetime import datetime

# ट्रैक किए जाने वाले मुख्य शेयर्स और इंडेक्स
STOCKS = ["^NSEI", "^BSESN", "RELIANCE.NS", "HDFCBANK.NS", "TCS.NS", "INFY.NS", "SBIN.NS", "ICICIBANK.NS"]

def scan_market():
    results = {}
    for symbol in STOCKS:
        try:
            # 15 मिनट के प्रेडिक्शन के लिए डेटा फेच करना
            df = yf.Ticker(symbol).history(period="5d", interval="15m")
            if df.empty: continue
            
            # टेक्निकल इंडिकेटर्स
            df['RSI'] = ta.rsi(df['Close'], length=14)
            df['EMA_20'] = ta.ema(df['Close'], length=20)
            macd = ta.macd(df['Close'])
            
            latest = df.iloc[-1]
            macd_h = macd['MACDh_12_26_9'].iloc[-1]
            
            # स्मार्ट स्कोरिंग लॉजिक (0-100)
            score = 0
            if latest['Close'] > latest['EMA_20']: score += 40
            if latest['RSI'] > 50: score += 30
            if macd_h > 0: score += 30
            
            clean_name = symbol.replace('.NS', '').replace('^', '')
            results[clean_name] = {
                "price": round(latest['Close'], 2),
                "score": score,
                "rsi": round(latest['RSI'], 1),
                "signal": "STRONG BUY" if score >= 70 else "WEAK BUY" if score >= 50 else "HOLD" if score >= 30 else "SELL",
                "alert": True if score >= 70 else False
            }
        except Exception as e:
            print(f"Error scanning {symbol}: {e}")
            continue
    return results

# फाइनल आउटपुट तैयार करना
output = {
    "last_update": datetime.now().strftime("%H:%M:%S"),
    "data": scan_market()
}

# JSON फाइल में सेव करना
with open('market_scan.json', 'w') as f:
    json.dump(output, f, indent=4)

print("✅ Market Scan Completed & Saved to market_scan.json")
