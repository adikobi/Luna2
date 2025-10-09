document.addEventListener('DOMContentLoaded', () => {
    // --- View Elements ---
    const timelineView = document.getElementById('timeline-view');
    const composerView = document.getElementById('composer-view');
    const fab = document.getElementById('fab');
    const timelineHeader = document.getElementById('timeline-header');
    const mainTitle = document.getElementById('main-title');
    const journalFeed = document.getElementById('journal-feed');

    // --- Data Store (Single Source of Truth) ---
    // This will be replaced by Firebase
    let journalData = [
        { date: 'OCT 09, 2025, 12:42 PM', text: 'This is the first journal entry. It has a bit of text to see how the truncation works. Hopefully it looks good on the screen.' },
        { date: 'OCT 08, 2025, 8:15 AM', text: 'Another day, another entry. I am building a journal app. It is fun. I am using HTML, CSS, and JavaScript. I am following a design specification.' },
        { date: 'OCT 07, 2025, 9:00 PM', text: 'This is a shorter entry.' },
        { date: 'OCT 06, 2025, 6:30 PM', text: 'Thinking about what to have for dinner. Maybe pizza? Or perhaps something healthier. The eternal struggle.' },
        { date: 'OCT 05, 2025, 11:00 AM', text: 'Went for a walk in the park. The weather was perfect. The leaves are starting to change color. Autumn is a beautiful season.' },
        { date: 'OCT 04, 2025, 2:00 PM', text: 'Worked on a coding project today. It was challenging but I made good progress. Feeling accomplished.' },
        { date: 'OCT 03, 2025, 10:00 PM', text: 'Watched a movie with friends. It was a lot of fun. We should do it more often.' },
        { date: 'OCT 02, 2025, 7:00 AM', text: 'Woke up early to go for a run. It was tough but I feel great now. Ready to start the day.' },
        { date: 'OCT 01, 2025, 4:00 PM', text: 'Read a book this afternoon. It was so captivating I lost track of time. A good story is a wonderful escape.' }
    ];

    // --- UI Rendering Logic ---
    function renderJournalFeed(entries) {
        journalFeed.innerHTML = ''; // Clear the feed before rendering
        for (const entry of entries) {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.innerHTML = `
                <div class="metadata">${entry.date}</div>
                <div class="body-text">${entry.text}</div>
            `;
            journalFeed.appendChild(card);
        }
    }

    // --- Event Listeners & Initial Setup ---

    // Timeline View Scroll Animation
    timelineView.addEventListener('scroll', () => {
        timelineHeader.classList.toggle('collapsed', timelineView.scrollTop > 40);
    });

    // FAB opens Composer View
    fab.addEventListener('click', () => {
        if (!document.getElementById('composer-header')) {
            populateComposerView();
        }
        composerView.classList.add('visible');
    });

    // Function to create and manage the composer view
    function populateComposerView() {
        composerView.innerHTML = `
            <div class="composer-header" id="composer-header">
                <button id="cancel-btn">Cancel</button>
                <button id="done-btn">Done</button>
            </div>
            <div id="suggestions-bar" class="swiper-container">
                <div class="swiper-wrapper">
                    <div class="swiper-slide suggestion-card">Recents</div>
                    <div class="swiper-slide suggestion-card">A Year Ago</div>
                    <div class="swiper-slide suggestion-card">Morning</div>
                    <div class="swiper-slide suggestion-card">Evening</div>
                    <div class="swiper-slide suggestion-card">Gratitude</div>
                    <div class="swiper-slide suggestion-card">Reflection</div>
                </div>
            </div>
            <div class="composer-content">
                 <div class="composer-metadata">
                    <input type="text" id="entry-title" placeholder="Title">
                    <div id="entry-date-location"></div>
                </div>
                <textarea id="entry-textarea" placeholder="Start writing..."></textarea>
            </div>
            <div class="composer-toolbar">
                <button>📷</button> <button>📸</button> <button>📍</button> <button>✏️</button> <button>Aa</button>
            </div>
        `;

        // Set current date in composer
        const dateElement = document.getElementById('entry-date-location');
        dateElement.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

        // Event listener for the Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            composerView.classList.remove('visible');
        });

        // Event listener for the Done button (Data saving logic)
        document.getElementById('done-btn').addEventListener('click', () => {
            const title = document.getElementById('entry-title').value;
            const text = document.getElementById('entry-textarea').value;

            if (text.trim() === '') return; // Don't save empty entries

            const newEntryText = (title ? `<strong>${title}</strong><br>` : '') + text;
            const newEntryDate = new Date().toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
            }).toUpperCase().replace(',', '');

            // Add new entry to the start of our data array
            journalData.unshift({ date: newEntryDate, text: newEntryText });

            // Re-render the UI with the new data
            renderJournalFeed(journalData);

            // Reset and hide the composer
            document.getElementById('entry-title').value = '';
            document.getElementById('entry-textarea').value = '';
            composerView.classList.remove('visible');
        });

        // Initialize Swiper for the suggestions bar
        new Swiper('.swiper-container', {
            slidesPerView: 'auto',
            spaceBetween: 12,
            freeMode: true,
            freeModeMomentumRatio: 0.5,
            freeModeMomentumBounceRatio: 2.5,
        });
    }

    // --- Initial Application Load ---
    renderJournalFeed(journalData);
});