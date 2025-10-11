document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Setup ---
    const firebaseConfig = {
        apiKey: "AIzaSyCwZjm9jmF8UHAzK7cIVtoUwuB27QX0zuA",
        authDomain: "luna2-ba3ec.firebaseapp.com",
        databaseURL: "https://luna2-ba3ec-default-rtdb.europe-west1.firebasedatabase.app",
        projectId: "luna2-ba3ec",
        storageBucket: "luna2-ba3ec.firebasestorage.app",
        messagingSenderId: "220309039843",
        appId: "1:220309039843:web:735b36668c63a01a20f3d6",
        measurementId: "G-HZ0K9S89JL"
    };
    // Initialize Firebase
    const app = firebase.initializeApp(firebaseConfig);
    const database = firebase.database();

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
        journals: [],
        currentJournalId: null,
    };
    let currentlyEditingEntryId = null;
    let initialEntryState = null; // Used to check for unsaved changes

    // --- Firebase Refs ---
    const journalsRef = database.ref('journals');

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
    function renderJournalFeed(entries, showJournalName = false) {
        journalFeed.innerHTML = '';
        // Note: 'entries' is now an array of objects, each with an 'id' property
        entries.forEach(entry => {
            const card = document.createElement('div');
            card.className = 'journal-card';
            card.dataset.id = entry.id; // Use the entry's Firebase key
            card.dataset.journalId = entry.journalId; // Store journalId for opening
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
                ${showJournalName ? `<div class="journal-name-indicator">${entry.journalName}</div>` : ''}
                <div class="metadata">${formatISODateForDisplay(entry.date)}</div>
                <div class="body-text" dir="${textDir}">${bodyHtml}</div>
            `;
            journalFeed.appendChild(card);
        });
    }

    function renderJournalsList(journals) {
        const container = document.getElementById('journals-list-container');
        container.innerHTML = '';
        journals.forEach(journal => {
            const wrapper = document.createElement('div');
            wrapper.className = 'journal-list-item-wrapper';

            const item = document.createElement('div');
            item.className = 'journal-list-item';
            item.textContent = journal.name;
            item.dataset.id = journal.id; // Use Firebase key as ID

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-journal-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.dataset.id = journal.id; // Use Firebase key for deletion

            wrapper.appendChild(item);
            wrapper.appendChild(deleteBtn);
            container.appendChild(wrapper);
        });
    }

    // --- Screen Navigation ---
    function showTimelineView(journalId) {
        appData.currentJournalId = journalId;
        const journal = appData.journals.find(j => j.id === journalId);
        if (!journal) return;

        mainTitle.textContent = journal.name;
        document.getElementById('search-input').value = '';

        // Entries in Firebase are objects, convert to array with IDs and sort
        const entriesArray = journal.entries
            ? Object.keys(journal.entries).map(key => ({ id: key, journalId: journal.id, ...journal.entries[key] }))
            : [];
        entriesArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        renderJournalFeed(entriesArray);
        journalsListView.style.display = 'none';
        timelineView.style.display = 'block';
    }

    function showJournalsListView() {
        appData.currentJournalId = null;
        renderJournalsList(appData.journals);
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
                    <input type="text" id="entry-title" placeholder="${isEditing ? 'כותרת' : ''}" dir="rtl" ${!isEditing ? 'disabled' : ''}>
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

        // Store the initial state for checking for unsaved changes if in edit mode
        if (isEditing) {
            // For a new entry, the state is empty. For an existing one, it's the current content.
            initialEntryState = {
                title: titleInput.value,
                text: textInput.innerText,
                date: dateInput.value
            };
        } else {
            // No tracking needed for view mode
            initialEntryState = null;
        }

        // Event Listeners
        document.getElementById('close-cancel-btn').addEventListener('click', () => {
            // Check for unsaved changes only if we were in edit mode
            if (initialEntryState) {
                const titleInput = document.getElementById('entry-title');
                const textInput = document.getElementById('entry-textarea');
                const dateInput = document.getElementById('entry-date');

                const currentState = {
                    title: titleInput.value,
                    text: textInput.innerText,
                    date: dateInput.value
                };

                const hasChanged = currentState.title !== initialEntryState.title ||
                                   currentState.text !== initialEntryState.text ||
                                   currentState.date !== initialEntryState.date;

                if (hasChanged) {
                    if (confirm('עדיין לא שמרת. האם אתה בטוח שאתה רוצה לסגור?')) {
                        composerView.classList.remove('visible');
                    }
                } else {
                    // No changes, close without confirmation
                    composerView.classList.remove('visible');
                }
            } else {
                // Not in edit mode (view mode), just close
                composerView.classList.remove('visible');
            }
        });

        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => {
                // When switching from view to edit, we need to capture the state
                populateComposerView(entry, 'edit');
            });
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
                const entryData = { date: newEntryDate, text: newEntryText };

                const journalEntriesRef = journalsRef.child(appData.currentJournalId).child('entries');

                if (isNewEntry) {
                    const newEntryRef = journalEntriesRef.push();
                    newEntryRef.set(entryData);
                } else {
                    journalEntriesRef.child(currentlyEditingEntryId).update(entryData);
                }

                composerView.classList.remove('visible');
            });
        }

        const deleteBtn = document.getElementById('delete-entry-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('האם את בטוחה שאת רוצה למחוק את הרשומה?')) {
                    if (currentlyEditingEntryId) {
                        journalsRef.child(appData.currentJournalId).child('entries').child(currentlyEditingEntryId).remove();
                        composerView.classList.remove('visible');
                    }
                }
            });
        }
    }

    // --- Global Event Listeners ---
    fab.addEventListener('click', () => {
        currentlyEditingEntryId = null;
        populateComposerView(null, 'edit'); // Open directly in edit mode for new entry
        composerView.classList.add('visible');
    });

    journalFeed.addEventListener('click', (e) => {
        const card = e.target.closest('.journal-card');
        if (card) {
            const entryId = card.dataset.id;
            const journalId = card.dataset.journalId || appData.currentJournalId;
            currentlyEditingEntryId = entryId;
            appData.currentJournalId = journalId; // Set current journal for composer logic
            const journal = appData.journals.find(j => j.id === journalId);
            const entry = journal.entries[entryId];
            populateComposerView({ id: entryId, ...entry }, 'view');
            composerView.classList.add('visible');
        }
    });

    document.getElementById('back-to-journals-btn').addEventListener('click', showJournalsListView);

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        let allEntries = [];
        let showJournalName = false;

        if (appData.currentJournalId) {
            // Search within a single journal
            const journal = appData.journals.find(j => j.id === appData.currentJournalId);
            if (journal && journal.entries) {
                allEntries = Object.keys(journal.entries).map(key => ({ id: key, ...journal.entries[key] }));
            }
        } else {
            // Search across all journals (we are in "All Entries" view)
            showJournalName = true;
            appData.journals.forEach(journal => {
                if (journal.entries) {
                    const entriesArray = Object.keys(journal.entries).map(key => ({
                        id: key,
                        journalId: journal.id,
                        journalName: journal.name,
                        ...journal.entries[key]
                    }));
                    allEntries = allEntries.concat(entriesArray);
                }
            });
        }

        const filteredEntries = searchTerm.trim() === ''
            ? allEntries
            : allEntries.filter(entry => entry.text.toLowerCase().includes(searchTerm));

        filteredEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderJournalFeed(filteredEntries, showJournalName);
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

    const lockAppBtn = document.getElementById('lock-app-btn');
    const showAllEntriesBtn = document.getElementById('show-all-entries-btn');
    const editJournalsBtn = document.getElementById('journals-list-edit-btn');
    const doneJournalsBtn = document.getElementById('journals-list-done-btn');

    function showAllEntriesView() {
        let allEntries = [];
        appData.journals.forEach(journal => {
            if (journal.entries) {
                const entriesArray = Object.keys(journal.entries).map(key => ({
                    id: key,
                    journalId: journal.id,
                    journalName: journal.name,
                    ...journal.entries[key]
                }));
                allEntries = allEntries.concat(entriesArray);
            }
        });

        allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));

        mainTitle.textContent = "כל הרשומות";
        renderJournalFeed(allEntries, true); // Pass true to show journal names
        journalsListView.style.display = 'none';
        timelineView.style.display = 'block';
        // In "All Entries" view, we don't have a single current journal
        appData.currentJournalId = null;
    }

    showAllEntriesBtn.addEventListener('click', showAllEntriesView);

    lockAppBtn.addEventListener('click', () => {
        // Hide all main views
        journalsListView.style.display = 'none';
        timelineView.style.display = 'none';
        composerView.classList.remove('visible');

        // Show the password view
        passwordView.style.display = 'flex';
        passwordInput.value = ''; // Clear password field
        passwordInput.focus();
    });

    editJournalsBtn.addEventListener('click', () => {
        journalsListView.classList.add('edit-mode');
        editJournalsBtn.style.display = 'none';
        doneJournalsBtn.style.display = 'block';
    });

    doneJournalsBtn.addEventListener('click', () => {
        journalsListView.classList.remove('edit-mode');
        doneJournalsBtn.style.display = 'none';
        editJournalsBtn.style.display = 'block';
    });

    const journalsListContainer = document.getElementById('journals-list-container');
    journalsListContainer.addEventListener('click', (e) => {
        if (journalsListView.classList.contains('edit-mode')) {
            const deleteBtn = e.target.closest('.delete-journal-btn');
            if (deleteBtn) {
                const journalId = deleteBtn.dataset.id;
                const journal = appData.journals.find(j => j.id === journalId);
                if (journal && confirm(`האם אתה בטוח שברצונך למחוק את היומן "${journal.name}"? פעולה זו היא בלתי הפיכה.`)) {
                    journalsRef.child(journalId).remove();
                }
            }
        } else {
            const journalItem = e.target.closest('.journal-list-item');
            if (journalItem) {
                showTimelineView(journalItem.dataset.id);
            }
        }
    });

    const newJournalModal = document.getElementById('new-journal-modal');
    const newJournalNameInput = document.getElementById('new-journal-name-input');
    const createNewJournalBtn = document.getElementById('create-new-journal-btn');
    const cancelNewJournalBtn = document.getElementById('cancel-new-journal-btn');

    document.getElementById('add-journal-fab').addEventListener('click', () => {
        newJournalNameInput.value = '';
        newJournalModal.style.display = 'flex';
        newJournalNameInput.focus();
    });

    function closeNewJournalModal() {
        newJournalModal.style.display = 'none';
    }

    cancelNewJournalBtn.addEventListener('click', closeNewJournalModal);

    createNewJournalBtn.addEventListener('click', () => {
        const newName = newJournalNameInput.value.trim();
        if (newName) {
            journalsRef.push({ name: newName, entries: {} });
            closeNewJournalModal();
        }
    });

    // --- Password Logic ---
    const passwordInput = document.getElementById('password-input');
    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const CORRECT_PASSWORD = '6417';

    function checkPassword() {
        if (passwordInput.value === CORRECT_PASSWORD) {
            passwordView.style.display = 'none';

            // Initial load and listen for changes from Firebase
            journalsRef.on('value', (snapshot) => {
                const journalsData = snapshot.val();
                if (journalsData) {
                    appData.journals = Object.keys(journalsData).map(key => ({
                        id: key,
                        ...journalsData[key]
                    }));
                } else {
                    appData.journals = [];
                }

                // If a journal is being viewed, refresh its view, otherwise show list
                if (appData.currentJournalId) {
                    const currentJournalExists = appData.journals.some(j => j.id === appData.currentJournalId);
                    if (currentJournalExists) {
                        showTimelineView(appData.currentJournalId);
                    } else {
                        showJournalsListView();
                    }
                } else {
                    showJournalsListView();
                }
            });
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