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
    "JOEMAC": "Joe & Mac",
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
    "PUNISHER": "Punisher, The",
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
    "SMURFS": "The Smurfs",
    "SMURFS2": "The Smurfs 2",
    "SNOWBRO": "Snow Bros. - Nick & Tom",
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
    "TERMINAT": "Terminator, The",
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
    "TOM&": "Tom & Jerry - Frantic Antics",
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
    "SONICK": "Sonic & Knuckles",
    "ARCAD~12": "Arcade Classics",
    "BLAS~130": "Blaster Master 2",
    "BOOG~140": "Boogerman - A Pick and Flick Adventure",
    "BUBB~144": "Bubble and Squeak",
    "CANN~154": "Cannon Fodder",
    "CHIC~170": "Chicago Syndicate",
    "DANG~194": "Dangerous Seed",
    "FATA~214": "Fatal Fury",
    "GARG~226": "Gargoyles",
    "GAUNTL~1": "Gauntlet IV",
    "MAZI~280": "Mazin Saga - Mutant Fighter",
    "MICK~286": "Mickey Mania - The Timeless Adventures of Mickey Mouse",
    "NBAL~300": "NBA Live 95",
    "PINO~316": "Pinocchio",
    "PITFIG~1": "Pit-Fighter",
    "POPU~322": "Populous",
    "RMON~346": "Rocket Knight Adventures",
    "ROLL~350": "Rolling Thunder 2",
    "SPEEDY~1": "Speedy Gonzales - Cheez Cat-astrophe",
    "STORM~62": "Stormlord",
    "SUPERH~1": "Super Hang-On",
    "SYND~404": "Syndicate",
    "ADDAM~74": "Addams Family, The",
    "TTAL~430": "Tiny Toon Adventures - Acme All-Stars",
    "TOEJ~418": "ToeJam & Earl",
    "TOM&~422": "Tom & Jerry - Frantic Antics",
    "VIRTU~68": "Virtua Racing",
    "WOLF~450": "Wolfchild",
    "KLAX_~36": "Klax",
    "LOST~270": "Lost Vikings, The",
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
    "Bubsy in Claws Encounters of the Furred Kind": "Europe",
    "Fantasia": "Japan",
    "Granada": "Japan",
    "Herzog Zwei": "Europe",
    "Lotus Turbo Challenge": "Europe",
    "Madden NFL '94": "Europe",
    "Mortal Kombat": "Europe",
    "Mortal Kombat II": "Europe",
    "Ms. Pac-Man": "Europe",
    "NBA Jam": "Japan",
    "Paperboy": "Europe",
    "Predator 2": "Europe",
    "Spider-Man": "World",
    "Vectorman": "Europe",
    "Bloodshot": "Europe",
    "Mega Panel": "Japan",
    "El Viento": "USA", # Verify if USA exists, else Japan
    "Daffy Duck in Hollywood": "Europe", # Already there
    "Twin Hawk": "Europe", # Already there
    "Smurfs, The": "Europe",
    "The Smurfs": "Europe",
    "Smurfs 2, The": "Europe",
    "The Smurfs 2": "Europe",
    "Baby's Day Out": "USA",
    "Bio-Hazard Battle": "USA",
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

