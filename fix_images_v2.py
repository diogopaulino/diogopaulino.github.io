import json
import urllib.request
import urllib.parse
import ssl
import urllib.error

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

base_url = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/'

def test_url(url):
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=5, context=ssl_context) as response:
            return response.status == 200
    except:
        return False

SPECIAL_MAPPINGS = {
    "Alien 3": ["Alien³", "Alien III", "Alien 3"],
    "Altered Beast": ["Altered Beast"],
    "Asterix and the Power of the Gods": ["Asterix & the Power of the Gods", "Asterix and the Power of the Gods"],
    "Awesome Possum": ["Awesome Possum"],
    "B.O.B.": ["B.O.B", "B.O.B.", "BOB"],
    "Baby's Day Out": ["Baby's Day Out"],
    "Battle Squadron": ["Battle Squadron"],
    "Battletoads": ["Battletoads"],
    "Bio-Hazard Battle": ["Bio-Hazard Battle", "Bio Hazard Battle"],
    "Bio-Ship Paladin": ["Bio Ship Paladin", "Bio-Ship Paladin"],
    "Bloodshot": ["Bloodshot"],
    "Bonkers": ["Bonkers"],
    "Caliber .50": ["Caliber 50", "Caliber .50"],
    "Chakan - The Forever Man": ["Chakan The Forever Man", "Chakan - The Forever Man"],
    "Chicago Syndicate": ["Chicago Syndicate"],
    "Contra - Hard Corps": ["Contra Hard Corps", "Contra - Hard Corps"],
    "Crüe Ball": ["Crüe Ball", "Crue Ball"],
    "Daffy Duck in Hollywood": ["Daffy Duck in Hollywood"],
    "Decap Attack": ["Decap Attack"],
    "Desert Strike - Return to the Gulf": ["Desert Strike Return to the Gulf", "Desert Strike - Return to the Gulf"],
    "Disney's Aladdin": ["Aladdin", "Disney's Aladdin"],
    "Disney's The Lion King": ["Lion King, The", "The Lion King", "Lion King"],
    "ESWAT - City Under Siege": ["ESWAT City Under Siege", "ESWAT - City Under Siege"],
    "Ecco Jr.": ["Ecco Jr", "Ecco Jr."],
    "El Viento": ["El Viento"],
    "Fido Dido": ["Fido Dido"],
    "Galahad": ["Galahad"],
    "Gauntlet IV": ["Gauntlet IV", "Gauntlet 4"],
    "Ghouls 'n Ghosts": ["Ghouls 'n Ghosts", "Ghouls n Ghosts"],
    "Hit the Ice": ["Hit the Ice"],
    "James Pond": ["James Pond"],
    "James Pond II - Codename RoboCod": ["James Pond II Codename RoboCod", "James Pond II - Codename RoboCod"],
    "Jim Power - The Arcade Game": ["Jim Power The Arcade Game", "Jim Power - The Arcade Game"],
    "Joe & Mac": ["Joe and Mac", "Joe & Mac"],
    "M.U.S.H.A.": ["M.U.S.H.A", "M.U.S.H.A.", "MUSHA"],
    "Mega Panel": ["Mega Panel"],
    "Power Rangers": ["Mighty Morphin Power Rangers", "Power Rangers"],
    "Ren & Stimpy": ["Ren and Stimpy", "Ren & Stimpy"],
    "Snow Bros. - Nick & Tom": ["Snow Bros. - Nick & Tom", "Snow Bros - Nick & Tom"],
    "Sonic & Knuckles": ["Sonic and Knuckles", "Sonic & Knuckles"],
    "Speedy Gonzales - Cheez Cat-astrophe": ["Speedy Gonzales Cheez Cat astrophe", "Speedy Gonzales - Cheez Cat-astrophe"],
    "Street Fighter II - Special Champion Edition": ["Street Fighter II Special Champion Edition", "Street Fighter II - Special Champion Edition"],
    "Super Mario Bros.": ["Super Mario Bros", "Super Mario Bros."],
    "The Adventures of Batman & Robin": ["Adventures of Batman & Robin, The", "The Adventures of Batman & Robin"],
    "The Aquatic Games": ["Aquatic Games, The", "The Aquatic Games"],
    "The Chaos Engine 2": ["Chaos Engine 2, The", "The Chaos Engine 2"],
    "The Simpsons - Bart vs. the Space Mutants": ["Simpsons - Bart vs. the Space Mutants, The", "The Simpsons - Bart vs. the Space Mutants"],
    "The Simpsons - Bart's Nightmare": ["Simpsons - Bart's Nightmare, The", "The Simpsons - Bart's Nightmare"],
    "The Smurfs": ["Smurfs, The", "The Smurfs"],
    "The Smurfs 2": ["Smurfs 2, The", "The Smurfs 2"],
    "Tom & Jerry": ["Tom and Jerry", "Tom & Jerry"],
    "Tom & Jerry - Frantic Antics": ["Tom and Jerry - Frantic Antics", "Tom & Jerry - Frantic Antics"],
    "ToeJam & Earl": ["ToeJam and Earl", "ToeJam & Earl"],
}

