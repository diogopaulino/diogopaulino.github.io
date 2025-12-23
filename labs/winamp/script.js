document.addEventListener('DOMContentLoaded', () => {
    // State
    let isPlaying = false;
    let currentTrackIndex = 0;
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    let audioContext, analyser, dataArray, source;

    const tracks = [
        { title: "1. Depeche Mode - Never Let Me Down Again", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3", duration: "6:12" },
        { title: "2. Depeche Mode - The Things You Said", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3", duration: "7:05" },
        { title: "3. Depeche Mode - Strangelove", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3", duration: "5:12" },
        { title: "4. Depeche Mode - Sacred", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3", duration: "6:20" },
        { title: "5. Depeche Mode - Little 15", url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3", duration: "6:54" }
    ];

    // Selectors
    const playBtn = document.querySelector('.btn-play');
    const pauseBtn = document.querySelector('.btn-pause');
    const stopBtn = document.querySelector('.btn-stop');
    const prevBtn = document.querySelector('.btn-prev');
    const nextBtn = document.querySelector('.btn-next');
    const ejectBtn = document.querySelector('.btn-eject');

    const timeDisplay = document.querySelector('.time-display');
    const songTitle = document.querySelector('.song-title');
    const playlistContent = document.querySelector('.playlist-content');
    const positionSlider = document.querySelector('.position-slider');
    const volumeSlider = document.querySelector('.volume-slider');
    const visBars = document.querySelectorAll('.vis-bar');

    // Initialize Playlist
    function initPlaylist() {
        playlistContent.innerHTML = '';
        tracks.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item' + (index === currentTrackIndex ? ' selected' : '');
            item.innerHTML = `${track.title} <span class="duration">${track.duration}</span>`;
            item.onclick = () => selectTrack(index);
            item.ondblclick = () => {
                selectTrack(index);
                playTrack();
            };
            playlistContent.appendChild(item);
        });
    }

    function selectTrack(index) {
        currentTrackIndex = index;
        const items = document.querySelectorAll('.playlist-item');
        items.forEach((item, i) => {
            item.classList.toggle('selected', i === index);
        });
        updateSongInfo();
        audio.src = tracks[currentTrackIndex].url;
        if (isPlaying) {
            playTrack();
        }
    }

    function updateSongInfo() {
        songTitle.textContent = tracks[currentTrackIndex].title;
    }

    // Audio Logic
    function playTrack() {
        if (!audio.src || audio.src === "") {
            audio.src = tracks[currentTrackIndex].url;
        }

        if (!audioContext) {
            try {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
                analyser = audioContext.createAnalyser();
                source = audioContext.createMediaElementSource(audio);
                source.connect(analyser);
                analyser.connect(audioContext.destination);
                analyser.fftSize = 64;
                const bufferLength = analyser.frequencyBinCount;
                dataArray = new Uint8Array(bufferLength);
                drawVisualizer();
            } catch (e) {
                console.error("Visualizer failed to init", e);
            }
        }

        if (audioContext && audioContext.state === 'suspended') {
            audioContext.resume();
        }

        audio.play().then(() => {
            isPlaying = true;
            updatePlayState(true);
        }).catch(e => {
            console.error("Playback failed", e);
            isPlaying = false;
        });
    }

    function updatePlayState(playing) {
        // Toggle LEDs
        document.querySelectorAll('.led').forEach(led => led.classList.remove('active'));
        if (playing) {
            document.querySelector('.led:nth-child(3)')?.classList.add('active'); // 'I'
        }
    }

    function pauseTrack() {
        audio.pause();
        isPlaying = false;
        updatePlayState(false);
    }

    function stopTrack() {
        audio.pause();
        audio.currentTime = 0;
        isPlaying = false;
        updatePlayState(false);
        timeDisplay.textContent = "0:00";
    }

    function nextTrack() {
        currentTrackIndex = (currentTrackIndex + 1) % tracks.length;
        selectTrack(currentTrackIndex);
        playTrack();
    }

    function prevTrack() {
        currentTrackIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
        selectTrack(currentTrackIndex);
        playTrack();
    }

    function drawVisualizer() {
        requestAnimationFrame(drawVisualizer);
        if (!isPlaying || !analyser) {
            visBars.forEach(bar => bar.style.height = '2px');
            return;
        }

        analyser.getByteFrequencyData(dataArray);

        visBars.forEach((bar, i) => {
            const val = dataArray[i] || 0;
            const height = (val / 255) * 40;
            bar.style.height = Math.max(2, height) + 'px';
        });
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    // Event Listeners
    playBtn.onclick = () => playTrack();
    pauseBtn.onclick = () => pauseTrack();
    stopBtn.onclick = () => stopTrack();
    nextBtn.onclick = () => nextTrack();
    prevBtn.onclick = () => prevTrack();

    ejectBtn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'audio/*';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const url = URL.createObjectURL(file);
                tracks.unshift({ title: file.name, url: url, duration: "??" });
                currentTrackIndex = 0;
                initPlaylist();
                selectTrack(0);
                playTrack();
            }
        };
        input.click();
    };

    audio.ontimeupdate = () => {
        timeDisplay.textContent = formatTime(audio.currentTime);
        if (audio.duration) {
            const sliderWidth = positionSlider.offsetWidth;
            const handleWidth = 28;
            const pos = (audio.currentTime / audio.duration) * (sliderWidth - handleWidth);
            positionSlider.style.setProperty('--handle-pos', pos + 'px');
        }
    };

    audio.onended = () => nextTrack();

    positionSlider.onclick = (e) => {
        if (!audio.duration) return;
        const rect = positionSlider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const pct = x / rect.width;
        audio.currentTime = pct * audio.duration;
    };

    volumeSlider.onclick = (e) => {
        const rect = volumeSlider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const vol = Math.max(0, Math.min(1, x / rect.width));
        audio.volume = vol;
        volumeSlider.style.setProperty('--vol-pos', (x - 7) + 'px');
    };

    // Window Dragging Logic (Optimized for Scale)
    const windows = document.querySelectorAll('.window');
    windows.forEach(win => {
        const titleBar = win.querySelector('.titlebar');
        if (!titleBar) return;

        let isDragging = false;
        let startX, startY;
        let initialLeft, initialTop;

        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = win.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            // Shift to fixed positioning for dragging
            win.style.position = 'fixed';
            win.style.left = initialLeft + 'px';
            win.style.top = initialTop + 'px';
            win.style.margin = '0';
            win.style.transform = 'scale(1.5)';
            win.style.transformOrigin = 'top left';

            windows.forEach(w => w.style.zIndex = '100');
            win.style.zIndex = '1000';

            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            win.style.left = (initialLeft + dx) + 'px';
            win.style.top = (initialTop + dy) + 'px';
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
        });
    });

    initPlaylist();
    updateSongInfo();
    audio.src = tracks[currentTrackIndex].url;
});
