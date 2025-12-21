import json
import urllib.request
import urllib.parse
import ssl
import urllib.error
import re

ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

base_url = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/'

def test_url(url):
    try:
        req = urllib.request.Request(url, method='HEAD')
        req.add_header('User-Agent', 'Mozilla/5.0')
        with urllib.request.urlopen(req, timeout=10, context=ssl_context) as response:
            return response.status == 200
    except:
        return False

def find_working_url(title):
    title_variations = set([title])
    
    if ' - ' in title:
        title_variations.add(title.replace(' - ', ' '))
        title_variations.add(title.replace(' - ', ': '))
    
    if '-' in title:
        title_variations.add(title.replace('-', ' '))
        title_variations.add(title.replace('-', ''))
    
    if ':' in title:
        title_variations.add(title.replace(':', ''))
        title_variations.add(title.replace(':', ' -'))
    
    if '.' in title:
        title_variations.add(title.replace('.', ''))
        title_variations.add(title.replace('.', ' '))
    
    if ' & ' in title:
        title_variations.add(title.replace(' & ', ' and '))
    
    if ' and ' in title:
        title_variations.add(title.replace(' and ', ' & '))
    
    if title.startswith('The '):
        without_the = title[4:]
        title_variations.add(without_the + ', The')
        title_variations.add(without_the)
    
    if title.endswith(', The'):
        with_the = 'The ' + title[:-5]
        title_variations.add(with_the)
        title_variations.add(title[:-5])
    
    if "Disney's" in title:
        without_disney = title.replace("Disney's ", "").replace("Disney's", "").strip()
        title_variations.add(without_disney)
        if without_disney.startswith("The "):
            title_variations.add(without_disney[4:] + ", The")
            title_variations.add(without_disney[4:])
    
    regions = ['USA', 'Europe', 'Japan', 'World']
    
    for var in title_variations:
        if not var or not var.strip():
            continue
        
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

print(f'Testando {len(games)} jogos...\n')
working = []
failed = []
fixed_games = {}

try:
    with open('fix_images_progress.json', 'r') as f:
        progress = json.load(f)
        fixed_games = progress.get('fixed', {})
        print(f'Carregando progresso: {len(fixed_games)} já corrigidos')
except:
    pass

for i, game in enumerate(games, 1):
    title = game['title']
    
    if title in fixed_games:
        print(f'[{i}/{len(games)}] {title}... JÁ CORRIGIDO')
        working.append((title, fixed_games[title]))
        continue
    
    print(f'[{i}/{len(games)}] {title}...', end=' ', flush=True)
    
    url = find_working_url(title)
    if url:
        print(f'OK')
        working.append((title, url))
        fixed_games[title] = url
        
        with open('fix_images_progress.json', 'w') as f:
            json.dump({'fixed': fixed_games}, f, indent=2)
    else:
        print('FALHOU')
        failed.append(title)

print(f'\n\nResumo:')
print(f'Funcionando: {len(working)}')
print(f'Falhando: {len(failed)}')

if fixed_games:
    print(f'\nAtualizando games.js com URLs funcionais...')
    
    for game in games:
        title = game['title']
        if title in fixed_games:
            game['cover'] = fixed_games[title]
            cover_urls = game.get('coverUrls', [])
            if fixed_games[title] not in cover_urls:
                game['coverUrls'] = [fixed_games[title]] + cover_urls
    
    output_content = 'const gamesCatalog = ' + json.dumps(games, indent=2, ensure_ascii=False) + ';'
    
    with open('labs/videogame/games.js', 'w', encoding='utf-8') as f:
        f.write(output_content)
    
    print(f'Atualizado games.js com {len(fixed_games)} URLs funcionais')

print(f'\nJogos que ainda falham ({len(failed)}):')
for title in failed[:20]:
    print(f'  - {title}')

