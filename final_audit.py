import re
import urllib.parse
import os

# 1. Parse libretro_index.html to build valid set
valid_filenames = set()

if not os.path.exists('libretro_index.html'):
    print("Error: libretro_index.html not found. Please download it first.")
    exit(1)

with open('libretro_index.html', 'r', encoding='latin-1') as f:
    content = f.read()
    # Pattern for links: <a href="Filename.png">
    # Matches href="pattern"
    matches = re.findall(r'href="([^"]+\.png)"', content)
    for m in matches:
        # Decode URI encoding if present in href (browsers/apache listing usually encode spaces)
        decoded = urllib.parse.unquote(m)
        valid_filenames.add(decoded)

print(f"Loaded {len(valid_filenames)} valid images from index.")

# 2. Parse games.js
with open('labs/videogame/games.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

pattern = re.compile(r'\["(.*?)",\s*"(.*?)",\s*(.*?)\]')

broken = []
total_checked = 0

lines = js_content.split('\n')
for line in lines:
    line = line.strip()
    if not line or line.startswith('//'): continue
    
    m = pattern.search(line)
    if m:
        title = m.group(2)
        cover_segment = m.group(3)
        
        if cover_segment == "null":
            continue
            
        # cover_segment is "Encoded.png"
        cover_file_encoded = cover_segment.strip('"')
        cover_file = urllib.parse.unquote(cover_file_encoded)
        
        total_checked += 1
        
        if cover_file not in valid_filenames:
            broken.append((title, cover_file))

print(f"Checked {total_checked} images.")
print(f"Found {len(broken)} broken images.")

for b in broken:
    print(f"BROKEN: {b[0]} -> {b[1]}")
