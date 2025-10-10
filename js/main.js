document.addEventListener('DOMContentLoaded', () => {
    // --- View Elements ---
    const timelineView = document.getElementById('timeline-view');
    const composerView = document.getElementById('composer-view');
    const fab = document.getElementById('fab');
    const timelineHeader = document.getElementById('timeline-header');
    const mainTitle = document.getElementById('main-title');
    const journalFeed = document.getElementById('journal-feed');

    // --- Data Store (Single Source of Truth) ---
    let journalData = [
        { date: new Date('2025-10-09T12:42:00').toISOString(), text: 'This is the first journal entry. It has a bit of text to see how the truncation works. Hopefully it looks good on the screen.' },
        { date: new Date('2025-10-08T08:15:00').toISOString(), text: 'Another day, another entry. I am building a journal app. It is fun. I am using HTML, CSS, and JavaScript. I am following a design specification.' },
        { date: new Date('2025-10-07T21:00:00').toISOString(), text: 'This is a shorter entry.' },
        { date: new Date('2025-10-06T18:30:00').toISOString(), text: 'Thinking about what to have for dinner. Maybe pizza? Or perhaps something healthier. The eternal struggle.' },
        { date: new Date('2025-10-05T11:00:00').toISOString(), text: 'Went for a walk in the park. The weather was perfect. The leaves are starting to change color. Autumn is a beautiful season.' },
        { date: new Date('2025-10-04T14:00:00').toISOString(), text: 'Worked on a coding project today. It was challenging but I made good progress. Feeling accomplished.' },
        { date: new Date('2025-10-03T22:00:00').toISOString(), text: 'Watched a movie with friends. It was a lot of fun. We should do it more often.' },
        { date: new Date('2025-10-02T07:00:00').toISOString(), text: 'Woke up early to go for a run. It was tough but I feel great now. Ready to start the day.' },
        { date: new Date('2025-10-01T16:00:00').toISOString(), text: 'Read a book this afternoon. It was so captivating I lost track of time. A good story is a wonderful escape.' }
    ];

    // --- Helper Functions ---
    function formatISODateForDisplay(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
        }).toUpperCase().replace(',', '');
    }

    // Converts a date object or ISO string to the format required by datetime-local input
    function formatISOForInput(isoString) {
        const date = new Date(isoString);
        // Adjust for timezone offset to display local time correctly in the input
        const timezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - timezoneOffset);
        return localDate.toISOString().slice(0, 16);
    }

    // --- UI Rendering Logic ---
    function renderJournalFeed(entries) {
        journalFeed.innerHTML = ''; // Clear the feed before rendering
        entries.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.dataset.index = index; // Add index for identifying the entry
            card.innerHTML = `
                <div class="metadata">${formatISODateForDisplay(entry.date)}</div>
                <div class="body-text">${entry.text}</div>
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

    // Handle clicks on journal cards to open for editing
    journalFeed.addEventListener('click', (e) => {
        const card = e.target.closest('.journal-card');
        if (!card) return;

        const index = parseInt(card.dataset.index, 10);

        // Open the composer for editing
        currentlyEditingIndex = index;
        populateComposerView(journalData[index]);
        composerView.classList.add('visible');
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
                    <input type="datetime-local" id="entry-date">
                </div>
                <textarea id="entry-textarea" placeholder="Start writing..."></textarea>
            </div>
            <div class="composer-toolbar">
                <div>
                    <button>📷</button> <button>📸</button> <button>📍</button> <button>✏️</button> <button>Aa</button>
                </div>
                ${entry ? '<button id="delete-entry-btn">Delete Entry</button>' : ''}
            </div>
        `;

        const titleInput = document.getElementById('entry-title');
        const textInput = document.getElementById('entry-textarea');
        const dateInput = document.getElementById('entry-date');

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
            dateInput.value = formatISOForInput(entry.date);
        } else {
            // Set to current date and time for new entries
            dateInput.value = formatISOForInput(new Date().toISOString());
        }


        // Event listener for the Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            composerView.classList.remove('visible');
            currentlyEditingIndex = null; // Reset editing state on cancel
        });

        // Event listener for the new Delete button inside the composer
        const deleteBtn = document.getElementById('delete-entry-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (currentlyEditingIndex !== null) {
                    journalData.splice(currentlyEditingIndex, 1);
                    renderJournalFeed(journalData);
                    composerView.classList.remove('visible');
                    currentlyEditingIndex = null;
                }
            });
        }

        // Event listener for the Done/Update button
        document.getElementById('done-btn').addEventListener('click', () => {
            const title = titleInput.value;
            const text = textInput.value;
            const dateValue = dateInput.value;

            if ((text.trim() === '' && title.trim() === '') || !dateValue) return;

            const newEntryText = (title ? `<strong>${title}</strong><br>` : '') + text;
            const newEntryDate = new Date(dateValue).toISOString();

            if (currentlyEditingIndex !== null) {
                // Update existing entry
                journalData[currentlyEditingIndex].text = newEntryText;
                journalData[currentlyEditingIndex].date = newEntryDate;
            } else {
                // Add new entry
                journalData.unshift({ date: newEntryDate, text: newEntryText });
            }

            // Sort entries by date after adding/editing
            journalData.sort((a, b) => new Date(b.date) - new Date(a.date));

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