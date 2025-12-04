import json
import urllib.request
import ssl
import re
from concurrent.futures import ThreadPoolExecutor

def check_url(game):
    url = game['cover']
    
    # Create an SSL context that ignores certificate verification
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    
    try:
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req, timeout=5, context=ctx) as response:
            if response.status != 200:
                return f"BROKEN: {game['title']} -> {url} ({response.status})"
    except urllib.error.HTTPError as e:
        return f"BROKEN: {game['title']} -> {url} ({e.code})"
    except Exception as e:
        return f"ERROR: {game['title']} -> {url} ({str(e)})"
    return None

def main():
    with open('labs/videogame/games.js', 'r') as f:
        content = f.read()
        # Strip "const gamesCatalog = " and ";"
        json_str = re.sub(r'^const gamesCatalog = ', '', content)
        json_str = json_str.strip().rstrip(';')
        
    games = json.loads(json_str)
    print(f"Checking {len(games)} games...")
    
    broken_count = 0
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(check_url, games)
        
    for result in results:
        if result:
            print(result)
            broken_count += 1
            
    print(f"Done. Found {broken_count} broken covers.")

if __name__ == "__main__":
    main()
