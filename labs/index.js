document.addEventListener('DOMContentLoaded', () => {
    const cards = Array.from(document.querySelectorAll('.project-card'));
    const filterButtons = Array.from(document.querySelectorAll('.filter-btn[data-filter]'));
    const defaultActive = filterButtons.find((btn) => btn.getAttribute('aria-pressed') === 'true');
    let currentFilter = defaultActive ? defaultActive.dataset.filter : 'all';

    function applyFilter(value) {
        currentFilter = value;
        cards.forEach((card) => {
            const groups = (card.dataset.groups || '')
                .split(',')
                .map((tag) => tag.trim())
                .filter(Boolean);

            const shouldShow = value === 'all' || groups.includes(value);
            card.hidden = !shouldShow;

            if (shouldShow) {
                card.classList.remove('fade-in');
                void card.offsetWidth;
                card.classList.add('fade-in');
            }
        });
    }

    filterButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetFilter = button.dataset.filter;
            if (targetFilter === currentFilter) return;

            filterButtons.forEach((btn) => {
                btn.setAttribute('aria-pressed', btn === button ? 'true' : 'false');
            });

            applyFilter(targetFilter);
        });
    });

    applyFilter(currentFilter);
});
