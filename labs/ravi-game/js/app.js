const gameState = {
  vehicle: null,
  marketItems: [],
  factoryToys: [],
  invites: []
};

function getApp() {
  return document.getElementById('game-container');
}

// --- Cenas ---

function renderHUD() {
  return `
    <div class="hud">
      <div class="hud-pill">Mochila: ${gameState.marketItems.length + gameState.factoryToys.length}</div>
      <div class="hud-pill">Convidados: ${gameState.invites.length}/3</div>
    </div>
  `;
}

function renderStart() {
  getApp().innerHTML = `
    <div class="scene active" style="background: linear-gradient(135deg, var(--neon-purple), var(--bg-dark));">
      <div class="flex-center">
        <div class="character"></div>
        <div class="glass-panel">
          <h1>Aniversário do Ravi</h1>
          <p>Ajude o Ravi a preparar a melhor festa dos anos 90!</p>
          <button class="btn-retro" onclick="changeScene('garage')">Começar Aventura</button>
        </div>
      </div>
    </div>
  `;
}

function renderGarage() {
  getApp().innerHTML = `
    ${renderHUD()}
    <div class="scene active" style="background: linear-gradient(135deg, var(--bg-dark), var(--neon-blue));">
      <div class="flex-center">
        <div class="glass-panel">
          <h2>Cena 1: A Garagem</h2>
          <p>Como vamos sair hoje?</p>
          <div class="flex-row">
            <button class="btn-choice" onclick="selectVehicle('🛹 Skate Neon')">🛹 Skate Neon</button>
            <button class="btn-choice" onclick="selectVehicle('🚲 Monark')">🚲 Bicicleta</button>
            <button class="btn-choice" onclick="selectVehicle('🚗 Velotrol')">🚗 Velotrol</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderMarket() {
  const items = [
    { id: 'bolo', icon: '🎂' },
    { id: 'refri', icon: '🥤' },
    { id: 'salgado', icon: '🍕' },
    { id: 'doce', icon: '🍬' }
  ];
  
  getApp().innerHTML = `
    ${renderHUD()}
    <div class="scene active" style="background-image: url('assets/img/market_bg.jpg');">
      <div class="flex-center" style="background: rgba(0,0,0,0.5);">
        <div class="glass-panel">
          <h2>Cena 2: O Mercado</h2>
          <p>Pegue os 4 itens para a festa!</p>
          <div class="flex-row" id="market-items">
            ${items.map(item => `
              <div class="collectible" onclick="collectMarketItem('${item.id}', this)">${item.icon}</div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderFactory() {
  const toys = [
    { id: 'ioio', icon: '🪀' },
    { id: 'urso', icon: '🧸' },
    { id: 'cubo', icon: '🧩' }
  ];
  
  getApp().innerHTML = `
    ${renderHUD()}
    <div class="scene active" style="background-image: url('assets/img/factory_bg.jpg');">
      <div class="flex-center" style="background: rgba(0,0,0,0.5);">
        <div class="glass-panel">
          <h2>Cena 3: Fábrica de Brinquedos</h2>
          <p>Colete 3 lembrancinhas para os amigos!</p>
          <div class="flex-row" id="factory-items">
             ${toys.map(item => `
              <div class="collectible" onclick="collectFactoryItem('${item.id}', this)">${item.icon}</div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderInvites() {
  const friends = [
    { id: 'dog', icon: '🐶' },
    { id: 'cat', icon: '😺' },
    { id: 'bird', icon: '🐦' }
  ];
  
  getApp().innerHTML = `
    ${renderHUD()}
    <div class="scene active" style="background: linear-gradient(135deg, var(--neon-green), var(--bg-dark));">
      <div class="flex-center">
        <div class="glass-panel">
          <h2>Cena 4: Entregando Convites</h2>
          <p>Convide os animais da rua!</p>
          <div class="flex-row" id="invite-items">
             ${friends.map(item => `
              <div class="collectible" onclick="inviteFriend('${item.id}', this)">${item.icon}</div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderParty() {
  getApp().innerHTML = `
    <div class="scene active" style="background-image: url('assets/img/party_bg.jpg');">
      <div class="flex-center" style="background: rgba(0,0,0,0.6);">
        <div class="character"></div>
        <div class="glass-panel" style="border-color: var(--neon-pink)">
          <h1 style="font-size: 30px;">Feliz Aniversário Ravi!</h1>
          <p>A festa está incrível!</p>
          <p style="font-size: 14px; color: var(--neon-yellow);">Você chegou de ${gameState.vehicle} e trouxe:</p>
          <div style="font-size: 24px; margin-top: 10px;">
            🎂🥤🍕🍬 🪀🧸🧩 🐶😺🐦
          </div>
          <button class="btn-retro" onclick="location.reload()" style="margin-top: 20px;">Jogar Novamente</button>
        </div>
      </div>
    </div>
  `;
  createConfetti();
}

// --- Funções de Lógica ---
window.changeScene = function(scene) {
  if (scene === 'garage') renderGarage();
  if (scene === 'market') renderMarket();
  if (scene === 'factory') renderFactory();
  if (scene === 'invites') renderInvites();
  if (scene === 'party') renderParty();
}

window.selectVehicle = function(v) {
  gameState.vehicle = v;
  window.changeScene('market');
}

window.collectMarketItem = function(id, el) {
  if (!gameState.marketItems.includes(id)) {
    gameState.marketItems.push(id);
    el.style.visibility = 'hidden';
    updateHUD();
    if (gameState.marketItems.length === 4) {
      setTimeout(() => window.changeScene('factory'), 500);
    }
  }
}

window.collectFactoryItem = function(id, el) {
  if (!gameState.factoryToys.includes(id)) {
    gameState.factoryToys.push(id);
    el.style.visibility = 'hidden';
    updateHUD();
    if (gameState.factoryToys.length === 3) {
      setTimeout(() => window.changeScene('invites'), 500);
    }
  }
}

window.inviteFriend = function(id, el) {
  if (!gameState.invites.includes(id)) {
    gameState.invites.push(id);
    el.style.visibility = 'hidden';
    updateHUD();
    if (gameState.invites.length === 3) {
      setTimeout(() => window.changeScene('party'), 500);
    }
  }
}

function updateHUD() {
  const hud = document.querySelector('.hud');
  if (hud) {
    hud.outerHTML = renderHUD();
  }
}

function createConfetti() {
  const colors = ['#FF007F', '#00F0FF', '#39FF14', '#FFFF00', '#9D00FF'];
  for (let i = 0; i < 100; i++) {
    const conf = document.createElement('div');
    conf.classList.add('confetti');
    conf.style.left = Math.random() * 100 + 'vw';
    conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    conf.style.animation = \`fall \${Math.random() * 3 + 2}s linear forwards\`;
    conf.style.animationDelay = Math.random() * 2 + 's';
    document.body.appendChild(conf);
  }
  
  const style = document.createElement('style');
  style.innerHTML = \`
    @keyframes fall {
      0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
  \`;
  document.head.appendChild(style);
}

function initGame() {
  if (getApp()) {
    renderStart();
  } else {
    console.error("game-container não encontrado");
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initGame);
} else {
  initGame();
}