def get_cover_urls(title):
    base_url = 'https://raw.githubusercontent.com/libretro-thumbnails/Sega_-_Mega_Drive_-_Genesis/master/Named_Boxarts/'
    
    safe_title = title.replace(':', '_').replace('/', '_').replace('?', '_').replace('*', '_')
    
    title_variations = [safe_title]
    
    if "&" in safe_title:
        title_variations.append(safe_title.replace("&", " and "))
        title_variations.append(safe_title.replace("&", " _ "))
    
    if " _ " in safe_title:
        title_variations.append(safe_title.replace(" _ ", " & "))
        title_variations.append(safe_title.replace(" _ ", " and "))
        title_variations.append(safe_title.replace(" _ ", " "))
    
    if safe_title.endswith('.'):
        title_variations.append(safe_title.rstrip('.'))
    
    if '.' in safe_title:
        title_variations.append(safe_title.replace('.', ''))
        title_variations.append(safe_title.replace('.', ' '))
    
    if "Disney's" in safe_title:
        without_disney = safe_title.replace("Disney's ", "").replace("Disney's", "").strip()
        title_variations.append(without_disney)
        title_variations.append(safe_title.replace("Disney's ", "Disney "))
        if without_disney.startswith("The "):
            title_variations.append(without_disney[4:] + ", The")
            title_variations.append(without_disney[4:])
        elif without_disney.endswith(", The"):
            title_variations.append("The " + without_disney[:-5])
            title_variations.append(without_disney[:-5])
    
    if safe_title.startswith("The "):
        without_the = safe_title[4:].strip()
        title_variations.append(without_the + ", The")
        title_variations.append(without_the)
    
    if safe_title.endswith(", The"):
        with_the = "The " + safe_title[:-5].strip()
        title_variations.append(with_the)
        title_variations.append(safe_title[:-5].strip())
    
    if " and " in safe_title:
        title_variations.append(safe_title.replace(" and ", " & "))
    
    if " & " in safe_title:
        title_variations.append(safe_title.replace(" & ", " and "))
    
    if "-" in safe_title:
        title_variations.append(safe_title.replace(" - ", " ").replace("-", " "))
        title_variations.append(safe_title.replace(" - ", ": ").replace("-", ":"))
        title_variations.append(safe_title.replace(" - ", "").replace("-", ""))
    
    if ":" in safe_title:
        title_variations.append(safe_title.replace(":", " -").replace(" -", " - "))
        title_variations.append(safe_title.replace(":", ""))
    
    if " vs. " in safe_title:
        title_variations.append(safe_title.replace(" vs. ", " vs "))
        title_variations.append(safe_title.replace(" vs. ", " vs. "))
    
    if " vs " in safe_title:
        title_variations.append(safe_title.replace(" vs ", " vs. "))
    
    title_variations = list(dict.fromkeys([v for v in title_variations if v]))
    
    special_cases = {
        "Power Rangers": ["Mighty Morphin Power Rangers", "Power Rangers - The Movie", "Mighty Morphin' Power Rangers"],
        "Super Mario Bros.": ["Super Mario Bros", "Super Mario World", "Mario Bros"],
        "Super Mario Bros": ["Super Mario World", "Mario Bros"],
        "Alien 3": ["Alien 3", "Alien³", "Alien III"],
        "Altered Beast": ["Altered Beast"],
        "Chakan - The Forever Man": ["Chakan The Forever Man", "Chakan - The Forever Man"],
        "ESWAT - City Under Siege": ["ESWAT City Under Siege", "ESWAT - City Under Siege"],
        "Desert Strike - Return to the Gulf": ["Desert Strike Return to the Gulf", "Desert Strike - Return to the Gulf"],
        "Caliber .50": ["Caliber 50", "Caliber .50", "Caliber 50"],
        "B.O.B.": ["B.O.B", "B.O.B.", "BOB"],
        "Ecco Jr.": ["Ecco Jr", "Ecco Jr."],
        "Snow Bros. - Nick _ Tom": ["Snow Bros. - Nick & Tom", "Snow Bros - Nick & Tom", "Snow Bros - Nick and Tom"],
        "The Smurfs": ["Smurfs, The", "The Smurfs", "Smurfs"],
        "The Smurfs 2": ["Smurfs 2, The", "The Smurfs 2", "Smurfs 2"],
        "The Chaos Engine 2": ["Chaos Engine 2, The", "The Chaos Engine 2", "Chaos Engine 2"],
        "The Aquatic Games": ["Aquatic Games, The", "The Aquatic Games", "Aquatic Games"],
        "The Simpsons - Bart's Nightmare": ["Simpsons - Bart's Nightmare, The", "The Simpsons - Bart's Nightmare"],
        "The Simpsons - Bart vs. the Space Mutants": ["Simpsons - Bart vs. the Space Mutants, The", "The Simpsons - Bart vs. the Space Mutants"],
        "The Lion King": ["Lion King, The", "The Lion King", "Lion King"],
        "The Adventures of Batman _ Robin": ["Adventures of Batman & Robin, The", "The Adventures of Batman & Robin"],
        "Tom _ Jerry": ["Tom & Jerry", "Tom and Jerry"],
        "Tom _ Jerry - Frantic Antics": ["Tom & Jerry - Frantic Antics", "Tom and Jerry - Frantic Antics"],
        "Sylvester and Tweety in Cagey Capers": ["Sylvester & Tweety in Cagey Capers", "Sylvester and Tweety in Cagey Capers"],
        "Speedy Gonzales - Cheez Cat-astrophe": ["Speedy Gonzales Cheez Cat astrophe", "Speedy Gonzales - Cheez Cat-astrophe"],
        "RoboCop vs. The Terminator": ["RoboCop vs The Terminator", "RoboCop vs. The Terminator"],
        "Street Fighter II - Special Champion Edition": ["Street Fighter II Special Champion Edition", "Street Fighter II - Special Champion Edition"],
        "Rainbow Islands - The Story of Bubble Bobble 2": ["Rainbow Islands The Story of Bubble Bobble 2", "Rainbow Islands - The Story of Bubble Bobble 2"],
        "Pitfall! - The Mayan Adventure": ["Pitfall! The Mayan Adventure", "Pitfall! - The Mayan Adventure"],
        "Jim Power - The Arcade Game": ["Jim Power The Arcade Game", "Jim Power - The Arcade Game"],
        "Contra - Hard Corps": ["Contra Hard Corps", "Contra - Hard Corps"],
        "Bio-Ship Paladin": ["Bio Ship Paladin", "Bio-Ship Paladin"],
        "M.U.S.H.A.": ["M.U.S.H.A", "M.U.S.H.A.", "MUSHA"],
        "James Pond II - Codename RoboCod": ["James Pond II Codename RoboCod", "James Pond II - Codename RoboCod"],
    }
    
    special_variations = []
    for key, variations in special_cases.items():
        if key.lower() in title.lower():
            special_variations.extend(variations)
    
    if special_variations:
        title_variations = special_variations + title_variations
    
    title_variations = list(dict.fromkeys([v for v in title_variations if v]))
    
    primary_region = REGION_MAP.get(title, "USA")
    all_regions = [primary_region, "USA", "Europe", "Japan", "World"]
    unique_regions = []
    for r in all_regions:
        if r not in unique_regions:
            unique_regions.append(r)
    
    urls = []
    for title_var in title_variations:
        for region in unique_regions:
            full_name = f"{title_var} ({region})"
            encoded_name = urllib.parse.quote(full_name, safe='')
            urls.append(f"{base_url}{encoded_name}.png")
            
            full_name_en = f"{title_var} ({region}, En)"
            encoded_name_en = urllib.parse.quote(full_name_en, safe='')
            urls.append(f"{base_url}{encoded_name_en}.png")
        
        urls.append(f"{base_url}{urllib.parse.quote(title_var, safe='')}.png")
    
    return list(dict.fromkeys(urls))

