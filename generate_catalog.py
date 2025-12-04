import os
import json
import re
import urllib.parse

ROM_DIR = 'labs/videogame/roms/mega-drive'
OUTPUT_FILE = 'labs/videogame/games.js'

# Massive mapping based on common 8.3 filenames found in ROM sets
NAME_MAP = {
    "ADDAM": "Addams Family, The",
    "AEROACR2": "Aero the Acro-Bat 2",
    "AEROBLST": "Aero Blasters",
    "AFLASH": "Arrow Flash",
    "AFTBURN2": "After Burner II",
    "ALADDIN": "Disney's Aladdin",
    "ALESTE": "M.U.S.H.A.",
    "ALIEN3": "Alien 3",
    "ALIENSO": "Alien Soldier",
    "ALISIADR": "Alisia Dragoon",
    "ALTBEAST": "Altered Beast",
    "ANIMAN": "Animaniacs",
    "ANOTHER": "Another World",
    "APOSSUM": "Awesome Possum",
    "AQUATIC": "The Aquatic Games",
    "ARCAD": "Arcade Classics",
    "ARIEL": "Ariel the Little Mermaid",
    "AST-PGOD": "Asterix and the Power of the Gods",
    "ASTERIX": "Asterix and the Great Rescue",
    "ASTORMBL": "Alien Storm",
    "ATOMIC": "Atomic Runner",
    "BABYDAY": "Baby's Day Out",
    "BADOMEN": "Devilish - The Next Possession",
    "BARTNITE": "The Simpsons - Bart's Nightmare",
    "BARTVSSM": "The Simpsons - Bart vs. the Space Mutants",
    "BATNROB": "The Adventures of Batman & Robin",
    "BATTLE": "Battletoads",
    "BATWINGS": "Batman Forever",
    "BB-ROAR": "Berenstain Bears' Camping Adventure, The",
    "BEAVBUT": "Beavis and Butt-Head",
    "BIOHAZ": "Bio-Hazard Battle",
    "BIOSHIPP": "Bio-Ship Paladin",
    "BLAS": "Blaster Master 2",
    "BLASTER": "Blaster Master 2",
    "BLD-VENG": "Blades of Vengeance",
    "BLOCKOUT": "Blockout",
    "BOB": "B.O.B.",
    "BONKERS": "Bonkers",
    "BOOG": "Boogerman - A Pick and Flick Adventure",
    "BRAMDAC": "Bram Stoker's Dracula",
    "BTLSQUAD": "Battle Squadron",
    "BUBB": "Bubble and Squeak",
    "BUBSY": "Bubsy in Claws Encounters of the Furred Kind",
    "BUBSY2": "Bubsy II",
    "BUGSDUFF": "Bugs Bunny in Double Trouble",
    "B_FRENZY": "Bloodshot",
    "C-PROAM": "Championship Pro-Am",
    "CAL50": "Caliber .50",
    "CANN": "Cannon Fodder",
    "CAPTAINA": "Captain America and the Avengers",
    "CASTLEOI": "Castle of Illusion Starring Mickey Mouse",
    "CASTLEVN": "Castlevania - Bloodlines",
    "CAST": "Castlevania - Bloodlines",
    "CHAKAN": "Chakan - The Forever Man",
    "CHAOSENG": "Chaos Engine, The",
    "CHAOS_E2": "The Chaos Engine 2",
    "CHESTER": "Chester Cheetah - Too Cool to Fool",
    "CHIC": "Chicago Syndicate",
    "CHUCKR": "Chuck Rock",
    "CHUCKR1": "Chuck Rock",
    "CHUCKR2": "Chuck Rock II - Son of Chuck",
    "COLUMNS": "Columns",
    "COLUMNS3": "Columns III",
    "COMBATCA": "Combat Cars",
    "COMIX": "Comix Zone",
    "CONTRA": "Contra - Hard Corps",
    "CONTRA4": "Contra - Hard Corps",
    "COOLSPOT": "Cool Spot",
    "COSPACEH": "Cosmic Spacehead",
    "CROSFIRE": "CrossFire",
    "CRUEBALL": "Crüe Ball",
    "CURSE": "Curse",
    "CYBERCOP": "Cyber-Cop",
    "DAFFY": "Daffy Duck in Hollywood",
    "DANG": "Dangerous Seed",
    "DARIUS2": "Sagaia",
    "DARKWATR": "Pirates of Dark Water, The",
    "DASHINDE": "Dashin' Desperadoes",
    "DECAPATK": "Decap Attack",
    "DESERT": "Desert Strike - Return to the Gulf",
    "DEVILCRA": "Dragon's Fury",
    "DUNE": "Dune - The Battle for Arrakis",
    "EARTHW": "Earthworm Jim",
    "E_JIM2": "Earthworm Jim 2",
    "ECCO": "Ecco the Dolphin",
    "ECCO2": "Ecco - The Tides of Time",
    "ECCOJR": "Ecco Jr.",
    "ELVIENTO": "El Viento",
    "ESWAT": "ESWAT - City Under Siege",
    "E-SWAT": "ESWAT - City Under Siege",
    "ETERNAL": "Eternal Champions",
    "EVANS": "Evander Holyfield's 'Real Deal' Boxing",
    "EXMUTANT": "Ex-Mutants",
    "F15": "F-15 Strike Eagle II",
    "FANTASIA": "Fantasia",
    "FATA": "Fatal Fury",
    "FATAL": "Fatal Fury",
    "FIDO": "Fido Dido",
    "FIFA": "FIFA International Soccer",
    "FLASHBCK": "Flashback - The Quest for Identity",
    "FLINT": "Flintstones, The",
    "FSTONES": "Flintstones, The",
    "FROGGER": "Frogger",
    "FWORLDS": "Forgotten Worlds",
    "GAIARES": "Gaiares",
    "GALAHAD": "Galahad",
    "GARG": "Gargoyles",
    "GAUNTLET": "Gauntlet IV",
    "GAUNTL": "Gauntlet IV",
    "GHOULS": "Ghouls 'n Ghosts",
    "GLOC": "G-LOC - Air Battle",
    "GODS": "Gods",
    "GOLDEN": "Golden Axe",
    "GOLDE": "Golden Axe",
    "GOLDEN2": "Golden Axe II",
    "GOLDEN3": "Golden Axe III",
    "GOOFY": "Goofy's Hysterical History Tour",
    "GRANADA": "Granada",
    "GREENDOG": "Greendog - The Beached Surfer Dude!",
    "GRINDSTO": "Grind Stormer",
    "GUNSTAR": "Gunstar Heroes",
    "GUNSTARH": "Gunstar Heroes",
    "GYNOUG": "Wings of Wor",
    "HAUNTING": "Haunting Starring Polterguy",
    "HELLFIRE": "Hellfire",
    "HERZOG": "Herzog Zwei",
    "HITHEICE": "Hit the Ice",
    "HOOK": "Hook",
    "HULK": "Incredible Hulk, The",
    "HUMANS": "Humans, The",
    "IMMORTAL": "Immortal, The",
    "INSECTOR": "Insector X",
    "INSECTOX": "Insector X",
    "JAMES": "James Pond",
    "JIMPOWER": "Jim Power - The Arcade Game",
    "JOE": "Joe & Mac",
    "JOEMAC": "Joe _ Mac",
    "JUNGLE": "Jungle Book, The",
    "JUNGLEBO": "Jungle Book, The",
    "JURASSIC": "Jurassic Park",
    "J_POND2": "James Pond II - Codename RoboCod",
    "KIDCHAM": "Kid Chameleon",
    "KIDC": "Kid Chameleon",
    "KLAX": "Klax",
    "LANDSTAL": "Landstalker",
    "LEMMINGS": "Lemmings",
    "LEMMIN": "Lemmings",
    "LETHAL": "Lethal Enforcers",
    "LIONKING": "Disney's The Lion King",
    "LOST": "Lost Vikings, The",
    "LOTUS": "Lotus Turbo Challenge",
    "LOTUS2": "Lotus II",
    "LVIKINGS": "Lost Vikings, The",
    "M-BOMB": "Mega Bomberman",
    "MADDEN": "Madden NFL '94",
    "MARBLE": "Marble Madness",
    "MARBLEM": "Marble Madness",
    "MARIO": "Super Mario Bros.",
    "MARVEL": "Marvel Land",
    "MAZI": "Mazin Saga - Mutant Fighter",
    "MEGA": "Mega Man - The Wily Wars",
    "MEGAPANL": "Mega Panel",
    "MERCS": "Mercs",
    "MICK": "Mickey Mania - The Timeless Adventures of Mickey Mouse",
    "MICKEY": "Castle of Illusion Starring Mickey Mouse",
    "MICROM": "Micro Machines",
    "MIDNIGHT": "Midnight Resistance",
    "MIDRES": "Midnight Resistance",
    "MIKYWRLD": "World of Illusion Starring Mickey Mouse and Donald Duck",
    "MK": "Mortal Kombat",
    "MK2": "Mortal Kombat II",
    "MK3": "Mortal Kombat 3",
    "MONOPOLY": "Monopoly",
    "MOONWALK": "Michael Jackson's Moonwalker",
    "MSFRANK": "Mary Shelley's Frankenstein",
    "MSPACMAN": "Ms. Pac-Man",
    "MUSHA": "M.U.S.H.A.",
    "NBA": "NBA Jam",
    "NBAL": "NBA Live 95",
    "NHL": "NHL Hockey",
    "NHL97": "NHL 97",
    "NINJA": "Revenge of Shinobi, The",
    "NORMY": "Normy's Beach Babe-O-Rama",
    "NZ-STORY": "NewZealand Story, The",
    "OLYMPIC": "Olympic Gold",
    "OUTR2019": "OutRun 2019",
    "OUTRUN": "OutRun",
    "PACATACK": "Pac-Attack",
    "PACMAN": "Pac-Man 2 - The New Adventures",
    "PACMAN2": "Pac-Man 2 - The New Adventures",
    "PAPERBOY": "Paperboy",
    "PHANTASY": "Phantasy Star IV",
    "PHELIOS": "Phelios",
    "PINO": "Pinocchio",
    "PIRA": "Pirates of Dark Water, The",
    "PITFALL": "Pitfall! - The Mayan Adventure",
    "PITFIG": "Pit-Fighter",
    "POCAHON": "Pocahontas",
    "POPU": "Populous",
    "POWER": "Power Rangers",
    "PREDATOR": "Predator 2",
    "PRINCE": "Prince of Persia",
    "PUGGSY": "Puggsy",
    "PULSEMAN": "Pulseman",
    "PUNISHER": "The Punisher",
    "PUYO": "Dr. Robotnik's Mean Bean Machine",
    "QUACK": "QuackShot Starring Donald Duck",
    "QUAKSHOT": "QuackShot Starring Donald Duck",
    "RAIDEN": "Raiden Trad",
    "RAIDENTR": "Raiden Trad",
    "RAINBOWE": "Rainbow Islands - The Story of Bubble Bobble 2",
    "RAMBO": "Rambo III",
    "RAMPART": "Rampart",
    "RANGER": "Ranger X",
    "RANGERX": "Ranger X",
    "RASTAN2": "Rastan Saga II",
    "REN": "Ren & Stimpy",
    "RISKYWOO": "Risky Woods",
    "RISTAR": "Ristar",
    "RMON": "Rocket Knight Adventures",
    "ROADRASH": "Road Rash",
    "ROBOCOP": "RoboCop vs. The Terminator",
    "ROBOTNIK": "Dr. Robotnik's Mean Bean Machine",
    "ROCKMAN": "Mega Man - The Wily Wars",
    "ROLL": "Rolling Thunder 2",
    "ROLLING": "Rolling Thunder 2",
    "ROLO": "Rolo to the Rescue",
    "RSHINOBI": "Revenge of Shinobi, The",
    "SAMURAI": "Samurai Shodown",
    "SBEAST2": "Shadow of the Beast II",
    "SECSAMUR": "Second Samurai",
    "SFORCE2": "Shining Force II",
    "SHADOW": "Shadow Dancer - The Secret of Shinobi",
    "SHARRIE2": "Space Harrier II",
    "SHDANCER": "Shadow Dancer - The Secret of Shinobi",
    "SHINING": "Shining Force",
    "SHINOBI": "Revenge of Shinobi, The",
    "SHINOBI3": "Shinobi III - Return of the Ninja Master",
    "SKELETON": "Skeleton Krew",
    "SKITCHIN": "Skitchin'",
    "SMASHTV": "Smash TV",
    "SMURFS": "Smurfs, The",
    "SMURFS2": "Smurfs 2, The",
    "SNOWBRO": "Snow Bros. - Nick _ Tom",
    "SOLDEACE": "Sol-Deace",
    "SONIC": "Sonic The Hedgehog",
    "SONIC1": "Sonic The Hedgehog",
    "SONIC2": "Sonic The Hedgehog 2",
    "SONIC3": "Sonic The Hedgehog 3",
    "SONIC3D": "Sonic 3D Blast",
    "SONICK": "Sonic _ Knuckles",
    "SONICSB": "Sonic Spinball",
    "SPAC": "Space Harrier II",
    "SPARKSTR": "Sparkster",
    "SPEEDY": "Speedy Gonzales - Cheez Cat-astrophe",
    "SPIDER": "Spider-Man",
    "SPLATTER": "Splatterhouse 2",
    "SPLATT2": "Splatterhouse 2",
    "SPOT": "Cool Spot",
    "SPOTHOLL": "Spot Goes to Hollywood",
    "STAR_CON": "Star Control",
    "STORM": "Stormlord",
    "STREET": "Street Fighter II - Special Champion Edition",
    "STREETF2": "Street Fighter II - Special Champion Edition",
    "STRIDER": "Strider",
    "STRIDER2": "Strider II",
    "STWEETY": "Sylvester and Tweety in Cagey Capers",
    "SUBTE": "Sub-Terrania",
    "SUNSET": "Sunset Riders",
    "SUPER": "Super Hang-On",
    "SUPERH": "Super Hang-On",
    "SUPERMAN": "Superman",
    "SWORDOFS": "Sword of Sodan",
    "SYNDICAT": "Syndicate",
    "SYND": "Syndicate",
    "TAZ": "Taz-Mania",
    "TAZMANIA": "Taz-Mania",
    "TEENAGE": "Teenage Mutant Ninja Turtles - The Hyperstone Heist",
    "TERMINAT": "The Terminator",
    "TETRIS": "Tetris",
    "TETRISBL": "Tetris",
    "THEME": "Theme Park",
    "THEMEPRK": "Theme Park",
    "THUNDER": "Thunder Force II",
    "THUNDER2": "Thunder Force II",
    "THUNDER3": "Thunder Force III",
    "THUNDER4": "Thunder Force IV",
    "TINY": "Tiny Toon Adventures - Buster's Hidden Treasure",
    "TINYTOON": "Tiny Toon Adventures - Buster's Hidden Treasure",
    "TMNT": "Teenage Mutant Ninja Turtles - The Hyperstone Heist",
    "TOEJ": "ToeJam & Earl",
    "TOEJAM": "ToeJam & Earl",
    "TOKI": "Toki - Going Ape Spit",
    "TOM": "Tom and Jerry",
    "TOM&": "Tom and Jerry - Frantic Antics",
    "TOY": "Toy Story",
    "TOYSTORY": "Toy Story",
    "TRUE": "True Lies",
    "TRUELIES": "True Lies",
    "TRUXTON": "Truxton",
    "TTAL": "Tiny Toon Adventures - Acme All-Stars",
    "TURRICAN": "Turrican",
    "TURRI": "Turrican",
    "TWINHAWK": "Twin Hawk",
    "UMK3": "Ultimate Mortal Kombat 3",
    "UNDEADLI": "Undead Line",
    "URBAN": "Urban Strike",
    "VECTOR": "Vectorman",
    "VECTOR2": "Vectorman 2",
    "VECTORM": "Vectorman",
    "VFVST2": "Virtua Fighter 2",
    "VIEWPOIN": "Viewpoint",
    "VIRTUA": "Virtua Racing",
    "VIRTU": "Virtua Racing",
    "VR": "Virtua Racing",
    "WARDNER": "Wardner",
    "WARLOCK": "Warlock",
    "WBOYMOWO": "Wonder Boy in Monster World",
    "WILYWARS": "Mega Man - The Wily Wars",
    "WINGS": "Wings of Wor",
    "WIZNLIZ": "Wiz 'n' Liz",
    "WOLF": "Wolfchild",
    "WONDER": "Wonder Boy in Monster World",
    "WORLD": "World of Illusion Starring Mickey Mouse and Donald Duck",
    "WORMS": "Worms",
    "WWF": "WWF Royal Rumble",
    "XENON": "Xenon 2 - Megablast",
    "XENON_2": "Xenon 2 - Megablast",
    "XMEN": "X-Men",
    "XMEN2": "X-Men 2 - Clone Wars",
    "ZERO": "Zero Wing",
    "ZEROWING": "Zero Wing",
    "ZOMBIES": "Zombies Ate My Neighbors",
    "ZOOL": "Zool - Ninja of the 'Nth' Dimension",
    "ZOOP": "Zoop",
    
    # Specific file overrides
    "GOLDE~28": "Golden Axe",
    "GOLDE~30": "Golden Axe II",
    "GOLDE~32": "Golden Axe III",
    "LEMMIN~1": "Lemmings 2 - The Tribes",
    "SHADOW~1": "Shadow of the Beast",
    "SONIC1": "Sonic The Hedgehog",
}