def find_working_url_comprehensive(title):
    variations = []
    
    if title in SPECIAL_MAPPINGS:
        variations.extend(SPECIAL_MAPPINGS[title])
    
    variations.append(title)
    
    if ' - ' in title:
        variations.append(title.replace(' - ', ' '))
        variations.append(title.replace(' - ', ': '))
        variations.append(title.replace(' - ', ''))
    
    if '-' in title:
        variations.append(title.replace('-', ' '))
        variations.append(title.replace('-', ''))
    
    if ':' in title:
        variations.append(title.replace(':', ''))
        variations.append(title.replace(':', ' -'))
    
    if '.' in title:
        variations.append(title.replace('.', ''))
        variations.append(title.replace('.', ' '))
        if title.endswith('.'):
            variations.append(title.rstrip('.'))
    
    if ' & ' in title:
        variations.append(title.replace(' & ', ' and '))
        variations.append(title.replace(' & ', ' '))
    
    if ' and ' in title:
        variations.append(title.replace(' and ', ' & '))
        variations.append(title.replace(' and ', ' '))
    
    if title.startswith('The '):
        without_the = title[4:].strip()
        variations.append(without_the + ', The')
        variations.append(without_the)
    
    if title.endswith(', The'):
        with_the = 'The ' + title[:-5].strip()
        variations.append(with_the)
        variations.append(title[:-5].strip())
    
    if "Disney's" in title:
        without_disney = title.replace("Disney's ", "").replace("Disney's", "").strip()
        variations.append(without_disney)
        variations.append(title.replace("Disney's ", "Disney "))
        if without_disney.startswith("The "):
            variations.append(without_disney[4:] + ", The")
            variations.append(without_disney[4:])
    
    if ' vs. ' in title:
        variations.append(title.replace(' vs. ', ' vs '))
    
    if ' vs ' in title:
        variations.append(title.replace(' vs ', ' vs. '))
    
    if "'" in title:
        variations.append(title.replace("'", ""))
        variations.append(title.replace("'", " "))
    
    variations = list(set([v for v in variations if v and v.strip()]))
    
    regions = ['USA', 'Europe', 'Japan', 'World']
    
    for var in variations:
        for region in regions:
            for suffix in ['', ', En']:
                full_name = f'{var} ({region}{suffix})'
                encoded = urllib.parse.quote(full_name, safe='')
                url = f'{base_url}{encoded}.png'
                if test_url(url):
                    return url
        
        encoded = urllib.parse.quote(var, safe='')
        url = f'{base_url}{encoded}.png'
        if test_url(url):
            return url
    
    return None

with open('labs/videogame/games.js', 'r', encoding='utf-8') as f:
    content = f.read()
    json_start = content.find('[')
    json_end = content.rfind(']') + 1
    games = json.loads(content[json_start:json_end])

print(f'Testando {len(games)} jogos individualmente...\n')
fixed_count = 0

for i, game in enumerate(games, 1):
    title = game['title']
    current_cover = game.get('cover', '')
    
    if current_cover and test_url(current_cover):
        print(f'[{i}/{len(games)}] {title}: OK (já funciona)')
        continue
    
    print(f'[{i}/{len(games)}] {title}...', end=' ', flush=True)
    
    url = find_working_url_comprehensive(title)
    if url:
        print(f'OK -> {url[:60]}...')
        game['cover'] = url
        cover_urls = game.get('coverUrls', [])
        if url not in cover_urls:
            game['coverUrls'] = [url] + cover_urls
        fixed_count += 1
        
        if fixed_count % 10 == 0:
            output_content = 'const gamesCatalog = ' + json.dumps(games, indent=2, ensure_ascii=False) + ';'
            with open('labs/videogame/games.js', 'w', encoding='utf-8') as f:
                f.write(output_content)
            print(f'  (Salvando progresso: {fixed_count} corrigidos)')
    else:
        print('FALHOU')

output_content = 'const gamesCatalog = ' + json.dumps(games, indent=2, ensure_ascii=False) + ';'
with open('labs/videogame/games.js', 'w', encoding='utf-8') as f:
    f.write(output_content)

print(f'\n\nFinalizado! {fixed_count} jogos corrigidos.')

