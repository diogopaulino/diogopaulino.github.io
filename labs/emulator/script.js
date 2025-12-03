const CATALOG = {
    megadrive: [
        { id: 'sonic', name: 'Sonic The Hedgehog', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%20%28USA%2C%20Europe%29.md' },
        { id: 'sonic2', name: 'Sonic 2', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%202%20%28World%29.md' },
        { id: 'sonic3', name: 'Sonic 3', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Sonic%20the%20Hedgehog%203%20%28USA%29.md' },
        { id: 'streets-of-rage', name: 'Streets of Rage', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%20%28USA%2C%20Europe%29.md' },
        { id: 'streets-of-rage-2', name: 'Streets of Rage 2', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Streets%20of%20Rage%202%20%28USA%29.md' },
        { id: 'golden-axe', name: 'Golden Axe', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Golden%20Axe%20%28World%29%20%28Rev%20A%29.md' },
        { id: 'mortal-kombat', name: 'Mortal Kombat', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%20%28World%29.md' },
        { id: 'mortal-kombat-2', name: 'Mortal Kombat II', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Mortal%20Kombat%20II%20%28World%29.md' },
        { id: 'altered-beast', name: 'Altered Beast', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Altered%20Beast%20%28USA%2C%20Europe%29.md' },
        { id: 'shinobi-3', name: 'Shinobi III', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Shinobi%20III%20-%20Return%20of%20the%20Ninja%20Master%20%28USA%29.md' },
        { id: 'aladdin', name: 'Aladdin', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Aladdin%20%28USA%29.md' },
        { id: 'lion-king', name: 'The Lion King', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Lion%20King%2C%20The%20%28World%29.md' },
        { id: 'earthworm-jim', name: 'Earthworm Jim', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Earthworm%20Jim%20%28USA%29.md' },
        { id: 'gunstar-heroes', name: 'Gunstar Heroes', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Gunstar%20Heroes%20%28USA%29.md' },
        { id: 'comix-zone', name: 'Comix Zone', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Comix%20Zone%20%28USA%29.md' },
        { id: 'road-rash-2', name: 'Road Rash II', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Road%20Rash%20II%20%28USA%2C%20Europe%29.md' },
        { id: 'nba-jam', name: 'NBA Jam', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/NBA%20Jam%20%28USA%2C%20Europe%29.md' },
        { id: 'vectorman', name: 'Vectorman', url: 'https://archive.org/download/sega-mega-drive-genesis-romset-ultra-usa/Vectorman%20%28USA%2C%20Europe%29.md' }
    ],
    snes: [
        { id: 'super-mario-world', name: 'Super Mario World', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Mario%20World%20%28USA%29.sfc' },
        { id: 'zelda-link-past', name: 'Zelda: A Link to the Past', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Legend%20of%20Zelda%2C%20The%20-%20A%20Link%20to%20the%20Past%20%28USA%29.sfc' },
        { id: 'super-metroid', name: 'Super Metroid', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Metroid%20%28USA%2C%20Europe%29%20%28En%2CJa%29.sfc' },
        { id: 'donkey-kong-country', name: 'Donkey Kong Country', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Donkey%20Kong%20Country%20%28USA%29%20%28Rev%202%29.sfc' },
        { id: 'donkey-kong-country-2', name: 'Donkey Kong Country 2', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Donkey%20Kong%20Country%202%20-%20Diddy%27s%20Kong%20Quest%20%28USA%29%20%28Rev%201%29.sfc' },
        { id: 'chrono-trigger', name: 'Chrono Trigger', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Chrono%20Trigger%20%28USA%29.sfc' },
        { id: 'super-mario-kart', name: 'Super Mario Kart', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Mario%20Kart%20%28USA%29.sfc' },
        { id: 'street-fighter-2-turbo', name: 'Street Fighter II Turbo', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Street%20Fighter%20II%20Turbo%20-%20Hyper%20Fighting%20%28USA%29.sfc' },
        { id: 'mortal-kombat-snes', name: 'Mortal Kombat', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mortal%20Kombat%20%28USA%29.sfc' },
        { id: 'mortal-kombat-2-snes', name: 'Mortal Kombat II', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mortal%20Kombat%20II%20%28USA%29.sfc' },
        { id: 'final-fantasy-6', name: 'Final Fantasy III', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Final%20Fantasy%20III%20%28USA%29.sfc' },
        { id: 'mega-man-x', name: 'Mega Man X', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mega%20Man%20X%20%28USA%29.sfc' },
        { id: 'mega-man-x2', name: 'Mega Man X2', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Mega%20Man%20X2%20%28USA%29.sfc' },
        { id: 'super-castlevania-4', name: 'Super Castlevania IV', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Super%20Castlevania%20IV%20%28USA%29.sfc' },
        { id: 'contra-3', name: 'Contra III', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Contra%20III%20-%20The%20Alien%20Wars%20%28USA%29.sfc' },
        { id: 'f-zero', name: 'F-Zero', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/F-Zero%20%28USA%29.sfc' },
        { id: 'earthbound', name: 'EarthBound', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/EarthBound%20%28USA%29.sfc' },
        { id: 'secret-of-mana', name: 'Secret of Mana', url: 'https://archive.org/download/super-nintendo-romset-ultra-usa/Secret%20of%20Mana%20%28USA%29.sfc' }
    ]
};

let emu = null;
let activeConsole = 'megadrive';

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function render() {
    const games = CATALOG[activeConsole];
    $('#games').innerHTML = games.map(g => `
        <a href="#${activeConsole}/${g.id}" class="game">${g.name}</a>
    `).join('');
}

function showCatalog() {
    $('#catalog').classList.remove('hidden');
    $('#player').classList.add('hidden');
    stopEmu();
}

function showPlayer(name) {
    $('#catalog').classList.add('hidden');
    $('#player').classList.remove('hidden');
    $('#game-name').textContent = name;
}

function showLoader(v) {
    $('#loader').classList.toggle('hidden', !v);
}

async function stopEmu() {
    if (emu) {
        try { await emu.exit(); } catch(e) {}
        emu = null;
    }
    $('#screen').innerHTML = '';
}

async function play(rom, name, console) {
    showPlayer(name);
    showLoader(true);
    
    try {
        await stopEmu();
        
        const base = location.href.split('#')[0];
        const path = base.substring(0, base.lastIndexOf('/') + 1);
        const core = console === 'snes' ? 'snes9x' : 'genesis_plus_gx';
        
        emu = await Nostalgist.launch({
            core,
            rom,
            resolveCoreJs: (c) => path + 'lib/' + c + '_libretro.js',
            resolveCoreWasm: (c) => path + 'lib/' + c + '_libretro.wasm'
        });
        
        const canvas = emu.getCanvas();
        if (canvas) {
            $('#screen').innerHTML = '';
            $('#screen').appendChild(canvas);
        }
        
        showLoader(false);
    } catch (err) {
        console.error(err);
        showLoader(false);
        $('#screen').innerHTML = `<div class="err"><p>Erro: ${err.message}</p><button onclick="location.hash=''">Voltar</button></div>`;
    }
}

function route() {
    const hash = location.hash.slice(1);
    if (!hash) return showCatalog();
    
    const [con, id] = hash.split('/');
    if (!con || !id) return showCatalog();
    
    const games = CATALOG[con];
    const game = games?.find(g => g.id === id);
    
    if (game) {
        activeConsole = con;
        $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.console === con));
        play(game.url, game.name, con);
    } else {
        showCatalog();
    }
}

function init() {
    $$('.tab').forEach(t => {
        t.onclick = () => {
            activeConsole = t.dataset.console;
            $$('.tab').forEach(b => b.classList.toggle('active', b === t));
            render();
        };
    });
    
    $('#btn-back').onclick = () => location.hash = '';
    $('#btn-fs').onclick = () => {
        const w = $('.emulator-wrapper') || $('#screen');
        document.fullscreenElement ? document.exitFullscreen() : w.requestFullscreen?.();
    };
    
    const fileInput = $('#rom-file');
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const ext = file.name.toLowerCase();
        const isSnes = ext.endsWith('.sfc') || ext.endsWith('.smc');
        const con = isSnes ? 'snes' : 'megadrive';
        const name = file.name.replace(/\.[^/.]+$/, '');
        
        play(file, name, con);
    };
    
    document.onkeydown = (e) => {
        if (e.key === 'Escape') location.hash = '';
    };
    
    window.onhashchange = route;
    render();
    route();
}

document.addEventListener('DOMContentLoaded', init);