# Region mapping for games that might not have a (USA) cover or are exclusive
REGION_MAP = {
    "Alien Soldier": "Europe",
    "Mega Man - The Wily Wars": "Europe",
    "Golden Axe III": "Japan",
    "Pulseman": "Japan",
    "Cannon Fodder": "Europe",
    "Worms": "Europe",
    "The Smurfs": "Europe",
    "The Smurfs 2": "Europe",
    "Asterix and the Power of the Gods": "Europe",
    "Daffy Duck in Hollywood": "Europe",
    "Xenon 2 - Megablast": "Europe",
    "Zero Wing": "Europe",
    "Second Samurai": "Europe",
    "Undead Line": "Japan",
    "Dangerous Seed": "Japan",
    "Curse": "Japan",
    "Twin Hawk": "Europe",
    "Thunder Force IV": "Europe", # Often listed as Europe for this title, or Lightening Force for USA
    "Aero Blasters": "Japan",
    "Another World": "Europe",
    "Arcade Classics": "Europe",
    "Batman Forever": "Europe",
    "Blades of Vengeance": "Europe",
    "Bubsy II": "Europe",
    "Combat Cars": "Europe",
    "Cosmic Spacehead": "Europe",
    "Dragon's Fury": "Europe",
    "Forgotten Worlds": "Europe",
    "G-LOC - Air Battle": "World",
    "Golden Axe": "Europe",
    "Haunting Starring Polterguy": "Europe",
    "Klax": "Europe",
    "Marble Madness": "Europe",
    "NBA Live 95": "Europe",
    "NHL 97": "Europe",
    "Pit-Fighter": "Japan",
    "QuackShot Starring Donald Duck": "World",
    "Space Harrier II": "Europe",
    "Strider II": "Europe",
    "Super Hang-On": "Japan",
    "Syndicate": "Europe",
    "Taz-Mania": "Europe",
    "Tetris": "Japan",
    "Theme Park": "Europe",
    "Thunder Force II": "Europe",
    "Tiny Toon Adventures - Acme All-Stars": "Europe",
    "True Lies": "Europe",
    "Truxton": "Europe",
    "World of Illusion Starring Mickey Mouse and Donald Duck": "Europe",
    "X-Men 2 - Clone Wars": "Europe",
    "Addams Family, The": "Europe",
    "Chaos Engine, The": "Europe",
    "Incredible Hulk, The": "Europe",
    "NewZealand Story, The": "Japan",
    "Snow Bros. - Nick _ Tom": "Japan",
    "Sonic _ Knuckles": "Europe",
    "Smurfs, The": "Europe",
    "Smurfs 2, The": "Europe",
}

