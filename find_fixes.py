import json
import urllib.request
import ssl
import re
from concurrent.futures import ThreadPoolExecutor

# SSL Context
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

REGIONS = ["USA", "Europe", "Japan", "World", "USA, Europe", "Europe, Brazil"]

def check_single_url(url):
    try:
        req = urllib.request.Request(url, method='HEAD')
        with urllib.request.urlopen(req, timeout=3, context=ctx) as response:
            return response.status == 200
    except:
        return False

def get_cover_url(title, region):
    # Standard replacement
    safe_title = title.replace(':', '_').replace('/', '_').replace('?', '_')
    encoded_title = urllib.request.quote(safe_title)
    return f"https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/{encoded_title}%20({region}).png"

def try_fix(game):
    original_url = game['cover']
    if check_single_url(original_url):
        return None

    title = game['title']
    
    # Strategy 1: Try different regions
    for region in REGIONS:
        url = get_cover_url(title, region)
        if check_single_url(url):
            return f"FIX: '{title}': '{region}'"

    # Strategy 2: Move "The" to the end
    if title.startswith("The "):
        title_no_the = title[4:] + ", The"
        for region in REGIONS:
            url = get_cover_url(title_no_the, region)
            if check_single_url(url):
                return f"FIX_NAME: '{title}' -> '{title_no_the}' ({region})"

    # Strategy 3: Replace "&" with "_"
    if "&" in title:
        title_and_underscore = title.replace("&", "_")
        for region in REGIONS:
            url = get_cover_url(title_and_underscore, region)
            if check_single_url(url):
                return f"FIX_NAME: '{title}' -> '{title_and_underscore}' ({region})"

    # Strategy 4: Replace "&" with "and"
    if "&" in title:
        title_and_text = title.replace("&", "and")
        for region in REGIONS:
            url = get_cover_url(title_and_text, region)
            if check_single_url(url):
                return f"FIX_NAME: '{title}' -> '{title_and_text}' ({region})"

    return f"FAILED: {title}"

def main():
    with open('labs/videogame/games.js', 'r') as f:
        content = f.read()
        json_str = re.sub(r'^const gamesCatalog = ', '', content)
        json_str = json_str.strip().rstrip(';')
        
    games = json.loads(json_str)
    print(f"Checking {len(games)} games for fixes...")
    
    with ThreadPoolExecutor(max_workers=20) as executor:
        results = executor.map(try_fix, games)
        
    for result in results:
        if result:
            print(result)

if __name__ == "__main__":
    main()
