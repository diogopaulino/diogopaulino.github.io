import os
import json
import re
import urllib.parse

ROM_DIR = 'labs/videogame/roms/mega-drive'
OUTPUT_FILE = 'labs/videogame/games.js'

# Massive mapping based on common 8.3 filenames found in ROM sets
NAME_MAP = {
    "ADDAM": "The Addams Family",
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
    "BB-ROAR": "The Berenstain Bears' Camping Adventure",
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
    "CHAOSENG": "The Chaos Engine",
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
    "DARKWATR": "The Pirates of Dark Water",
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
    "FLINT": "The Flintstones",
    "FSTONES": "The Flintstones",
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
    "HULK": "The Incredible Hulk",
    "HUMANS": "The Humans",
    "IMMORTAL": "The Immortal",
    "INSECTOR": "Insector X",
    "INSECTOX": "Insector X",
    "JAMES": "James Pond",
    "JIMPOWER": "Jim Power - The Arcade Game",
    "JOE": "Joe & Mac",
    "JOEMAC": "Joe & Mac",
    "JUNGLE": "The Jungle Book",
    "JUNGLEBO": "The Jungle Book",
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
    "LOST": "The Lost Vikings",
    "LOTUS": "Lotus Turbo Challenge",
    "LOTUS2": "Lotus II",
    "LVIKINGS": "The Lost Vikings",
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
    "MSFRANK": "The Adventures of Mighty Max",
    "MSPACMAN": "Ms. Pac-Man",
    "MUSHA": "M.U.S.H.A.",
    "NBA": "NBA Jam",
    "NBAL": "NBA Live 95",
    "NHL": "NHL Hockey",
    "NHL97": "NHL 97",
    "NINJA": "The Revenge of Shinobi",
    "NORMY": "Normy's Beach Babe-O-Rama",
    "NZ-STORY": "The NewZealand Story",
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
    "PIRA": "Pirates of Dark Water",
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
    "RSHINOBI": "The Revenge of Shinobi",
    "SAMURAI": "Samurai Shodown",
    "SBEAST2": "Shadow of the Beast II",
    "SECSAMUR": "Second Samurai",
    "SFORCE2": "Shining Force II",
    "SHADOW": "Shadow Dancer - The Secret of Shinobi",
    "SHARRIE2": "Space Harrier II",
    "SHDANCER": "Shadow Dancer - The Secret of Shinobi",
    "SHINING": "Shining Force",
    "SHINOBI": "The Revenge of Shinobi",
    "SHINOBI3": "Shinobi III - Return of the Ninja Master",
    "SKELETON": "Skeleton Krew",
    "SKITCHIN": "Skitchin'",
    "SMASHTV": "Smash TV",
    "SMURFS": "The Smurfs",
    "SMURFS2": "The Smurfs 2",
    "SNOWBRO": "Snow Bros. - Nick & Tom",
    "SOLDEACE": "Sol-Deace",
    "SONIC": "Sonic the Hedgehog",
    "SONIC1": "Sonic the Hedgehog",
    "SONIC2": "Sonic the Hedgehog 2",
    "SONIC3": "Sonic the Hedgehog 3",
    "SONIC3D": "Sonic 3D Blast",
    "SONICK": "Sonic & Knuckles",
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
    "TWINHAWK": "Twin Cobra",
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
    "ZOOL": "Zool",
    "ZOOP": "Zoop"
}

def clean_name(filename):
    base = os.path.splitext(filename)[0].upper()
    base_clean = re.sub(r'~\d+', '', base)
    
    for key, val in NAME_MAP.items():
        if base.startswith(key) or base_clean.startswith(key):
            return val

    name = os.path.splitext(filename)[0]
    name = re.sub(r'~\d+', '', name)
    name = name.replace('_', ' ').replace('.', ' ')
    name = re.sub(r'([a-zA-Z])(\d)', r'\1 \2', name)
    return name.title()

def get_cover_url(title):
    # Use Libretro Thumbnails
    # Correct format: "Name (Region)" with SPACE before parenthesis.
    # Special chars: : -> _, / -> _, ? -> _
    # Single quotes are usually KEPT in Libretro filenames (e.g. Disney's Aladdin)
    
    safe_title = title.replace(':', '_').replace('/', '_').replace('?', '_')
    
    # URL Encode the title (spaces become %20, ' becomes %27 or stays ' depending on implementation, 
    # but we want to be careful. urllib.parse.quote does NOT encode ' by default)
    encoded_title = urllib.parse.quote(safe_title)
    
    # Append region. Note the space before (USA).
    return f"https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/{encoded_title}%20(USA).png"

# Group games by title to remove duplicates
games_by_title = {}

if os.path.exists(ROM_DIR):
    for filename in sorted(os.listdir(ROM_DIR)):
        if filename.lower().endswith(('.zip', '.md', '.bin', '.smd', '.gen')):
            title = clean_name(filename)
            
            # Create game object
            game = {
                "id": filename,
                "title": title,
                "platform": "Mega Drive",
                "year": "199X",
                "file": f"roms/mega-drive/{filename}",
                "cover": get_cover_url(title)
            }
            
            if title not in games_by_title:
                games_by_title[title] = []
            
            games_by_title[title].append(game)

# Select the best version for each title
final_games = []

for title, candidates in games_by_title.items():
    if len(candidates) == 1:
        final_games.append(candidates[0])
    else:
        # Heuristic to pick best version
        # 1. Prefer filenames with (USA) or (U)
        # 2. Prefer filenames with (World) or (W)
        # 3. Prefer filenames with [!] (GoodDump)
        # 4. Prefer latest revision (Rev 1, Rev A) - hard to detect in 8.3 but we try
        
        best = candidates[0]
        best_score = -1
        
        for cand in candidates:
            score = 0
            fname = cand['id'].upper()
            
            if '(USA)' in fname or '(U)' in fname: score += 10
            if '(WORLD)' in fname or '(W)' in fname: score += 8
            if '(EUROPE)' in fname or '(E)' in fname: score += 5
            if '[!]' in fname: score += 2
            
            if score > best_score:
                best_score = score
                best = cand
        
        final_games.append(best)

# Sort alphabetically
final_games.sort(key=lambda x: x['title'])

with open(OUTPUT_FILE, 'w') as f:
    f.write("const gamesCatalog = ")
    json.dump(final_games, f, indent=4)
    f.write(";")

print(f"Generated {len(final_games)} unique games in {OUTPUT_FILE}")
