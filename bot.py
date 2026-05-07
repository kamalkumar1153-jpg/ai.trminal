import requests
import json
import os
import time

# GitHub के वातावरण से डेटा लेना
ACCESS_TOKEN = os.getenv(' eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIyRUNDRTMiLCJqdGkiOiI2OWZiZmVhMDU2Y2E0NTAwN2E4OGMzYTUiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaXNQbHVzUGxhbiI6dHJ1ZSwiaWF0IjoxNzc4MTIyNDAwLCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NzgxOTEyMDB9.RHT9rklePvmLGupInQdvri65LJedQrYUfZ7szmfvrdY')
FIREBASE_URL = os.getenv('FIREBASE_URL')

def sync_to_cloud():
    url = "https://api.upstox.com/v2/market-quote/quotes"
    headers = {
        'Accept': 'application/json',
        'Authorization': f'Bearer {ACCESS_TOKEN}'
    }
    # Nifty, BankNifty और Sensex का डेटा
    params = {'instrument_key': 'NSE_INDEX|Nifty 50,NSE_INDEX|Nifty Bank,BSE_INDEX|SENSEX'}

    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            data = response.json()['data']
            payload = {
                "nifty_price": data['NSE_INDEX|Nifty 50']['last_price'],
                "banknifty_price": data['NSE_INDEX|Nifty Bank']['last_price'],
                "sensex_price": data['BSE_INDEX|SENSEX']['last_price'],
                "last_sync": time.strftime("%H:%M:%S")
            }
            # Firebase अपडेट
            requests.put(FIREBASE_URL, data=json.dumps(payload))
            print(f"✅ Cloud Sync Done: {payload['last_sync']}")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"⚠️ Connection Failed: {e}")

if __name__ == "__main__":
    sync_to_cloud()

