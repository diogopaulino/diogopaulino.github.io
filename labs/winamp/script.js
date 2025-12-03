document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_PLAYLIST = [
        {
            title: 'BeatMachine - Electronic Vibes',
            url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_8cb749d484.mp3',
            duration: '2:31'
        },
        {
            title: 'SoulProdMusic - Chill Lofi Beat',
            url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3',
            duration: '2:14'
        },
        {
            title: 'Lexin Music - Upbeat Energy',
            url: 'https://cdn.pixabay.com/download/audio/2022/10/25/audio_946b0939c8.mp3',
            duration: '2:07'
        },
        {
            title: 'FASSounds - Happy Clappy',
            url: 'https://cdn.pixabay.com/download/audio/2021/11/25/audio_91b32e02f9.mp3',
            duration: '2:23'
        },
        {
            title: 'GoodBMusic - Synthwave Dreams',
            url: 'https://cdn.pixabay.com/download/audio/2022/02/22/audio_d1718ab41b.mp3',
            duration: '3:41'
        },
        {
            title: 'Coma-Media - Epic Cinematic',
            url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0c6ff1bab.mp3',
            duration: '2:19'
        },
        {
            title: 'AlexiAction - Groovy Ambient',
            url: 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_884fe92c21.mp3',
            duration: '2:52'
        },
        {
            title: 'Musictown - Summer Vibes',
            url: 'https://cdn.pixabay.com/download/audio/2022/04/27/audio_67bcb4a86f.mp3',
            duration: '2:14'
        }
    ];

    let audioContext = null;
    let analyser = null;
    let gainNode = null;
    let panNode = null;
    let sourceNode = null;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';

    let playlist = [...DEFAULT_PLAYLIST];
    let currentTrackIndex = 0;
    let isPlaying = false;
    let isShuffle = false;
    let repeatMode = 0;
    let visMode = 0;
    const visModes = ['spectrum', 'oscilloscope', 'bars'];

    const canvas = document.getElementById('vis-canvas');
    const ctx = canvas.getContext('2d');
    const visContainer = document.querySelector('.visualization');
    const visModeLabel = document.querySelector('.vis-mode');

    const btnPlay = document.getElementById('btn-play');
    const btnPause = document.getElementById('btn-pause');
    const btnStop = document.getElementById('btn-stop');
    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    const btnEject = document.getElementById('btn-eject');
    const btnShuffle = document.getElementById('btn-shuffle');
    const btnRepeat = document.getElementById('btn-repeat');

    const volumeSlider = document.getElementById('volume');
    const balanceSlider = document.getElementById('balance');
    const volumeDisplay = document.getElementById('volume-display');
    const balanceDisplay = document.getElementById('balance-display');
    const seekBar = document.getElementById('seek-bar');
    const timeElapsed = document.getElementById('time-elapsed');
    const marqueeText = document.getElementById('marquee-text');
    const kbpsDisplay = document.getElementById('kbps');
    const khzDisplay = document.getElementById('khz');
    const playlistContainer = document.getElementById('playlist');
    const playlistCount = document.getElementById('playlist-count');
    const playlistDuration = document.getElementById('playlist-duration');
    const fileInput = document.getElementById('file-input');
    const loadingOverlay = document.getElementById('loading');

    const eqToggle = document.getElementById('eq-toggle');
    const eqPresets = document.getElementById('eq-presets');
    const eqSliders = document.querySelectorAll('.eq-band .eq-slider');
    const preampSlider = document.getElementById('preamp');

    let eqEnabled = true;
    let eqFilters = [];

    const EQ_PRESETS = {
        flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rock: [5, 4, 3, 1, -1, -1, 0, 2, 3, 4],
        pop: [-1, 2, 4, 5, 3, 0, -1, -1, -1, -1],
        classical: [0, 0, 0, 0, 0, 0, -3, -3, -3, -5],
        bass: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0],
        treble: [0, 0, 0, 0, 0, 2, 4, 5, 6, 6]
    };

    function initAudioContext() {
        if (audioContext) return;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;

        gainNode = audioContext.createGain();
        panNode = audioContext.createStereoPanner();

        const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        eqFilters = frequencies.map((freq, i) => {
            const filter = audioContext.createBiquadFilter();
            filter.type = i === 0 ? 'lowshelf' : i === frequencies.length - 1 ? 'highshelf' : 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1;
            filter.gain.value = 0;
            return filter;
        });

        sourceNode = audioContext.createMediaElementSource(audio);
        
        let chain = sourceNode;
        chain = chain.connect(gainNode);
        chain = chain.connect(panNode);
        
        eqFilters.forEach(filter => {
            chain = chain.connect(filter);
        });
        
        chain.connect(analyser);
        analyser.connect(audioContext.destination);

        gainNode.gain.value = volumeSlider.value / 100;
    }

    function loadTrack(index, autoPlay = false) {
        if (index < 0 || index >= playlist.length) return;
        
        currentTrackIndex = index;
        const track = playlist[index];
        
        showLoading(true);
        
        audio.src = track.url;
        audio.load();
        
        updateMarquee(track.title);
        updatePlaylistUI();
        
        audio.onloadedmetadata = () => {
            showLoading(false);
            seekBar.max = Math.floor(audio.duration);
            updateTrackInfo();
            if (autoPlay) play();
        };
        
        audio.onerror = () => {
            showLoading(false);
            updateMarquee('Error loading: ' + track.title);
            console.error('Failed to load:', track.url);
        };
    }

    function play() {
        initAudioContext();
        
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        audio.play().then(() => {
            isPlaying = true;
            btnPlay.classList.add('active');
            btnPause.classList.remove('active');
            document.querySelector('.marquee').classList.remove('paused');
            drawVisualizer();
        }).catch(err => {
            console.error('Playback failed:', err);
        });
    }

    function pause() {
        audio.pause();
        isPlaying = false;
        btnPlay.classList.remove('active');
        btnPause.classList.add('active');
        document.querySelector('.marquee').classList.add('paused');
    }

    function stop() {
        audio.pause();
        audio.currentTime = 0;
        isPlaying = false;
        btnPlay.classList.remove('active');
        btnPause.classList.remove('active');
        timeElapsed.textContent = '00:00';
        seekBar.value = 0;
        document.querySelector('.marquee').classList.add('paused');
        clearVisualizer();
    }

    function prevTrack() {
        if (audio.currentTime > 3) {
            audio.currentTime = 0;
            return;
        }
        
        let newIndex = currentTrackIndex - 1;
        if (newIndex < 0) newIndex = playlist.length - 1;
        loadTrack(newIndex, isPlaying);
    }

    function nextTrack() {
        let newIndex;
        
        if (isShuffle) {
            do {
                newIndex = Math.floor(Math.random() * playlist.length);
            } while (newIndex === currentTrackIndex && playlist.length > 1);
        } else {
            newIndex = currentTrackIndex + 1;
            if (newIndex >= playlist.length) {
                if (repeatMode === 2) {
                    newIndex = 0;
                } else {
                    stop();
                    return;
                }
            }
        }
        
        loadTrack(newIndex, isPlaying);
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateMarquee(text) {
        marqueeText.textContent = text + ' *** ';
    }

    function updateTrackInfo() {
        kbpsDisplay.textContent = '128';
        khzDisplay.textContent = '44';
    }

    function showLoading(show) {
        loadingOverlay.classList.toggle('show', show);
    }

    function drawVisualizer() {
        if (!isPlaying || !analyser) {
            return;
        }

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (visMode === 0) {
            analyser.getByteFrequencyData(dataArray);
            const barCount = 19;
            const barWidth = 3;
            const gap = 1;
            const step = Math.floor(bufferLength / barCount);
            
            for (let i = 0; i < barCount; i++) {
                const value = dataArray[i * step];
                const barHeight = (value / 255) * canvas.height;
                const x = i * (barWidth + gap);
                
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, '#00ff00');
                gradient.addColorStop(0.5, '#00cc00');
                gradient.addColorStop(1, '#009900');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                if (barHeight > 2) {
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(x, canvas.height - barHeight - 1, barWidth, 1);
                }
            }
        } else if (visMode === 1) {
            analyser.getByteTimeDomainData(dataArray);
            
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 2;
            ctx.shadowColor = '#00ff00';
            ctx.beginPath();
            
            const sliceWidth = canvas.width / bufferLength;
            let x = 0;
            
            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = (v * canvas.height) / 2;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                x += sliceWidth;
            }
            
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else {
            analyser.getByteFrequencyData(dataArray);
            const barCount = 38;
            const barWidth = 2;
            const step = Math.floor(bufferLength / barCount);
            
            for (let i = 0; i < barCount; i++) {
                const value = dataArray[i * step];
                const barHeight = (value / 255) * canvas.height;
                const x = i * barWidth;
                
                const hue = (i / barCount) * 60;
                ctx.fillStyle = `hsl(${120 - hue}, 100%, ${40 + (value / 255) * 30}%)`;
                ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
            }
        }

        requestAnimationFrame(drawVisualizer);
    }

    function clearVisualizer() {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function renderPlaylist() {
        playlistContainer.innerHTML = '';
        
        playlist.forEach((track, index) => {
            const item = document.createElement('div');
            item.className = 'playlist-item';
            if (index === currentTrackIndex) {
                item.classList.add('active');
                if (isPlaying) item.classList.add('playing');
            }
            
            item.innerHTML = `
                <span class="track-title">${index + 1}. ${track.title}</span>
                <span class="track-duration">${track.duration || '--:--'}</span>
            `;
            
            item.addEventListener('click', () => {
                loadTrack(index, true);
            });
            
            item.addEventListener('dblclick', () => {
                loadTrack(index, true);
            });
            
            playlistContainer.appendChild(item);
        });
        
        updatePlaylistInfo();
    }

    function updatePlaylistUI() {
        const items = playlistContainer.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.toggle('active', index === currentTrackIndex);
            item.classList.toggle('playing', index === currentTrackIndex && isPlaying);
        });
    }

    function updatePlaylistInfo() {
        playlistCount.textContent = `${playlist.length} tracks`;
        
        let totalSeconds = 0;
        playlist.forEach(track => {
            if (track.duration && track.duration !== '--:--') {
                const parts = track.duration.split(':');
                totalSeconds += parseInt(parts[0]) * 60 + parseInt(parts[1]);
            }
        });
        
        const hours = Math.floor(totalSeconds / 3600);
        const mins = Math.floor((totalSeconds % 3600) / 60);
        const secs = totalSeconds % 60;
        
        if (hours > 0) {
            playlistDuration.textContent = `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            playlistDuration.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    }

    function setVolume(value) {
        if (gainNode) {
            gainNode.gain.value = value / 100;
        }
        audio.volume = value / 100;
        volumeDisplay.textContent = `${value}%`;
    }

    function setBalance(value) {
        if (panNode) {
            panNode.pan.value = value / 100;
        }
        
        if (value === 0) {
            balanceDisplay.textContent = 'C';
        } else if (value < 0) {
            balanceDisplay.textContent = `L${Math.abs(value)}`;
        } else {
            balanceDisplay.textContent = `R${value}`;
        }
    }

    function toggleShuffle() {
        isShuffle = !isShuffle;
        btnShuffle.classList.toggle('active', isShuffle);
    }

    function toggleRepeat() {
        repeatMode = (repeatMode + 1) % 3;
        
        switch (repeatMode) {
            case 0:
                btnRepeat.classList.remove('active');
                btnRepeat.textContent = 'REP';
                break;
            case 1:
                btnRepeat.classList.add('active');
                btnRepeat.textContent = 'REP1';
                break;
            case 2:
                btnRepeat.classList.add('active');
                btnRepeat.textContent = 'REPA';
                break;
        }
    }

    function cycleVisMode() {
        visMode = (visMode + 1) % visModes.length;
        visModeLabel.textContent = visModes[visMode].toUpperCase();
    }

    function applyEQPreset(presetName) {
        const preset = EQ_PRESETS[presetName];
        if (!preset) return;
        
        eqSliders.forEach((slider, i) => {
            slider.value = preset[i];
            if (eqFilters[i]) {
                eqFilters[i].gain.value = eqEnabled ? preset[i] : 0;
            }
        });
    }

    function updateEQBand(index, value) {
        if (eqFilters[index]) {
            eqFilters[index].gain.value = eqEnabled ? parseFloat(value) : 0;
        }
    }

    function toggleEQ() {
        eqEnabled = !eqEnabled;
        eqToggle.classList.toggle('active', eqEnabled);
        eqToggle.textContent = eqEnabled ? 'ON' : 'OFF';
        
        eqSliders.forEach((slider, i) => {
            if (eqFilters[i]) {
                eqFilters[i].gain.value = eqEnabled ? parseFloat(slider.value) : 0;
            }
        });
    }

    function handleFileSelect(files) {
        Array.from(files).forEach(file => {
            if (file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file);
                const track = {
                    title: file.name.replace(/\.[^/.]+$/, ''),
                    url: url,
                    duration: '--:--',
                    isLocal: true
                };
                
                playlist.push(track);
                
                const tempAudio = new Audio(url);
                tempAudio.onloadedmetadata = () => {
                    track.duration = formatTime(tempAudio.duration);
                    renderPlaylist();
                };
            }
        });
        
        renderPlaylist();
        
        if (playlist.length === 1 || !isPlaying) {
            loadTrack(playlist.length - files.length, false);
        }
    }

    btnPlay.addEventListener('click', play);
    btnPause.addEventListener('click', pause);
    btnStop.addEventListener('click', stop);
    btnPrev.addEventListener('click', prevTrack);
    btnNext.addEventListener('click', nextTrack);
    btnShuffle.addEventListener('click', toggleShuffle);
    btnRepeat.addEventListener('click', toggleRepeat);
    
    btnEject.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
        e.target.value = '';
    });

    volumeSlider.addEventListener('input', (e) => setVolume(e.target.value));
    balanceSlider.addEventListener('input', (e) => setBalance(e.target.value));

    seekBar.addEventListener('input', () => {
        if (audio.duration) {
            audio.currentTime = seekBar.value;
        }
    });

    visContainer.addEventListener('click', cycleVisMode);

    eqToggle.addEventListener('click', toggleEQ);
    
    eqPresets.addEventListener('change', (e) => {
        applyEQPreset(e.target.value);
    });
    
    eqSliders.forEach((slider, index) => {
        slider.addEventListener('input', (e) => {
            updateEQBand(index, e.target.value);
        });
    });

    document.getElementById('pl-add').addEventListener('click', () => fileInput.click());
    
    document.getElementById('pl-rem').addEventListener('click', () => {
        if (playlist.length > 1) {
            const removedIndex = currentTrackIndex;
            playlist.splice(removedIndex, 1);
            
            if (removedIndex >= playlist.length) {
                currentTrackIndex = playlist.length - 1;
            }
            
            renderPlaylist();
            
            if (removedIndex === currentTrackIndex && isPlaying) {
                loadTrack(currentTrackIndex, true);
            }
        }
    });
    
    document.getElementById('pl-clear').addEventListener('click', () => {
        stop();
        playlist = [...DEFAULT_PLAYLIST];
        currentTrackIndex = 0;
        renderPlaylist();
        loadTrack(0, false);
    });
    
    document.getElementById('pl-sort').addEventListener('click', () => {
        const currentTrack = playlist[currentTrackIndex];
        playlist.sort((a, b) => a.title.localeCompare(b.title));
        currentTrackIndex = playlist.findIndex(t => t.url === currentTrack.url);
        renderPlaylist();
    });

    audio.addEventListener('timeupdate', () => {
        if (!isNaN(audio.duration)) {
            timeElapsed.textContent = formatTime(audio.currentTime);
            seekBar.value = Math.floor(audio.currentTime);
        }
    });

    audio.addEventListener('ended', () => {
        if (repeatMode === 1) {
            audio.currentTime = 0;
            play();
        } else {
            nextTrack();
        }
    });

    audio.addEventListener('play', () => {
        isPlaying = true;
        updatePlaylistUI();
    });

    audio.addEventListener('pause', () => {
        updatePlaylistUI();
    });

    document.querySelectorAll('.main-window, .equalizer-window, .playlist-window').forEach(win => {
        makeDraggable(win);
    });

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.title-bar');
        
        if (header) {
            header.addEventListener('mousedown', dragMouseDown);
        }

        function dragMouseDown(e) {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
            
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.addEventListener('mouseup', closeDragElement);
            document.addEventListener('mousemove', elementDrag);
            
            document.querySelectorAll('.winamp-wrapper > div').forEach(div => {
                div.style.zIndex = 1;
            });
            element.style.zIndex = 2;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.position = 'relative';
            element.style.top = (element.offsetTop - pos2) + 'px';
            element.style.left = (element.offsetLeft - pos1) + 'px';
        }

        function closeDragElement() {
            document.removeEventListener('mouseup', closeDragElement);
            document.removeEventListener('mousemove', elementDrag);
        }
    }

    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                isPlaying ? pause() : play();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.shiftKey) {
                    prevTrack();
                } else {
                    audio.currentTime = Math.max(0, audio.currentTime - 5);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.shiftKey) {
                    nextTrack();
                } else {
                    audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5);
                setVolume(volumeSlider.value);
                break;
            case 'ArrowDown':
                e.preventDefault();
                volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5);
                setVolume(volumeSlider.value);
                break;
            case 'KeyS':
                toggleShuffle();
                break;
            case 'KeyR':
                toggleRepeat();
                break;
            case 'KeyV':
                cycleVisMode();
                break;
        }
    });

    document.querySelector('.marquee').classList.add('paused');
    setVolume(80);
    setBalance(0);
    renderPlaylist();
    loadTrack(0, false);
    clearVisualizer();

    const wrapper = document.querySelector('.winamp-wrapper');
    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        wrapper.style.opacity = '0.7';
    });
    
    wrapper.addEventListener('dragleave', () => {
        wrapper.style.opacity = '1';
    });
    
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.style.opacity = '1';
        handleFileSelect(e.dataTransfer.files);
    });
});
