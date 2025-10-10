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
        entries.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.dataset.index = index; // Add index for identifying the entry
            card.innerHTML = `
                <div class="metadata">${entry.date}</div>
                <div class="body-text">${entry.text}</div>
                <div class="journal-card-actions">
                    <button class="edit-btn">Edit</button>
                    <button class="delete-btn">Delete</button>
                </div>
            `;
            journalFeed.appendChild(card);
        });
    }

    // --- Event Listeners & Initial Setup ---

    // Timeline View Scroll Animation
    timelineView.addEventListener('scroll', () => {
        timelineHeader.classList.toggle('collapsed', timelineView.scrollTop > 40);
    });

    let currentlyEditingIndex = null; // To track which entry is being edited

    // FAB opens Composer View for a new entry
    fab.addEventListener('click', () => {
        currentlyEditingIndex = null; // Ensure we are in "new entry" mode
        populateComposerView();
        composerView.classList.add('visible');
    });

    // Handle clicks for Edit and Delete buttons using event delegation
    journalFeed.addEventListener('click', (e) => {
        const target = e.target;
        const card = target.closest('.journal-card');
        if (!card) return;

        const index = parseInt(card.dataset.index, 10);

        if (target.classList.contains('delete-btn')) {
            // Remove the entry from the data array
            journalData.splice(index, 1);
            // Re-render the feed
            renderJournalFeed(journalData);
        }

        if (target.classList.contains('edit-btn')) {
            currentlyEditingIndex = index;
            populateComposerView(journalData[index]);
            composerView.classList.add('visible');
        }
    });

    // Function to create and manage the composer view
    function populateComposerView(entry = null) {
        composerView.innerHTML = `
            <div class="composer-header" id="composer-header">
                <button id="cancel-btn">Cancel</button>
                <button id="done-btn">${entry ? 'Update' : 'Done'}</button>
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

        const titleInput = document.getElementById('entry-title');
        const textInput = document.getElementById('entry-textarea');
        const dateElement = document.getElementById('entry-date-location');

        // Pre-fill form if editing an existing entry
        if (entry) {
            const titleRegex = /<strong>(.*?)<\/strong><br>(.*)/s;
            const match = entry.text.match(titleRegex);
            if (match) {
                titleInput.value = match[1];
                textInput.value = match[2];
            } else {
                textInput.value = entry.text;
            }
            dateElement.textContent = entry.date;
        } else {
            dateElement.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }


        // Event listener for the Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            composerView.classList.remove('visible');
            currentlyEditingIndex = null; // Reset editing state on cancel
        });

        // Event listener for the Done/Update button
        document.getElementById('done-btn').addEventListener('click', () => {
            const title = titleInput.value;
            const text = textInput.value;

            if (text.trim() === '' && title.trim() === '') return;

            const newEntryText = (title ? `<strong>${title}</strong><br>` : '') + text;

            if (currentlyEditingIndex !== null) {
                // Update existing entry
                journalData[currentlyEditingIndex].text = newEntryText;
            } else {
                // Add new entry
                const newEntryDate = new Date().toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
                }).toUpperCase().replace(',', '');
                journalData.unshift({ date: newEntryDate, text: newEntryText });
            }

            // Re-render the UI
            renderJournalFeed(journalData);

            // Reset and hide the composer
            composerView.classList.remove('visible');
            currentlyEditingIndex = null; // Reset editing state
        });

        // Initialize Swiper for the suggestions bar
        new Swiper('.swiper-container', {
            slidesPerView: 'auto',
            spaceBetween: 12,
            freeMode: true,
        });
    }

    // --- Initial Application Load ---
    renderJournalFeed(journalData);
});