const WEBAMP_MODULE_URL =
    "https://unpkg.com/webamp@2.3.1/built/webamp.butterchurn-bundle.min.mjs";
let Webamp;

try {
    ({ default: Webamp } = await import(WEBAMP_MODULE_URL));
} catch (error) {
    window.clearTimeout(window.__winampBootTimer);
    const message = document.querySelector("#loading-window p");
    if (message) {
        message.textContent =
            "Não foi possível baixar o player. Atualize a página ou tente novamente em alguns instantes.";
    }
    console.error("Falha ao carregar o núcleo do Winamp.", error);
    throw error;
}

const MUSIC_ROOT =
    "https://raw.githubusercontent.com/captbaritone/webamp-music/4b556fbf";

const DEMO_TRACKS = [
    {
        url: `${MUSIC_ROOT}/Diablo_Swing_Orchestra_-_01_-_Heroines.mp3`,
        duration: 322.612245,
        metaData: {
            artist: "Diablo Swing Orchestra",
            title: "Heroines",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Eclectek_-_02_-_We_Are_Going_To_Eclecfunk_Your_Ass.mp3`,
        duration: 190.093061,
        metaData: {
            artist: "Eclectek",
            title: "We Are Going To Eclecfunk Your Ass",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Auto-Pilot_-_03_-_Seventeen.mp3`,
        duration: 214.622041,
        metaData: {
            artist: "Auto-Pilot",
            title: "Seventeen",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Muha_-_04_-_Microphone.mp3`,
        duration: 181.838367,
        metaData: {
            artist: "Muha",
            title: "Microphone",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Just_Plain_Ant_-_05_-_Stumble.mp3`,
        duration: 86.047347,
        metaData: {
            artist: "Just Plain Ant",
            title: "Stumble",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Juanitos_-_07_-_Hola_Hola_Bossa_Nova.mp3`,
        duration: 207.072653,
        metaData: {
            artist: "Juanitos",
            title: "Hola Hola Bossa Nova",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Nobara_Hayakawa_-_09_-_Trail.mp3`,
        duration: 204.042449,
        metaData: {
            artist: "Nobara Hayakawa",
            title: "Trail",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    },
    {
        url: `${MUSIC_ROOT}/Paper_Navy_-_10_-_Tongue_Tied.mp3`,
        duration: 201.116735,
        metaData: {
            artist: "Paper Navy",
            title: "Tongue Tied",
            album: "netBloc Vol. 24: tiuqottigeloot"
        }
    }
];

const SKINS = {
    classic: {
        name: "Winamp Base 2.91",
        url: "https://cdn.jsdelivr.net/gh/captbaritone/webamp@0882aa7a312e671934d8ab04bc195f538e8c58a9/packages/webamp/assets/skins/base-2.91.wsz"
    },
    green: {
        name: "Green Dimension V2",
        url: "https://archive.org/cors/winampskin_Green-Dimension-V2/Green-Dimension-V2.wsz"
    },
    aqua: {
        name: "Mac OS X v1.5 (Aqua)",
        url: "https://archive.org/cors/winampskin_mac_os_x_1_5-aqua/mac_os_x_1_5-aqua.wsz"
    },
    zelda: {
        name: "Zelda Amp",
        url: "https://archive.org/cors/winampskin_Zelda_Amp/Zelda-Amp.wsz"
    }
};

const isCompact = window.matchMedia("(max-width: 760px)").matches;
const root = document.documentElement;
const stage = document.getElementById("winamp-stage");
const loader = document.getElementById("loading-window");
const tip = document.getElementById("desktop-tip");
const audioInput = document.getElementById("audio-file-input");
const skinsDialog = document.getElementById("skins-dialog");
const helpDialog = document.getElementById("help-dialog");
const dropOverlay = document.getElementById("drop-overlay");
const taskButton = document.getElementById("winamp-task");
const clock = document.getElementById("system-clock");

const desktopLayout = {
    main: {
        position: { left: 0, top: 0 },
        shadeMode: false,
        closed: false
    },
    equalizer: {
        position: { left: 0, top: 232 },
        shadeMode: false,
        closed: false
    },
    playlist: {
        position: { left: 550, top: 0 },
        size: { extraWidth: 11, extraHeight: 12 },
        shadeMode: false,
        closed: false
    },
    milkdrop: {
        position: { left: 550, top: 0 },
        size: { extraWidth: 11, extraHeight: 12 },
        closed: true
    }
};

const compactLayout = {
    main: {
        position: { left: 0, top: 0 },
        shadeMode: false,
        closed: false
    },
    equalizer: {
        position: { left: 0, top: 232 },
        shadeMode: false,
        closed: false
    },
    playlist: {
        position: { left: 0, top: 464 },
        size: { extraWidth: 11, extraHeight: 7 },
        shadeMode: false,
        closed: false
    },
    milkdrop: {
        position: { left: 0, top: 464 },
        size: { extraWidth: 11, extraHeight: 7 },
        closed: true
    }
};

function showTip(message, duration = 4200) {
    tip.textContent = message;
    tip.classList.remove("is-hidden");
    window.clearTimeout(showTip.timeoutId);
    showTip.timeoutId = window.setTimeout(() => {
        tip.classList.add("is-hidden");
    }, duration);
}

function fitPlayer() {
    const stageWidth = isCompact ? 550 : 1100;
    const stageHeight = isCompact ? 783 : 464;
    const iconRail = isCompact ? 84 : 132;
    const horizontalRoom = Math.max(260, window.innerWidth - iconRail - 18);
    const verticalRoom = Math.max(250, window.innerHeight - 58);
    const scale = Math.min(1, horizontalRoom / stageWidth, verticalRoom / stageHeight);

    root.style.setProperty("--player-scale", String(Math.max(0.36, scale)));
}

function updateClock() {
    clock.textContent = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    }).format(new Date());
}

function openDialog(dialog) {
    if (!dialog.open) {
        dialog.showModal();
    }
}

function closeDialog(button) {
    button.closest("dialog")?.close();
}

function tracksFromFiles(files) {
    return Array.from(files)
        .filter((file) => file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name))
        .map((file) => ({
            blob: file,
            defaultName: file.name.replace(/\.[^.]+$/, "")
        }));
}

const webamp = new Webamp({
    initialTracks: DEMO_TRACKS,
    availableSkins: Object.values(SKINS),
    windowLayout: isCompact ? compactLayout : desktopLayout,
    enableDoubleSizeMode: true,
    enableHotkeys: true,
    enableMediaSession: true,
    zIndex: 100,
    handleAddUrlEvent: async () => {
        const url = window.prompt("Digite a URL direta de um arquivo de áudio:");
        return url ? [{ url, defaultName: url.split("/").pop() || "Faixa online" }] : null;
    }
});

async function loadLocalFiles(files) {
    const tracks = tracksFromFiles(files);
    if (!tracks.length) {
        showTip("Nenhum arquivo de áudio compatível foi encontrado.");
        return;
    }

    webamp.setTracksToPlay(tracks);
    showTip(`${tracks.length} ${tracks.length === 1 ? "música carregada" : "músicas carregadas"} do seu computador.`);
}

async function changeSkin(key, button) {
    const skin = SKINS[key];
    if (!skin) return;

    button.disabled = true;
    showTip(`Carregando a skin ${skin.name}...`, 8000);

    try {
        webamp.setSkinFromUrl(skin.url);
        await webamp.skinIsLoaded();
        document.querySelectorAll(".skin-choice").forEach((choice) => {
            choice.classList.toggle("is-selected", choice === button);
        });
        showTip(`Skin aplicada: ${skin.name}.`);
    } catch (error) {
        console.error("Não foi possível carregar a skin.", error);
        showTip("Não foi possível carregar essa skin. Tente novamente.");
    } finally {
        button.disabled = false;
    }
}

function bindDesktopActions() {
    document.querySelector('[data-action="open-files"]').addEventListener("click", () => audioInput.click());
    document.querySelector('[data-action="open-skins"]').addEventListener("click", () => openDialog(skinsDialog));
    document.querySelector('[data-action="open-help"]').addEventListener("click", () => openDialog(helpDialog));
    document.getElementById("start-button").addEventListener("click", () => openDialog(helpDialog));

    document.querySelectorAll("[data-close-dialog]").forEach((button) => {
        button.addEventListener("click", () => closeDialog(button));
    });

    document.querySelectorAll(".skin-choice").forEach((button) => {
        button.addEventListener("click", () => changeSkin(button.dataset.skin, button));
    });

    [skinsDialog, helpDialog].forEach((dialog) => {
        dialog.addEventListener("click", (event) => {
            const rect = dialog.getBoundingClientRect();
            const outside =
                event.clientX < rect.left ||
                event.clientX > rect.right ||
                event.clientY < rect.top ||
                event.clientY > rect.bottom;
            if (outside) dialog.close();
        });
    });

    audioInput.addEventListener("change", () => {
        loadLocalFiles(audioInput.files);
        audioInput.value = "";
    });

    taskButton.addEventListener("click", () => {
        if (taskButton.dataset.closed === "true") {
            window.location.reload();
            return;
        }
        stage.focus({ preventScroll: true });
        showTip("Winamp ativo. Use Z X C V B para controlar a reprodução.");
    });
}

function bindFileDrop() {
    let dragDepth = 0;

    window.addEventListener("dragenter", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
        dragDepth += 1;
        dropOverlay.classList.add("is-visible");
        dropOverlay.setAttribute("aria-hidden", "false");
    });

    window.addEventListener("dragover", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        event.preventDefault();
    });

    window.addEventListener("dragleave", (event) => {
        if (!event.dataTransfer?.types.includes("Files")) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) {
            dropOverlay.classList.remove("is-visible");
            dropOverlay.setAttribute("aria-hidden", "true");
        }
    });

    window.addEventListener("drop", (event) => {
        if (!event.dataTransfer?.files.length) return;
        event.preventDefault();
        dragDepth = 0;
        dropOverlay.classList.remove("is-visible");
        dropOverlay.setAttribute("aria-hidden", "true");
        loadLocalFiles(event.dataTransfer.files);
    });
}