# Create game list directly
final_games = []
seen_titles = set()

# Load existing games to preserve file URLs
existing_files = {}
existing_games = []

if os.path.exists(OUTPUT_FILE):
    try:
        with open(OUTPUT_FILE, 'r') as f:
            content = f.read()
            json_str = re.sub(r'^const\s+gamesCatalog\s*=\s*', '', content).strip().rstrip(';')
            existing_games = json.loads(json_str)
            for g in existing_games:
                file_url = g['file']
                if 'cdn.jsdelivr.net/gh/' in file_url:
                    file_url = file_url.replace('https://cdn.jsdelivr.net/gh/', 'https://raw.githubusercontent.com/').replace('@master', '/master')
                if 'raw.githubusercontent.com/retrobrews/md-games' in file_url:
                    supabase_base = "https://qfsxjpxkihnrcqpomrkw.supabase.co/storage/v1/object/public/game/mega-drive"
                    filename = g['id']
                    file_url = f"{supabase_base}/{urllib.parse.quote(filename)}"
                existing_files[g['id']] = file_url
                existing_files[g['id'].lower()] = file_url
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
        file_url = existing_files.get(filename, existing_files.get(filename.lower(), f"roms/mega-drive/{filename}"))
        cover_urls = get_cover_urls(title)
        game = {
            "id": filename,
            "title": title,
            "platform": "Mega Drive",
            "year": "199X",
            "file": file_url,
            "cover": cover_urls[0] if cover_urls else "",
            "coverUrls": cover_urls
        }
        
        final_games.append(game)

# Third pass: Add missing games from NAME_MAP
# This ensures the catalog is full even if local files were deleted/moved
for key, title in NAME_MAP.items():
    if title in seen_titles:
        continue
        
    filename = f"{key.lower()}.zip"
    
    file_url = existing_files.get(filename, existing_files.get(filename.lower()))
    
    if not file_url:
        supabase_base = "https://qfsxjpxkihnrcqpomrkw.supabase.co/storage/v1/object/public/game/mega-drive"
        file_url = f"{supabase_base}/{urllib.parse.quote(filename)}"
    
    seen_titles.add(title)
    cover_urls = get_cover_urls(title)
    game = {
        "id": filename,
        "title": title,
        "platform": "Mega Drive",
        "year": "199X",
        "file": file_url,
        "cover": cover_urls[0] if cover_urls else "",
        "coverUrls": cover_urls
    }
    final_games.append(game)

# Fourth pass: Preserve existing games that are not in local ROMs or NAME_MAP
# This ensures we don't lose games that were manually added or have IDs not in NAME_MAP
for g in existing_games:
    if g['title'] in seen_titles:
        continue
    
    # Only preserve if it has a remote URL
    if g['file'].startswith(('http:', 'https:')):
        if 'coverUrls' not in g:
            cover_urls = get_cover_urls(g['title'])
            g['coverUrls'] = cover_urls
            if not g.get('cover') and cover_urls:
                g['cover'] = cover_urls[0]
        seen_titles.add(g['title'])
        final_games.append(g)

# Sort alphabetically
final_games.sort(key=lambda x: x['title'])

with open(OUTPUT_FILE, 'w') as f:
    f.write("const gamesCatalog = ")
    json.dump(final_games, f, indent=4)
    f.write(";")

print(f"Generated {len(final_games)} unique games in {OUTPUT_FILE}")
