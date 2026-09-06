document.addEventListener('DOMContentLoaded', () => {
    const gridCards = Array.from(document.querySelectorAll('#projectsGrid .project-card'));
    const featuredCards = Array.from(document.querySelectorAll('#featuredGrid .project-card'));
    const allCards = [...featuredCards, ...gridCards];
    const filterButtons = Array.from(document.querySelectorAll('.filter-btn[data-filter]'));
    const searchInput = document.getElementById('labsSearch');
    const resultCount = document.getElementById('labsResultCount');
    const featuredSection = document.querySelector('.featured-section');
    const defaultActive = filterButtons.find((btn) => btn.getAttribute('aria-pressed') === 'true');
    let currentFilter = defaultActive ? defaultActive.dataset.filter : 'all';
    let searchQuery = '';
    let firstRender = true;
    let animationFrame = null;

    function normalizeSearch(value) {
        return value
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('pt-BR');
    }

    allCards.forEach((card) => {
        card.dataset.search = normalizeSearch(card.textContent.replace(/\s+/g, ' ').trim());
    });

    function cardMatchesFilter(card) {
        const groups = (card.dataset.groups || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
        return currentFilter === 'all' || groups.includes(currentFilter);
    }

    function cardMatchesSearch(card) {
        if (!searchQuery) return true;
        return card.dataset.search.includes(searchQuery);
    }

    function updateResultCount(visible) {
        if (!resultCount) return;
        const label = visible === 1 ? '1 lab' : `${visible} labs`;
        resultCount.textContent = searchQuery ? `${label} encontrados` : `${visible} labs`;
    }

    function applyFilters() {
        let visibleCount = 0;
        let featuredVisible = 0;
        const enteringCards = [];

        allCards.forEach((card) => {
            const shouldShow = cardMatchesFilter(card) && cardMatchesSearch(card);
            const wasHidden = card.hidden;
            card.hidden = !shouldShow;
            if (shouldShow) {
                visibleCount += 1;
                if (card.dataset.featured === 'true') featuredVisible += 1;
                if (firstRender || wasHidden) {
                    enteringCards.push(card);
                }
            } else {
                card.classList.remove('fade-in');
            }
        });

        if (animationFrame !== null) cancelAnimationFrame(animationFrame);
        if (enteringCards.length > 0) {
            enteringCards.forEach((card) => card.classList.remove('fade-in'));
            animationFrame = requestAnimationFrame(() => {
                enteringCards.forEach((card) => {
                    if (!card.hidden) card.classList.add('fade-in');
                });
                animationFrame = null;
            });
        }
        firstRender = false;

        if (featuredSection) {
            const hideFeatured = searchQuery.length > 0 && featuredVisible === 0;
            featuredSection.hidden = hideFeatured;
        }

        updateResultCount(visibleCount);
    }

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetFilter = button.dataset.filter;
            if (targetFilter === currentFilter) return;

            filterButtons.forEach((btn) => {
                btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
            });

            currentFilter = targetFilter;
            applyFilters();
        });
    });

    if (searchInput) {
        let searchTimer = null;
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchQuery = normalizeSearch(searchInput.value.trim());
                applyFilters();
            }, 120);
        });

        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                searchInput.value = '';
                searchQuery = '';
                applyFilters();
                searchInput.blur();
            }
        });
    }

    applyFilters();
});
