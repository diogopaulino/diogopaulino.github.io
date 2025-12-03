document.addEventListener('DOMContentLoaded', () => {
    const DEFAULT_PLAYLIST = [
        {
            title: 'Retro Synthwave - Night Drive',
            url: 'https://cdn.pixabay.com/audio/2022/05/16/audio_5c29ee7879.mp3',
            duration: '2:38'
        },
        {
            title: 'Chill 90s Groove - Sunset Boulevard',
            url: 'https://cdn.pixabay.com/audio/2022/10/18/audio_715e43bd13.mp3',
            duration: '2:17'
        },
        {
            title: 'Lo-Fi Hip Hop - Rainy Day',
            url: 'https://cdn.pixabay.com/audio/2024/11/01/audio_4956b4edd1.mp3',
            duration: '2:35'
        },
        {
            title: 'Vaporwave Dreams - Mall Memories',
            url: 'https://cdn.pixabay.com/audio/2022/08/23/audio_d16737dc28.mp3',
            duration: '3:14'
        },
        {
            title: 'Smooth Bass - Late Night Jam',
            url: 'https://cdn.pixabay.com/audio/2023/07/30/audio_e6d0f98a2e.mp3',
            duration: '1:41'
        },
        {
            title: '90s Ambient - City Lights',
            url: 'https://cdn.pixabay.com/audio/2022/08/04/audio_2dde668d05.mp3',
            duration: '2:29'
        },
        {
            title: 'Chillwave - Ocean Breeze',
            url: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73467.mp3',
            duration: '3:46'
        },
        {
            title: 'Retro Beats - Neon Streets',
            url: 'https://cdn.pixabay.com/audio/2023/09/25/audio_ef7223c00d.mp3',
            duration: '2:05'
        }
    ];

    let audioContext = null;
    let analyser = null;
    let gainNode = null;
    let panNode = null;
    let sourceNode = null;
    let audioConnected = false;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    let playlist = [...DEFAULT_PLAYLIST];
    let currentTrackIndex = 0;
    let isPlaying = false;
    let isShuffle = false;
    let repeatMode = 0;
    let visMode = 0;
    const visModes = ['spectrum', 'scope', 'bars'];

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
        bass: [8, 6, 4, 2, 0, 0, 0, 0, 0, 0],
        treble: [0, 0, 0, 0, 0, 2, 4, 5, 6, 6]
    };

    function initAudioContext() {
        if (audioContext && audioConnected) return;

        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }

        analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.85;

        gainNode = audioContext.createGain();
        panNode = audioContext.createStereoPanner();

        const frequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        eqFilters = frequencies.map((freq, i) => {
            const filter = audioContext.createBiquadFilter();
            filter.type = i === 0 ? 'lowshelf' : i === frequencies.length - 1 ? 'highshelf' : 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.4;
            filter.gain.value = 0;
            return filter;
        });

        if (!audioConnected) {
            sourceNode = audioContext.createMediaElementSource(audio);
            
            let chain = sourceNode;
            chain = chain.connect(gainNode);
            chain = chain.connect(panNode);
            
            eqFilters.forEach(filter => {
                chain = chain.connect(filter);
            });
            
            chain.connect(analyser);
            analyser.connect(audioContext.destination);
            audioConnected = true;
        }

        gainNode.gain.value = volumeSlider.value / 100;
        applyEQPreset('bass');
        eqPresets.value = 'bass';
    }

    function loadTrack(index, autoPlay = false) {
        if (index < 0 || index >= playlist.length) return;
        
        currentTrackIndex = index;
        const track = playlist[index];
        
        showLoading(true);
        
        const wasPlaying = isPlaying;
        if (isPlaying) {
            audio.pause();
        }
        
        audio.src = track.url;
        audio.load();
        
        updateMarquee(track.title);
        updatePlaylistUI();
        
        audio.onloadedmetadata = () => {
            showLoading(false);
            seekBar.max = Math.floor(audio.duration);
            updateTrackInfo();
            
            if (autoPlay || wasPlaying) {
                play();
            }
        };
        
        audio.onerror = (e) => {
            showLoading(false);
            console.error('Error loading track:', track.url, e);
            updateMarquee('Error: ' + track.title);
            
            setTimeout(() => {
                if (playlist.length > 1) {
                    nextTrack();
                }
            }, 2000);
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
            requestAnimationFrame(drawVisualizer);
        }).catch(err => {
            console.error('Playback error:', err);
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
        if (newIndex < 0) {
            newIndex = playlist.length - 1;
        }
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
        if (isNaN(seconds) || !isFinite(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    function updateMarquee(text) {
        marqueeText.textContent = text + '  ***  ';
    }

    function updateTrackInfo() {
        kbpsDisplay.textContent = '128';
        khzDisplay.textContent = '44';
    }

    function showLoading(show) {
        if (show) {
            loadingOverlay.classList.add('show');
        } else {
            loadingOverlay.classList.remove('show');
        }
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
                let value = dataArray[i * step];
                value = Math.pow(value / 255, 0.8) * 255;
                const barHeight = (value / 255) * canvas.height;
                const x = i * (barWidth + gap);
                
                const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
                gradient.addColorStop(0, '#00cc00');
                gradient.addColorStop(0.6, '#00ff00');
                gradient.addColorStop(1, '#88ff88');
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                
                if (barHeight > 3) {
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(x, canvas.height - barHeight, barWidth, 1);
                }
            }
        } else if (visMode === 1) {
            analyser.getByteTimeDomainData(dataArray);
            
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 1;
            ctx.shadowBlur = 3;
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
                let value = dataArray[i * step];
                value = Math.pow(value / 255, 0.8) * 255;
                const barHeight = (value / 255) * canvas.height;
                const x = i * barWidth;
                
                const hue = 120 - (i / barCount) * 40;
                const light = 40 + (value / 255) * 20;
                ctx.fillStyle = `hsl(${hue}, 100%, ${light}%)`;
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
            
            const num = (index + 1).toString();
            item.innerHTML = `
                <span class="track-title">${num}. ${track.title}</span>
                <span class="track-duration">${track.duration || '--:--'}</span>
            `;
            
            item.addEventListener('dblclick', () => {
                loadTrack(index, true);
            });
            
            item.addEventListener('click', () => {
                document.querySelectorAll('.playlist-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
            });
            
            playlistContainer.appendChild(item);
        });
        
        updatePlaylistInfo();
    }

    function updatePlaylistUI() {
        const items = playlistContainer.querySelectorAll('.playlist-item');
        items.forEach((item, index) => {
            item.classList.remove('active', 'playing');
            if (index === currentTrackIndex) {
                item.classList.add('active');
                if (isPlaying) item.classList.add('playing');
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
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
        
        playlistDuration.textContent = formatTime(totalSeconds);
    }

    function setVolume(value) {
        const vol = value / 100;
        audio.volume = vol;
        if (gainNode) {
            gainNode.gain.value = vol;
        }
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
                btnRepeat.textContent = 'ALL';
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
        const newTracks = [];
        
        Array.from(files).forEach(file => {
            if (file.type.startsWith('audio/')) {
                const url = URL.createObjectURL(file);
                const track = {
                    title: file.name.replace(/\.[^/.]+$/, ''),
                    url: url,
                    duration: '--:--',
                    isLocal: true
                };
                
                newTracks.push(track);
                
                const tempAudio = new Audio(url);
                tempAudio.onloadedmetadata = () => {
                    track.duration = formatTime(tempAudio.duration);
                    renderPlaylist();
                };
            }
        });
        
        if (newTracks.length > 0) {
            playlist = [...playlist, ...newTracks];
            renderPlaylist();
            
            if (!isPlaying) {
                loadTrack(playlist.length - newTracks.length, false);
            }
        }
    }

    btnPlay.addEventListener('click', play);
    btnPause.addEventListener('click', pause);
    btnStop.addEventListener('click', stop);
    btnPrev.addEventListener('click', prevTrack);
    btnNext.addEventListener('click', nextTrack);
    btnShuffle.addEventListener('click', toggleShuffle);
    btnRepeat.addEventListener('click', toggleRepeat);
    
    btnEject.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', (e) => {
        handleFileSelect(e.target.files);
        e.target.value = '';
    });

    volumeSlider.addEventListener('input', (e) => setVolume(parseInt(e.target.value)));
    balanceSlider.addEventListener('input', (e) => setBalance(parseInt(e.target.value)));

    let isSeeking = false;
    seekBar.addEventListener('mousedown', () => isSeeking = true);
    seekBar.addEventListener('mouseup', () => {
        isSeeking = false;
        if (audio.duration) {
            audio.currentTime = seekBar.value;
        }
    });
    seekBar.addEventListener('input', () => {
        timeElapsed.textContent = formatTime(seekBar.value);
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
        const selected = document.querySelector('.playlist-item.selected');
        if (selected) {
            const index = Array.from(playlistContainer.children).indexOf(selected);
            if (index !== -1 && playlist.length > 1) {
                playlist.splice(index, 1);
                if (index === currentTrackIndex) {
                    currentTrackIndex = Math.min(index, playlist.length - 1);
                    loadTrack(currentTrackIndex, isPlaying);
                } else if (index < currentTrackIndex) {
                    currentTrackIndex--;
                }
                renderPlaylist();
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
        const currentUrl = playlist[currentTrackIndex]?.url;
        playlist.sort((a, b) => a.title.localeCompare(b.title));
        currentTrackIndex = playlist.findIndex(t => t.url === currentUrl);
        if (currentTrackIndex === -1) currentTrackIndex = 0;
        renderPlaylist();
    });

    audio.addEventListener('timeupdate', () => {
        if (!isSeeking && !isNaN(audio.duration)) {
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
            element.style.zIndex = 10;
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
        if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                isPlaying ? pause() : play();
                break;
            case 'ArrowLeft':
                e.preventDefault();
                if (e.ctrlKey || e.metaKey) {
                    prevTrack();
                } else {
                    audio.currentTime = Math.max(0, audio.currentTime - 5);
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if (e.ctrlKey || e.metaKey) {
                    nextTrack();
                } else {
                    audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5);
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                volumeSlider.value = Math.min(100, parseInt(volumeSlider.value) + 5);
                setVolume(parseInt(volumeSlider.value));
                break;
            case 'ArrowDown':
                e.preventDefault();
                volumeSlider.value = Math.max(0, parseInt(volumeSlider.value) - 5);
                setVolume(parseInt(volumeSlider.value));
                break;
            case 'KeyS':
                if (!e.ctrlKey && !e.metaKey) toggleShuffle();
                break;
            case 'KeyR':
                if (!e.ctrlKey && !e.metaKey) toggleRepeat();
                break;
            case 'KeyV':
                if (!e.ctrlKey && !e.metaKey) cycleVisMode();
                break;
            case 'KeyZ':
                if (!e.ctrlKey && !e.metaKey) prevTrack();
                break;
            case 'KeyX':
                if (!e.ctrlKey && !e.metaKey) play();
                break;
            case 'KeyC':
                if (!e.ctrlKey && !e.metaKey) pause();
                break;
            case 'KeyB':
                if (!e.ctrlKey && !e.metaKey) nextTrack();
                break;
        }
    });

    const wrapper = document.querySelector('.winamp-wrapper');
    
    wrapper.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.style.opacity = '0.8';
    });
    
    wrapper.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.style.opacity = '1';
    });
    
    wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        wrapper.style.opacity = '1';
        handleFileSelect(e.dataTransfer.files);
    });

    document.querySelector('.marquee').classList.add('paused');
    setVolume(80);
    setBalance(0);
    renderPlaylist();
    loadTrack(0, false);
    clearVisualizer();
});
