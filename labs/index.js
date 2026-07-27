document.addEventListener('DOMContentLoaded', () => {
    const cards = Array.from(document.querySelectorAll('.project-card'));
    const filterButtons = Array.from(document.querySelectorAll('.filter-btn[data-filter]'));
    const emptyState = document.querySelector('[data-labs-empty]');
    const totalEl = document.querySelector('[data-labs-total]');
    const visibleEl = document.querySelector('[data-labs-visible]');
    const defaultActive = filterButtons.find((btn) => btn.getAttribute('aria-pressed') === 'true');
    let currentFilter = defaultActive ? defaultActive.dataset.filter : 'all';
    let hasFilteredOnce = false;

    function cardGroups(card) {
        return (card.dataset.groups || '')
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean);
    }

    function updateCounts() {
        const totals = { all: cards.length, game: 0, creative: 0, tools: 0, music: 0 };

        cards.forEach((card) => {
            const groups = cardGroups(card);
            groups.forEach((group) => {
                if (totals[group] !== undefined) totals[group] += 1;
            });
        });

        Object.entries(totals).forEach(([key, value]) => {
            document.querySelectorAll(`[data-count-for="${key}"]`).forEach((el) => {
                el.textContent = String(value);
            });
        });

        if (totalEl) totalEl.textContent = String(cards.length);
    }

    function applyFilter(value, { animate = true } = {}) {
        currentFilter = value;
        let visible = 0;

        cards.forEach((card) => {
            const groups = cardGroups(card);
            const shouldShow = value === 'all' || groups.includes(value);
            card.hidden = !shouldShow;

            if (shouldShow) {
                visible += 1;
                if (animate && hasFilteredOnce) {
                    card.classList.add('is-filtering');
                }
            }
        });

        if (visibleEl) visibleEl.textContent = String(visible);

        if (emptyState) {
            const showEmpty = visible === 0;
            emptyState.hidden = !showEmpty;
            emptyState.classList.toggle('is-visible', showEmpty);
        }
    }

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetFilter = button.dataset.filter;
            if (targetFilter === currentFilter) return;

            filterButtons.forEach((btn) => {
                btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
            });

            hasFilteredOnce = true;
            applyFilter(targetFilter);
        });
    });

    updateCounts();
    applyFilter(currentFilter, { animate: false });
});
