document.addEventListener('DOMContentLoaded', () => {
    const cards = Array.from(document.querySelectorAll('.project-card'));
    const filtersContainer = document.querySelector('.filters-container');

    let currentFilter = 'all';

    // Define primary categories and their associated tags
    const categories = {
        'all': 'Todos',
        'game': 'Games',
        'utility': 'Utilidades',
        'music': 'Música'
    };

    // Map tags to categories for filtering
    const tagToCategory = {
        // Games
        'Game': 'game',
        'Arcade': 'game',
        'Action': 'game',
        'Puzzle': 'game',
        'Videogame': 'game',
        'Sega': 'game',
        'GameBoy': 'game',
        'Nokia': 'game',
        'Win95': 'game',
        'Retro': 'game',
        'Neon': 'game',
        'PixiJS': 'game',

        // Utilities
        'Utility': 'utility',
        'Tool': 'utility',
        'Editor': 'utility',
        'Finance': 'utility',
        'Productivity': 'utility',
        'Canvas': 'utility',
        'Art': 'utility',
        'Creative': 'utility',
        'Física': 'utility',
        'Interativo': 'utility',
        'Simulation': 'utility',
        'Education': 'utility',
        'AI': 'utility',
        'Filters': 'utility',

        // Music
        'Audio': 'music',
        'Winamp': 'music',
        'Piano': 'music',
        'Síntese': 'music',
        'Web Audio API': 'music'
    };

    // Extract and normalize tags on cards
    cards.forEach(card => {
        const cardTags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent.trim());
        card.dataset.tags = cardTags.join(',');

        // Add category classes to card for easier filtering if needed, 
        // but we'll stick to checking tags against the map.
    });

    // Create filter buttons
    filtersContainer.innerHTML = ''; // Clear existing
    Object.entries(categories).forEach(([key, label]) => {
        const btn = document.createElement('button');
        btn.className = `filter-btn ${key === 'all' ? 'active' : ''}`;
        btn.textContent = label;
        btn.dataset.filter = key;
        filtersContainer.appendChild(btn);
    });

    // Filter click handler
    filtersContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            // Update active state
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            currentFilter = e.target.dataset.filter;
            render();
        }
    });

    function render() {
        cards.forEach(card => {
            if (currentFilter === 'all') {
                card.style.display = 'flex';
                return;
            }

            const cardTags = card.dataset.tags.split(',');
            const hasMatch = cardTags.some(tag => {
                // Check if the tag maps to the current filter category
                // Or if the tag itself is the filter (case insensitive check just in case)
                return tagToCategory[tag] === currentFilter || tag.toLowerCase() === currentFilter;
            });

            if (hasMatch) {
                card.style.display = 'flex';
                // Add animation class if not already visible
                if (!card.classList.contains('visible')) {
                    card.classList.add('fade-in');
                }
            } else {
                card.style.display = 'none';
            }
        });
    }

    // Initial Render
    render();
});
