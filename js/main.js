document.addEventListener('DOMContentLoaded', () => {
    // Ensure composer is a direct child of body to avoid stacking context issues
    document.body.appendChild(document.getElementById('composer-view'));

    // --- View Elements ---
    const passwordView = document.getElementById('password-view');
    const journalsListView = document.getElementById('journals-list-view');
    const timelineView = document.getElementById('timeline-view');
    const composerView = document.getElementById('composer-view');
    const mainTitle = document.getElementById('main-title');
    const journalFeed = document.getElementById('journal-feed');
    const fab = document.getElementById('fab');

    // --- Data Store ---
    let appData = {
        journals: [
            {
                name: "יומן אישי",
                entries: [
                    { date: new Date('2025-10-09T12:42:00').toISOString(), text: 'This is the first journal entry. It has a bit of text to see how the truncation works. Check out this link: https://www.google.com' },
                    { date: new Date('2025-10-08T08:15:00').toISOString(), text: 'Another day, another entry. I am building a journal app.' },
                    { date: new Date('2025-10-07T21:00:00').toISOString(), text: 'This is a shorter entry.' }
                ]
            }
        ],
        currentJournalIndex: null
    };
    let currentlyEditingIndex = null;

    // --- Helper Functions ---
    function formatISODateForDisplay(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
        });
    }

    function formatISOForInput(isoString) {
        const date = new Date(isoString);
        const timezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() - timezoneOffset);
        return localDate.toISOString().slice(0, 16);
    }

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        // First, escape HTML to prevent XSS
        let escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Then, convert newlines to <br>
        escapedText = escapedText.replace(/\n/g, '<br>');
        // Finally, linkify URLs
        return escapedText.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
    }

    function isHebrew(text) {
        const hebrewRegex = /[\u0590-\u05FF]/;
        return hebrewRegex.test(text);
    }

    // --- UI Rendering ---
    function renderJournalFeed(entries) {
        journalFeed.innerHTML = '';
        entries.forEach((entry, index) => {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.dataset.index = index;
            const textDir = isHebrew(entry.text) ? 'rtl' : 'ltr';

            const titleRegex = /<strong>(.*?)<\/strong><br>(.*)/s;
            const match = entry.text.match(titleRegex);
            let bodyHtml = '';

            if (match) {
                const title = match[1];
                const body = match[2];
                // Manually construct HTML, only linkifying the body part
                bodyHtml = `<strong>${title}</strong><br>${linkify(body)}`;
            } else {
                // If no title, linkify the whole text safely
                bodyHtml = linkify(entry.text);
            }

            card.innerHTML = `
                <div class="metadata">${formatISODateForDisplay(entry.date)}</div>
                <div class="body-text" dir="${textDir}">${bodyHtml}</div>
            `;
            journalFeed.appendChild(card);
        });
    }

    function renderJournalsList() {
        const container = document.getElementById('journals-list-container');
        container.innerHTML = '';
        appData.journals.forEach((journal, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'journal-list-item-wrapper';

            const item = document.createElement('div');
            item.className = 'journal-list-item';
            item.textContent = journal.name;
            item.dataset.index = index;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-journal-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.dataset.index = index;

            wrapper.appendChild(item);
            wrapper.appendChild(deleteBtn);
            container.appendChild(wrapper);
        });
    }

    // --- Screen Navigation ---
    function showTimelineView(journalIndex) {
        appData.currentJournalIndex = journalIndex;
        const journal = appData.journals[journalIndex];
        mainTitle.textContent = journal.name;
        document.getElementById('search-input').value = '';
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

    // --- Composer Logic ---
    function populateComposerView(entry = null, mode = 'edit') {
        const isEditing = mode === 'edit';
        const isNewEntry = entry === null;

        composerView.innerHTML = `
            <div class="composer-header">
                <button id="close-cancel-btn">${isEditing && !isNewEntry ? 'ביטול' : 'סגור'}</button>
                <div>
                    ${!isEditing && !isNewEntry ? '<button id="edit-btn">ערוך</button>' : ''}
                    ${isEditing ? `<button id="save-btn">${isNewEntry ? 'סיום' : 'שמור'}</button>` : ''}
                </div>
            </div>
            <div class="composer-content">
                <div class="composer-metadata">
                    <input type="text" id="entry-title" placeholder="כותרת" dir="rtl" ${!isEditing ? 'disabled' : ''}>
                    <input type="datetime-local" id="entry-date" ${!isEditing ? 'disabled' : ''}>
                </div>
                <div id="entry-textarea" ${isEditing ? 'contenteditable="true"' : ''} placeholder="התחל לכתוב..." dir="rtl"></div>
            </div>
            <div class="composer-toolbar" style="justify-content: flex-end; display: ${isEditing && !isNewEntry ? 'flex' : 'none'};">
                <button id="delete-entry-btn">מחק רשומה</button>
            </div>
        `;

        const titleInput = document.getElementById('entry-title');
        const textInput = document.getElementById('entry-textarea');
        const dateInput = document.getElementById('entry-date');

        if (entry) {
            const titleRegex = /<strong>(.*?)<\/strong><br>(.*)/s;
            const match = entry.text.match(titleRegex);
            if (match) {
                titleInput.value = match[1];
                textInput.innerHTML = linkify(match[2]);
            } else {
                titleInput.value = '';
                textInput.innerHTML = linkify(entry.text);
            }
            dateInput.value = formatISOForInput(entry.date);
        } else {
            dateInput.value = formatISOForInput(new Date().toISOString());
        }

        // Event Listeners
        document.getElementById('close-cancel-btn').addEventListener('click', () => {
            composerView.classList.remove('visible');
        });

        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => populateComposerView(entry, 'edit'));
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const title = titleInput.value;

                const text = textInput.innerText;
                const dateValue = dateInput.value;

                if ((text.trim() === '' && title.trim() === '') || !dateValue) return;

                const newEntryText = (title ? `<strong>${title}</strong><br>` : '') + text;
                const newEntryDate = new Date(dateValue).toISOString();

                const currentJournal = appData.journals[appData.currentJournalIndex];
                if (isNewEntry) {
                    currentJournal.entries.unshift({ date: newEntryDate, text: newEntryText });
                } else {
                    currentJournal.entries[currentlyEditingIndex].text = newEntryText;
                    currentJournal.entries[currentlyEditingIndex].date = newEntryDate;
                }

                currentJournal.entries.sort((a, b) => new Date(b.date) - new Date(a.date));
                renderJournalFeed(currentJournal.entries);
                composerView.classList.remove('visible');
            });
        }

        const deleteBtn = document.getElementById('delete-entry-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (currentlyEditingIndex !== null) {
                    const currentJournal = appData.journals[appData.currentJournalIndex];
                    currentJournal.entries.splice(currentlyEditingIndex, 1);
                    renderJournalFeed(currentJournal.entries);
                    composerView.classList.remove('visible');
                }
            });
        }
    }

    // --- Global Event Listeners ---
    fab.addEventListener('click', () => {
        currentlyEditingIndex = null;
        populateComposerView(null, 'edit'); // Open directly in edit mode for new entry
        composerView.classList.add('visible');
    });

    journalFeed.addEventListener('click', (e) => {
        const card = e.target.closest('.journal-card');
        if (card) {
            const index = parseInt(card.dataset.index, 10);
            currentlyEditingIndex = index;
            populateComposerView(appData.journals[appData.currentJournalIndex].entries[index], 'view'); // Open in view mode
            composerView.classList.add('visible');
        }
    });

    document.getElementById('back-to-journals-btn').addEventListener('click', showJournalsListView);

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        const currentJournal = appData.journals[appData.currentJournalIndex];
        if (!currentJournal) return;
        const filteredEntries = searchTerm.trim() === ''
            ? currentJournal.entries
            : currentJournal.entries.filter(entry => entry.text.toLowerCase().includes(searchTerm));
        renderJournalFeed(filteredEntries);
    });

    document.getElementById('search-toggle-btn').addEventListener('click', () => {
        const container = document.querySelector('.search-bar-container');
        container.classList.toggle('visible');
        if (container.classList.contains('visible')) {
            searchInput.focus();
        } else if (searchInput.value !== '') {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input'));
        }
    });

    const journalsListContainer = document.getElementById('journals-list-container');
    journalsListContainer.addEventListener('click', (e) => {
        const journalItem = e.target.closest('.journal-list-item');
        const deleteBtn = e.target.closest('.delete-journal-btn');

        if (deleteBtn) {
            const index = parseInt(deleteBtn.dataset.index, 10);
            const journalName = appData.journals[index].name;
            if (confirm(`האם אתה בטוח שברצונך למחוק את היומן "${journalName}"? פעולה זו היא בלתי הפיכה.`)) {
                appData.journals.splice(index, 1);
                renderJournalsList();
            }
        } else if (journalItem) {
            showTimelineView(parseInt(journalItem.dataset.index, 10));
        }
    });

    document.getElementById('add-journal-fab').addEventListener('click', () => {
        const newName = prompt("הזן שם ליומן החדש:");
        if (newName && newName.trim()) {
            appData.journals.push({ name: newName.trim(), entries: [] });
            renderJournalsList();
        }
    });

    // --- Password Logic ---
    const passwordInput = document.getElementById('password-input');
    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const CORRECT_PASSWORD = '6417';

    function checkPassword() {
        if (passwordInput.value === CORRECT_PASSWORD) {
            passwordView.style.display = 'none';
            showJournalsListView();
        } else {
            passwordInput.parentElement.classList.add('shake');
            passwordInput.value = '';
            setTimeout(() => passwordInput.parentElement.classList.remove('shake'), 500);
        }
    }
    passwordSubmitBtn.addEventListener('click', checkPassword);
    passwordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') checkPassword();
    });
});