def clean_name(filename):
    base = os.path.splitext(filename)[0].upper()
    base_clean = re.sub(r'~\d+', '', base)
    
    # Sort keys by length descending to match longest prefix first
    sorted_keys = sorted(NAME_MAP.keys(), key=len, reverse=True)
    
    for key in sorted_keys:
        if base == key or base.startswith(key) or base_clean == key or base_clean.startswith(key):
            return NAME_MAP[key]

    name = os.path.splitext(filename)[0]
    name = re.sub(r'~\d+', '', name)
    name = name.replace('_', ' ').replace('.', ' ')
    name = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', name)
    return name.title()

def get_cover_url(title):
    # Use Libretro Thumbnails
    # Correct format: "Name (Region)" with SPACE before parenthesis.
    # Special chars: : -> _, / -> _, ? -> _
    
    safe_title = title.replace(':', '_').replace('/', '_').replace('?', '_')
    
    # URL Encode the title
    encoded_title = urllib.parse.quote(safe_title)
    
    # Determine region
    region = REGION_MAP.get(title, "USA")
    
    return f"https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/{encoded_title}%20({region}).png"

# Create game list directly
final_games = []
seen_titles = set()

# Load existing games to preserve file URLs
existing_files = {}
if os.path.exists(OUTPUT_FILE):
    try:
        with open(OUTPUT_FILE, 'r') as f:
            content = f.read()
            json_str = re.sub(r'^const gamesCatalog = ', '', content).strip().rstrip(';')
            existing_games = json.loads(json_str)
            for g in existing_games:
                existing_files[g['id']] = g['file']
    except Exception as e:
        print(f"Warning: Could not read existing games.js: {e}")

