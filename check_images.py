import re
import urllib.request
import urllib.error

# Base URL
B = "https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/"

try:
    with open('labs/videogame/games.js', 'r') as f:
        content = f.read()
except FileNotFoundError:
    print("Could not find games.js")
    exit(1)

match = re.search(r'const _g = \[\n(.*?)\n\];', content, re.DOTALL)
if not match:
    match = re.search(r'const _g = \[(.*?)\];', content, re.DOTALL)
    if not match:
        print("Could not find _g array")
        exit(1)

array_content = match.group(1)
# Regex to match the array components. Note that spaces might vary.
pattern = re.compile(r'\["(.*?)",\s*"(.*?)",\s*(.*?)\]')

broken = []
working = []

print("Checking images...")

for line in array_content.split('\n'):
    line = line.strip()
    if not line: continue
    if not line.startswith('['): continue
    if line.startswith('//'): continue 

    m = pattern.search(line)
    if m:
        zip_file = m.group(1)
        title = m.group(2)
        cover_segment = m.group(3)
        
        if cover_segment == "null":
            print(f"MISSING: {title} (Explicit null)")
            broken.append((title, zip_file, None))
        else:
            cover_file = cover_segment.strip('"')
            # Handle potential encoding issues in the filename if necessary, but requests are usually fine.
            # We need to quote the URL parts.
            # cover_file in JS is already URL encoded?
            # Example: "Addams%20Family%2C%20The%20%28USA%2C%20Europe%29.png" -- it is already encoded.
            
            full_url = B + cover_file
            
            try:
                req = urllib.request.Request(full_url, method='HEAD')
                with urllib.request.urlopen(req) as response:
                    if response.status == 200:
                        working.append(title)
            except urllib.error.HTTPError as e:
                print(f"BROKEN: {title} -> {full_url} ({e.code})")
                broken.append((title, zip_file, cover_file))
            except Exception as e:
                print(f"ERROR: {title} -> {e}")
                broken.append((title, zip_file, cover_file))

print(f"\nSummary: {len(working)} working, {len(broken)} broken.")
for b in broken:
    print(f"Broken: {b[0]} | CurrentRef: {b[2]}")
