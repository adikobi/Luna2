document.addEventListener('DOMContentLoaded', () => {
    // --- View Elements ---
    const timelineView = document.getElementById('timeline-view');
    const composerView = document.getElementById('composer-view');
    const fab = document.getElementById('fab');
    const timelineHeader = document.getElementById('timeline-header');
    const mainTitle = document.getElementById('main-title');
    const journalFeed = document.getElementById('journal-feed');

    // --- Data Store (Single Source of Truth) ---
    let appData = {
        journals: [
            {
                name: "יומן אישי",
                entries: [
                    { date: new Date('2025-10-09T12:42:00').toISOString(), text: 'This is the first journal entry. It has a bit of text to see how the truncation works. Hopefully it looks good on the screen.' },
                    { date: new Date('2025-10-08T08:15:00').toISOString(), text: 'Another day, another entry. I am building a journal app. It is fun. I am using HTML, CSS, and JavaScript. I am following a design specification.' },
                    { date: new Date('2025-10-07T21:00:00').toISOString(), text: 'This is a shorter entry.' },
                    { date: new Date('2025-10-06T18:30:00').toISOString(), text: 'Thinking about what to have for dinner. Maybe pizza? Or perhaps something healthier. The eternal struggle.' },
                    { date: new Date('2025-10-05T11:00:00').toISOString(), text: 'Went for a walk in the park. The weather was perfect. The leaves are starting to change color. Autumn is a beautiful season.' },
                    { date: new Date('2025-10-04T14:00:00').toISOString(), text: 'Worked on a coding project today. It was challenging but I made good progress. Feeling accomplished.' },
                    { date: new Date('2025-10-03T22:00:00').toISOString(), text: 'Watched a movie with friends. It was a lot of fun. We should do it more often.' },
                    { date: new Date('2025-10-02T07:00:00').toISOString(), text: 'Woke up early to go for a run. It was tough but I feel great now. Ready to start the day.' },
                    { date: new Date('2025-10-01T16:00:00').toISOString(), text: 'Read a book this afternoon. It was so captivating I lost track of time. A good story is a wonderful escape.' }
                ]
            }
        ],
        currentJournalIndex: null
    };

    // --- Helper Functions ---
    function formatISODateForDisplay(isoString) {
        const date = new Date(isoString);
        // Use 'he-IL' locale for Hebrew dates, and a 24-hour clock format.
        return date.toLocaleDateString('he-IL', {
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    // Converts a date object or ISO string to the format required by datetime-local input
    function formatISOForInput(isoString) {
        const date = new Date(isoString);
        // Adjust for timezone offset to display local time correctly in the input
        const timezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - timezoneOffset);
        return localDate.toISOString().slice(0, 16);
    }

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return text.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    function isHebrew(text) {
        const hebrewRegex = /[\u0590-\u05FF]/;
        return hebrewRegex.test(text);
    }

    // --- UI Rendering Logic ---
    function renderJournalFeed(entries) {
        journalFeed.innerHTML = ''; // Clear the feed before rendering
        entries.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.dataset.index = index; // Add index for identifying the entry
            const textDir = isHebrew(entry.text) ? 'rtl' : 'ltr';
            card.innerHTML = `
                <div class="metadata">${formatISODateForDisplay(entry.date)}</div>
                <div class="body-text" dir="${textDir}">${linkify(entry.text)}</div>
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
        populateComposerView(appData.journals[appData.currentJournalIndex].entries[index]);
        composerView.classList.add('visible');
    });

    // Function to create and manage the composer view
    function populateComposerView(entry = null) {
        composerView.innerHTML = `
            <div class="composer-header" id="composer-header">
                <button id="cancel-btn">ביטול</button>
                <button id="done-btn">${entry ? 'עדכון' : 'סיום'}</button>
            </div>
            <div id="suggestions-bar" class="swiper-container">
                <div class="swiper-wrapper">
                    <div class="swiper-slide suggestion-card">אחרונים</div>
                    <div class="swiper-slide suggestion-card">לפני שנה</div>
                    <div class="swiper-slide suggestion-card">בוקר</div>
                    <div class="swiper-slide suggestion-card">ערב</div>
                    <div class="swiper-slide suggestion-card">הכרת תודה</div>
                    <div class="swiper-slide suggestion-card">הרהור</div>
                </div>
            </div>
            <div class="composer-content">
                 <div class="composer-metadata">
                    <input type="text" id="entry-title" placeholder="כותרת">
                    <input type="datetime-local" id="entry-date">
                </div>
                <textarea id="entry-textarea" placeholder="התחל לכתוב..."></textarea>
            </div>
            <div class="composer-toolbar">
                <div>
                    <button>📷</button> <button>📸</button> <button>📍</button> <button>✏️</button> <button>Aa</button>
                </div>
                ${entry ? '<button id="delete-entry-btn">מחק רשומה</button>' : ''}
            </div>
        `;

        const titleInput = document.getElementById('entry-title');
        const textInput = document.getElementById('entry-textarea');
        const dateInput = document.getElementById('entry-date');

        const setDirection = (el) => {
            el.dir = isHebrew(el.value) ? 'rtl' : 'ltr';
        };

        // Pre-fill form if editing an existing entry
        if (entry) {
            const titleRegex = /<strong>(.*?)<\/strong><br>(.*)/s;
            const match = entry.text.match(titleRegex);
            if (match) {
                titleInput.value = match[1];
                textInput.value = match[2];
            } else {
                titleInput.value = '';
                textInput.value = entry.text;
            }
            dateInput.value = formatISOForInput(entry.date);
        } else {
            // Set to current date and time for new entries
            dateInput.value = formatISOForInput(new Date().toISOString());
        }

        // Set initial direction and add listeners for dynamic changes
        setDirection(titleInput);
        setDirection(textInput);
        titleInput.addEventListener('input', () => setDirection(titleInput));
        textInput.addEventListener('input', () => setDirection(textInput));


        // Event listener for the Cancel button
        document.getElementById('cancel-btn').addEventListener('click', () => {
            composerView.classList.remove('visible');
            currentlyEditingIndex = null; // Reset editing state on cancel
        });

        // Event listener for the new Delete button inside the composer
        const deleteBtn = document.getElementById('delete-entry-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (currentlyEditingIndex !== null && appData.currentJournalIndex !== null) {
                    const currentJournal = appData.journals[appData.currentJournalIndex];
                    currentJournal.entries.splice(currentlyEditingIndex, 1);
                    renderJournalFeed(currentJournal.entries);
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

            const currentJournal = appData.journals[appData.currentJournalIndex];

            if (currentlyEditingIndex !== null) {
                // Update existing entry
                currentJournal.entries[currentlyEditingIndex].text = newEntryText;
                currentJournal.entries[currentlyEditingIndex].date = newEntryDate;
            } else {
                // Add new entry
                currentJournal.entries.unshift({ date: newEntryDate, text: newEntryText });
            }

            // Sort entries by date after adding/editing
            currentJournal.entries.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Re-render the UI
            renderJournalFeed(currentJournal.entries);

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

    // --- Screen Navigation Logic ---
    const journalsListView = document.getElementById('journals-list-view');
    // timelineView is already declared at the top
    const backToJournalsBtn = document.getElementById('back-to-journals-btn');

    function showTimelineView(journalIndex) {
        appData.currentJournalIndex = journalIndex;
        const journal = appData.journals[journalIndex];
        mainTitle.textContent = journal.name;
        renderJournalFeed(journal.entries);
        journalsListView.style.display = 'none';
        timelineView.style.display = 'block';
    }

    function showJournalsListView() {
        appData.currentJournalIndex = null;
        renderJournalsList();
        timelineView.style.display = 'none';
        journalsListView.style.display = 'block';
    }

    backToJournalsBtn.addEventListener('click', showJournalsListView);

    // --- Journals List Logic ---
    const journalsListContainer = document.getElementById('journals-list-container');
    const newJournalNameInput = document.getElementById('new-journal-name');
    const addJournalBtn = document.getElementById('add-journal-btn');

    journalsListContainer.addEventListener('click', (e) => {
        const journalItem = e.target.closest('.journal-list-item');
        if (journalItem) {
            const journalIndex = parseInt(journalItem.dataset.index, 10);
            showTimelineView(journalIndex);
        }
    });

    function renderJournalsList() {
        journalsListContainer.innerHTML = '';
        appData.journals.forEach((journal, index) => {
            const journalItem = document.createElement('div');
            journalItem.className = 'journal-list-item';
            journalItem.textContent = journal.name;
            journalItem.dataset.index = index;
            journalsListContainer.appendChild(journalItem);
        });
    }

    addJournalBtn.addEventListener('click', () => {
        const newName = newJournalNameInput.value.trim();
        if (newName) {
            appData.journals.push({ name: newName, entries: [] });
            newJournalNameInput.value = '';
            renderJournalsList();
        }
    });

    // --- Initial Application Load ---
    renderJournalsList();
});