if os.path.exists(ROM_DIR):
    # First pass: Collect all potential games
    candidates = []
    for filename in sorted(os.listdir(ROM_DIR)):
        if filename.lower().endswith(('.zip', '.md', '.bin', '.smd', '.gen')):
            title = clean_name(filename)
            candidates.append({
                "filename": filename,
                "title": title,
                "is_zip": filename.lower().endswith('.zip')
            })

    # Second pass: Filter duplicates, preferring ZIPs
    # Sort by is_zip (True first) so we process ZIPs first
    candidates.sort(key=lambda x: x['is_zip'], reverse=True)

    for cand in candidates:
        if cand['title'] in seen_titles:
            continue
            
        seen_titles.add(cand['title'])
        filename = cand['filename']
        title = cand['title']
        
        # Create game object
        file_url = existing_files.get(filename, f"roms/mega-drive/{filename}")
        game = {
            "id": filename,
            "title": title,
            "platform": "Mega Drive",
            "year": "199X",
            "file": file_url,
            "cover": get_cover_url(title)
        }
        
        final_games.append(game)

# Sort alphabetically
final_games.sort(key=lambda x: x['title'])

with open(OUTPUT_FILE, 'w') as f:
    f.write("const gamesCatalog = ")
    json.dump(final_games, f, indent=4)
    f.write(";")

print(f"Generated {len(final_games)} unique games in {OUTPUT_FILE}")