async function init() {
    fitPlayer();
    updateClock();
    bindDesktopActions();
    bindFileDrop();

    window.addEventListener("resize", fitPlayer, { passive: true });
    window.matchMedia("(max-width: 760px)").addEventListener("change", () => window.location.reload());
    window.setInterval(updateClock, 30000);

    if (!Webamp.browserIsSupported()) {
        window.clearTimeout(window.__winampBootTimer);
        loader.querySelector("p").textContent =
            "Seu navegador não oferece os recursos de áudio necessários. Tente uma versão recente do Chrome, Firefox, Safari ou Edge.";
        return;
    }

    try {
        await webamp.renderInto(stage);
        window.clearTimeout(window.__winampBootTimer);
        loader.remove();
        window.webamp = webamp;
        stage.focus({ preventScroll: true });
        showTip("Pronto! Dê dois cliques em uma faixa ou pressione X para tocar.", 6500);

        webamp.onClose(() => {
            taskButton.dataset.closed = "true";
            taskButton.classList.remove("is-active");
            taskButton.querySelector("span:last-child").textContent = "Winamp 2.91 (fechado)";
            showTip("Winamp fechado. Clique na barra de tarefas para reabrir.");
        });

        webamp.onMinimize(() => {
            taskButton.classList.remove("is-active");
            showTip("Winamp minimizado. Clique na barra de tarefas para reabrir.");
        });
    } catch (error) {
        window.clearTimeout(window.__winampBootTimer);
        console.error("Falha ao iniciar o Winamp.", error);
        loader.querySelector("p").textContent =
            "O Winamp não conseguiu iniciar. Atualize a página para tentar novamente.";
        showTip("Falha ao iniciar o player. Verifique sua conexão e atualize a página.", 9000);
    }
}

init();
