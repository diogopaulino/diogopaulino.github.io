document.addEventListener('DOMContentLoaded', () => {
    // Visualizer
    const canvas = document.getElementById('vis-canvas');
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    let isPlaying = false;
    let animationId;
    let startTime = 0;
    let elapsedTime = 0;
    let timeInterval;

    // Time display
    const timeDisplay = document.getElementById('time');

    // Controls
    const btnPlay = document.querySelector('.btn-play');
    const btnPause = document.querySelector('.btn-pause');
    const btnStop = document.querySelector('.btn-stop');
    const btnPrev = document.querySelector('.btn-prev');
    const btnNext = document.querySelector('.btn-next');

    // Marquee
    const marquee = document.querySelector('.marquee');

    // Visualizer Logic
    function drawVisualizer() {
        if (!isPlaying) {
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            return;
        }

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        const barWidth = 3;
        const gap = 1;
        const numBars = Math.floor(width / (barWidth + gap));

        for (let i = 0; i < numBars; i++) {
            const barHeight = Math.random() * height;
            const x = i * (barWidth + gap);

            // Draw bar
            ctx.fillStyle = '#00ff00';
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);

            // Draw peak (optional)
            // ctx.fillStyle = '#fff'; 
            // ctx.fillRect(x, height - barHeight - 2, barWidth, 1);
        }

        animationId = requestAnimationFrame(drawVisualizer);
    }

    // Timer Logic
    function startTimer() {
        clearInterval(timeInterval);
        timeInterval = setInterval(() => {
            if (!isPlaying) return;

            const now = Date.now();
            const diff = now - startTime + elapsedTime;
            const seconds = Math.floor(diff / 1000);
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;

            timeDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }, 1000);
    }

    // Event Listeners
    btnPlay.addEventListener('click', () => {
        if (isPlaying) return;
        isPlaying = true;
        startTime = Date.now();
        drawVisualizer();
        startTimer();
        marquee.style.animationPlayState = 'running';
    });

    btnPause.addEventListener('click', () => {
        if (!isPlaying) return;
        isPlaying = false;
        elapsedTime += Date.now() - startTime;
        cancelAnimationFrame(animationId);
        clearInterval(timeInterval);
        marquee.style.animationPlayState = 'paused';
    });

    btnStop.addEventListener('click', () => {
        isPlaying = false;
        elapsedTime = 0;
        cancelAnimationFrame(animationId);
        clearInterval(timeInterval);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        timeDisplay.innerText = '00:00';
        marquee.style.animationPlayState = 'paused';
    });

    btnPrev.addEventListener('click', () => {
        // Reset song
        elapsedTime = 0;
        startTime = Date.now();
        timeDisplay.innerText = '00:00';
    });

    btnNext.addEventListener('click', () => {
        // Just reset for demo
        elapsedTime = 0;
        startTime = Date.now();
        timeDisplay.innerText = '00:00';
    });

    // Draggable Windows (Simple implementation)
    makeDraggable(document.querySelector('.main-window'));
    makeDraggable(document.querySelector('.playlist-window'));

    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        const header = element.querySelector('.title-bar');

        if (header) {
            header.onmousedown = dragMouseDown;
        }

        function dragMouseDown(e) {
            e = e || window.event;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;

            // Bring to front
            document.querySelectorAll('.winamp-wrapper > div').forEach(div => {
                div.style.zIndex = 1;
            });
            element.style.zIndex = 2;
        }

        function elementDrag(e) {
            e = e || window.event;
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // Initial state
    marquee.style.animationPlayState = 'paused';
});
