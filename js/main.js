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
    const insightsView = document.getElementById('insights-view');
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
    let calendarDate = new Date(); // State for the calendar's currently displayed month

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

    function countWords(str) {
        const cleanString = str.replace(/<\/?[^>]+(>|$)/g, " ").trim();
        if (cleanString === '') return 0;
        return cleanString.split(/\s+/).length;
    }

    // --- UI Rendering ---
    function renderJournalFeed(entries, showJournalName = false, container = journalFeed) {
        container.innerHTML = '';
         if (entries.length === 0 && container.id === 'entries-for-date-view') {
            container.innerHTML = '<p class="no-entries-message">אין רשומות בתאריך זה.</p>';
            return;
        }
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
                bodyHtml = `<strong>${title}</strong><br>${linkify(body)}`;
            } else {
                bodyHtml = linkify(entry.text);
            }

            card.innerHTML = `
                ${showJournalName ? `<div class="journal-name-indicator">${entry.journalName}</div>` : ''}
                <div class="metadata">${formatISODateForDisplay(entry.date)}</div>
                <div class="body-text" dir="${textDir}">${bodyHtml}</div>
            `;
            container.appendChild(card);
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
            item.dataset.id = journal.id;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-journal-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.dataset.id = journal.id;

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

        const entriesArray = journal.entries
            ? Object.keys(journal.entries).map(key => ({ id: key, journalId: journal.id, ...journal.entries[key] }))
            : [];
        entriesArray.sort((a, b) => new Date(b.date) - new Date(a.date));

        renderJournalFeed(entriesArray);
        journalsListView.style.display = 'none';
        insightsView.style.display = 'none';
        timelineView.style.display = 'block';
    }

    function showJournalsListView() {
        appData.currentJournalId = null;
        renderJournalsList(appData.journals);
        timelineView.style.display = 'none';
        insightsView.style.display = 'none';
        journalsListView.style.display = 'block';
    }

    function showInsightsView() {
        const stats = calculateInsights();
        renderInsightsDetailView(stats);
        renderCalendar(calendarDate);
        journalsListView.style.display = 'none';
        insightsView.style.display = 'block';
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

        if (isEditing) {
            initialEntryState = {
                title: titleInput.value,
                text: textInput.innerText,
                date: dateInput.value
            };
        } else {
            initialEntryState = null;
        }

        document.getElementById('close-cancel-btn').addEventListener('click', () => {
            if (initialEntryState) {
                const currentState = {
                    title: document.getElementById('entry-title').value,
                    text: document.getElementById('entry-textarea').innerText,
                    date: document.getElementById('entry-date').value
                };
                const hasChanged = currentState.title !== initialEntryState.title ||
                                   currentState.text !== initialEntryState.text ||
                                   currentState.date !== initialEntryState.date;
                if (hasChanged && !confirm('עדיין לא שמרת. האם אתה בטוח שאתה רוצה לסגור?')) {
                    return;
                }
            }
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
                const entryData = { date: newEntryDate, text: newEntryText };
                const journalEntriesRef = journalsRef.child(appData.currentJournalId).child('entries');

                if (isNewEntry) {
                    journalEntriesRef.push(entryData);
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

    // --- Insights Logic ---
    function calculateInsights() {
        const currentYear = new Date().getFullYear();
        let entriesThisYear = 0;
        let wordsAllTime = 0;
        const daysJournaled = new Set();

        appData.journals.forEach(journal => {
            if (!journal.entries) return;
            Object.values(journal.entries).forEach(entry => {
                const entryDate = new Date(entry.date);
                if (entryDate.getFullYear() === currentYear) {
                    entriesThisYear++;
                }
                const dateString = entryDate.toISOString().split('T')[0];
                daysJournaled.add(dateString);
                wordsAllTime += countWords(entry.text);
            });
        });

        return { entriesThisYear, daysJournaled: daysJournaled.size, wordsAllTime };
    }

    function renderInsightsWidget(stats) {
        const container = document.getElementById('insights-widget-container');
        container.innerHTML = `
            <div class="insights-widget">
                <div class="main-stat">
                    <div class="count">${stats.entriesThisYear}</div>
                    <div class="label">Entries This Year</div>
                </div>
                <div class="sub-stats">
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        <div class="text">
                            <div class="count">${stats.daysJournaled}</div>
                            <div class="label">Days Journaled</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-quote-left"></i>
                        <div class="text">
                            <div class="count">${stats.wordsAllTime}</div>
                            <div class="label">Words All Time</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.querySelector('.insights-widget').addEventListener('click', showInsightsView);
    }

    function renderInsightsDetailView(stats) {
        const container = document.querySelector('#insights-view .insights-main-stats');
        container.innerHTML = `
            <div class="stat-card entries-year">
                <div class="count">${stats.entriesThisYear}</div>
                <div class="label">Entries This Year</div>
            </div>
            <div class="stat-card days-journaled">
                <div class="count">${stats.daysJournaled}</div>
                <div class="label">Days Journaled</div>
            </div>
            <div class="stat-card words-written">
                <div class="count">${stats.wordsAllTime}</div>
                <div class="label">Words Written</div>
            </div>
        `;
    }

    function renderCalendar(date) {
        const grid = document.getElementById('calendar-grid');
        const monthYearDisplay = document.getElementById('month-year-display');
        grid.innerHTML = '';
        document.getElementById('entries-for-date-view').innerHTML = '';

        const year = date.getFullYear();
        const month = date.getMonth();
        monthYearDisplay.textContent = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const entryDates = new Set();
        appData.journals.forEach(journal => {
            if (journal.entries) {
                Object.values(journal.entries).forEach(entry => {
                    entryDates.add(new Date(entry.date).toISOString().split('T')[0]);
                });
            }
        });

        const dayNames = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
        dayNames.forEach(name => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day day-name';
            dayEl.textContent = name;
            grid.appendChild(dayEl);
        });

        for (let i = 0; i < firstDayOfMonth; i++) {
            grid.appendChild(document.createElement('div'));
        }

        for (let i = 1; i <= daysInMonth; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day is-clickable'; // Always clickable
            dayEl.textContent = i;
            const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

            if (entryDates.has(dateString)) {
                dayEl.classList.add('has-entry');
            }

            dayEl.addEventListener('click', () => {
                document.querySelectorAll('.calendar-day.is-selected').forEach(el => el.classList.remove('is-selected'));
                dayEl.classList.add('is-selected');
                renderEntriesForDate(dateString);
            });

            grid.appendChild(dayEl);
        }
    }

    function renderEntriesForDate(dateString) {
        const container = document.getElementById('entries-for-date-view');
        let entriesForDate = [];
        appData.journals.forEach(journal => {
            if(journal.entries) {
                Object.keys(journal.entries).forEach(key => {
                    const entry = journal.entries[key];
                    if (new Date(entry.date).toISOString().startsWith(dateString)) {
                        entriesForDate.push({
                            id: key,
                            journalId: journal.id,
                            journalName: journal.name,
                            ...entry
                        });
                    }
                });
            }
        });
        entriesForDate.sort((a, b) => new Date(b.date) - new Date(a.date));
        renderJournalFeed(entriesForDate, true, container);
    }

    // --- Global Event Listeners ---
    fab.addEventListener('click', () => {
        currentlyEditingEntryId = null;
        populateComposerView(null, 'edit');
        composerView.classList.add('visible');
    });

    document.body.addEventListener('click', (e) => {
        const card = e.target.closest('.journal-card');
        if (card && card.parentElement.id !== 'entries-for-date-view') {
            const entryId = card.dataset.id;
            const journalId = card.dataset.journalId || appData.currentJournalId;
            currentlyEditingEntryId = entryId;
            appData.currentJournalId = journalId;
            const journal = appData.journals.find(j => j.id === journalId);
            const entry = journal.entries[entryId];
            populateComposerView({ id: entryId, ...entry }, 'view');
            composerView.classList.add('visible');
        }
    });

    document.getElementById('back-to-journals-btn').addEventListener('click', showJournalsListView);
    document.getElementById('back-to-journals-from-insights-btn').addEventListener('click', showJournalsListView);

    document.getElementById('prev-month-btn').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() - 1);
        renderCalendar(calendarDate);
    });

    document.getElementById('next-month-btn').addEventListener('click', () => {
        calendarDate.setMonth(calendarDate.getMonth() + 1);
        renderCalendar(calendarDate);
    });

    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase();
        let allEntries = [];
        let showJournalName = false;

        if (appData.currentJournalId) {
            const journal = appData.journals.find(j => j.id === appData.currentJournalId);
            if (journal && journal.entries) {
                allEntries = Object.keys(journal.entries).map(key => ({ id: key, ...journal.entries[key] }));
            }
        } else {
            showJournalName = true;
            appData.journals.forEach(journal => {
                if (journal.entries) {
                    const entriesArray = Object.keys(journal.entries).map(key => ({
                        id: key, journalId: journal.id, journalName: journal.name, ...journal.entries[key]
                    }));
                    allEntries = allEntries.concat(entriesArray);
                }
            });
        }
        const filteredEntries = searchTerm.trim() === '' ? allEntries : allEntries.filter(entry => entry.text.toLowerCase().includes(searchTerm));
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
                    id: key, journalId: journal.id, journalName: journal.name, ...journal.entries[key]
                }));
                allEntries = allEntries.concat(entriesArray);
            }
        });
        allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        mainTitle.textContent = "כל הרשומות";
        renderJournalFeed(allEntries, true);
        journalsListView.style.display = 'none';
        insightsView.style.display = 'none';
        timelineView.style.display = 'block';
        appData.currentJournalId = null;
    }

    showAllEntriesBtn.addEventListener('click', showAllEntriesView);

    lockAppBtn.addEventListener('click', () => {
        journalsListView.style.display = 'none';
        timelineView.style.display = 'none';
        insightsView.style.display = 'none';
        composerView.classList.remove('visible');
        passwordView.style.display = 'flex';
        passwordInput.value = '';
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
        if (passwordInput.value.trim() === CORRECT_PASSWORD) {
            passwordView.style.display = 'none';

            journalsRef.on('value', (snapshot) => {
                const journalsData = snapshot.val();
                appData.journals = journalsData ? Object.keys(journalsData).map(key => ({ id: key, ...journalsData[key] })) : [];

                const stats = calculateInsights();
                renderInsightsWidget(stats);

                if (appData.currentJournalId) {
                    const currentJournalExists = appData.journals.some(j => j.id === appData.currentJournalId);
                    if (currentJournalExists) {
                        showTimelineView(appData.currentJournalId);
                    } else {
                        showJournalsListView();
                    }
                } else if (journalsListView.style.display === 'block' || insightsView.style.display === 'block') {
                    showJournalsListView();
                } else if (timelineView.style.display === 'block') {
                    // This handles the "All Entries" view refresh
                    const isAllEntriesView = mainTitle.textContent === "כל הרשומות";
                    if(isAllEntriesView){
                        showAllEntriesView();
                    }
                }
                 else {
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