import requests
import json
import os
import time

# GitHub Secrets से डेटा उठाना
ACCESS_TOKEN = os.getenv('UPSTOX_ACCESS_TOKEN')
FIREBASE_URL = os.getenv('FIREBASE_URL')

def update_market_data():
    url = "https://api.upstox.com/v2/market-quote/quotes"
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {ACCESS_TOKEN}'
    }
    # Nifty, BankNifty और Sensex की कीज़
    params = {'instrument_key': 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX'}

    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()['data']
            payload = {
                "nifty_price": data['NSE_INDEX|Nifty 50']['last_price'],
                "banknifty_price": data['NSE_INDEX|Nifty Bank']['last_price'],
                "sensex_price": data['BSE_INDEX|SENSEX']['last_price'],
                "timestamp": time.strftime("%H:%M:%S")
            }
            # Firebase में डेटा डालना
            requests.put(FIREBASE_URL, data=json.dumps(payload))
            print("✅ Firebase Sync Successful!")
        else:
            print(f"❌ API Error: {response.status_code}")
    except Exception as e:
        print(f"⚠️ Error: {e}")

if __name__ == "__main__":
    update_market_data()
