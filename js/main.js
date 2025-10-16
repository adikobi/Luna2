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
    const graphView = document.getElementById('graph-view');
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
    let insightsChart = {
        selectedYear: new Date().getFullYear(),
        allTime: true,
    };

    const EMOTIONS = ['😀', '😍', '😊', '😭', '😠', '😴', '😎', '🤔', '🤯', '🥺', '😂', '🥳', '😳', '😞', '😒', '😔', '🥹', '🥸', '😋', '😖', '😢', '😤', '😓', '😐', '🙄', '🥱', '🤢', '🤒', '🤧', '🤕', '🏊', '⚪'];

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

    function formatDateForComposerView(isoString) {
        const date = new Date(isoString);
        const options = {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        };
        return date.toLocaleDateString('he-IL', options);
    }

    function linkify(text) {
        const urlRegex = /(https?:\/\/[^\s\u0590-\u05FF]+)/g;
        // First, escape HTML to prevent XSS
        let escapedText = text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Linkify URLs first
        let linkifiedText = escapedText.replace(urlRegex, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');
        // Then, convert newlines to <br>
        return linkifiedText.replace(/\n/g, '<br>');
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
        if (entries.length === 0) {
            if (container.id === 'entries-for-date-view') {
                container.innerHTML = '<p class="no-entries-message">אין רשומות בתאריך זה.</p>';
            }
            return;
        }

        let lastMonth = null;

        entries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const currentMonth = entryDate.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

            if (currentMonth !== lastMonth) {
                const monthHeader = document.createElement('h2');
                monthHeader.className = 'month-header';
                monthHeader.textContent = currentMonth;
                container.appendChild(monthHeader);
                lastMonth = currentMonth;
            }

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

    function renderEmotionJournalView(journal) {
        journalFeed.innerHTML = ''; // Clear the feed

        // --- Calculate Date Range ---
        // To fix the bug, we must consider both text entries and emoji-only entries
        // to find the true start date of the journal.
        const textEntryDates = journal.entries ? Object.values(journal.entries).map(e => new Date(e.date)) : [];
        const emojiEntryDates = journal.emojis ? Object.keys(journal.emojis).map(d => new Date(d)) : [];

        const allEntryDates = [...textEntryDates, ...emojiEntryDates];
        allEntryDates.sort((a, b) => a - b); // Sort dates ascending to find the earliest

        const startDate = allEntryDates.length > 0 ? new Date(allEntryDates[0]) : new Date();
        startDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let allDates = [];
        let currentDate = new Date(startDate);

        while (currentDate <= today) {
            allDates.push(new Date(currentDate));
            currentDate.setDate(currentDate.getDate() + 1);
        }
        allDates.reverse(); // Show most recent dates first

        // Get saved emoji data from the journal object
        const savedEmojis = journal.emojis || {};

        // Group dates by month for rendering
        const datesByMonth = allDates.reduce((acc, date) => {
            const monthYear = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
            if (!acc[monthYear]) {
                acc[monthYear] = [];
            }
            acc[monthYear].push(date);
            return acc;
        }, {});

        // Render the HTML for the emotion tracker
        for (const monthYear in datesByMonth) {
            const monthHeader = document.createElement('h2');
            monthHeader.className = 'month-header';
            monthHeader.textContent = monthYear;
            journalFeed.appendChild(monthHeader);

            const gridContainer = document.createElement('div');
            gridContainer.className = 'emotion-grid';
            journalFeed.appendChild(gridContainer);

            const dates = datesByMonth[monthYear];
            dates.forEach(date => {
                const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                const selectedEmoji = savedEmojis[dateString] || '⚪';

                const dayCard = document.createElement('div');
                dayCard.className = 'emotion-day-card';
                dayCard.dataset.date = dateString;

                const dayOfWeek = date.toLocaleDateString('he-IL', { weekday: 'short' });
                const dayOfMonth = date.getDate();

                dayCard.innerHTML = `
                    <div class="emotion-date-header">
                        <span class="day-of-week">${dayOfWeek}</span>
                        <span class="day-of-month">${dayOfMonth}</span>
                    </div>
                    <div class="emotion-emoji-display">${selectedEmoji}</div>
                `;
                gridContainer.appendChild(dayCard);
            });
        }
    }

    // --- Screen Navigation ---
    function showTimelineView(journalId) {
        appData.currentJournalId = journalId;
        const journal = appData.journals.find(j => j.id === journalId);
        if (!journal) return;

        mainTitle.textContent = journal.name;
        document.getElementById('search-input').value = '';

        // --- Add Graph Button dynamically ---
        const timelineHeader = document.querySelector('#timeline-view .timeline-top-bar');

        // Cleanup previous dynamic elements from any state
        const existingGraphBtn = document.getElementById('show-graph-btn');
        if (existingGraphBtn) existingGraphBtn.remove();
        const existingSpacer = timelineHeader.querySelector('.spacer');
        if (existingSpacer) existingSpacer.remove();

        if (journal.name === 'משקל') {
            const graphBtn = document.createElement('button');
            graphBtn.id = 'show-graph-btn';
            graphBtn.innerHTML = '<i class="fas fa-chart-line"></i>';

            const spacer = document.createElement('div');
            spacer.className = 'spacer';
            spacer.style.flexGrow = '1';

            const searchBtn = document.getElementById('search-toggle-btn');
            const backBtn = document.getElementById('back-to-journals-btn');

            // Insert spacer between the two groups
            backBtn.after(spacer);
            // Insert the graph button before the search button to group them on the left
            searchBtn.before(graphBtn);
        }
        // ------------------------------------

        if (journal.name === 'רגשות') {
            renderEmotionJournalView(journal);
            fab.style.display = 'none';
        } else {
            const entriesArray = journal.entries
                ? Object.keys(journal.entries).map(key => ({ id: key, journalId: journal.id, ...journal.entries[key] }))
                : [];
            entriesArray.sort((a, b) => new Date(b.date) - new Date(a.date));

            renderJournalFeed(entriesArray);
            fab.style.display = 'block';
        }

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
        insightsChart.selectedYear = new Date().getFullYear();
        insightsChart.allTime = true;
        const stats = calculateInsights();
        renderInsightsDetailView(stats);
        renderCalendar(calendarDate);
        journalsListView.style.display = 'none';
        insightsView.style.display = 'block';
    }

    // --- Graph View Logic ---
    let weightChart = null; // To hold the Chart.js instance

    function parseWeightData(journal) {
        if (!journal || !journal.entries) return [];

        const entriesArray = Object.values(journal.entries);

        let data = entriesArray.map(entry => {
            // Strip HTML tags from the text before parsing
            const cleanText = entry.text.replace(/<[^>]*>?/gm, '');
            // Extract the first number (integer or float) from the cleaned text
            const match = cleanText.match(/(\d+(\.\d+)?)/);
            if (match) {
                return {
                    x: new Date(entry.date),
                    y: parseFloat(match[1])
                };
            }
            return null;
        }).filter(item => item !== null); // Filter out entries that didn't have a valid number

        // Sort by date ascending
        data.sort((a, b) => a.x - b.x);

        return data;
    }

    function renderWeightChart(data, range = '1m') {
        const ctx = document.getElementById('weight-chart').getContext('2d');

        const now = new Date();
        let startDate = new Date();

        switch (range) {
            case '1m': startDate.setMonth(now.getMonth() - 1); break;
            case '3m': startDate.setMonth(now.getMonth() - 3); break;
            case '6m': startDate.setMonth(now.getMonth() - 6); break;
            case '1y': startDate.setFullYear(now.getFullYear() - 1); break;
            case 'all': startDate = new Date(0); break; // A very early date
        }

        const filteredData = data.filter(d => d.x >= startDate);

        if (weightChart) {
            weightChart.data.labels = filteredData.map(d => d.x);
            weightChart.data.datasets[0].data = filteredData;
            weightChart.update();
        } else {
            weightChart = new Chart(ctx, {
                type: 'line',
                data: {
                    datasets: [{
                        label: 'Weight',
                        data: filteredData,
                        borderColor: 'rgba(211, 237, 231, 1)', // --color-accent-system
                        backgroundColor: 'rgba(211, 237, 231, 0.2)',
                        borderWidth: 2,
                        tension: 0.1,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    aspectRatio: 1,
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'day',
                                displayFormats: {
                                    day: 'MMM d'
                                }
                            },
                            ticks: { color: 'rgba(235, 235, 245, 0.6)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            beginAtZero: false,
                            ticks: {
                                color: 'rgba(235, 235, 245, 0.6)',
                                stepSize: 0.2
                            },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: {
                        legend: {
                            display: false
                        }
                    }
                }
            });
        }
    }

    function showGraphView() {
        const journal = appData.journals.find(j => j.id === appData.currentJournalId);
        if (!journal || journal.name !== 'משקל') return;

        // Show the view first to isolate rendering errors from visibility logic
        timelineView.style.display = 'none';
        graphView.style.display = 'block';

        const data = parseWeightData(journal);
        renderWeightChart(data, '1m'); // Default to 1 month view
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
                    <div id="date-container"></div>
                </div>
                <div id="entry-textarea" ${isEditing ? 'contenteditable="true"' : ''} placeholder="התחל לכתוב..." dir="rtl"></div>
            </div>
            <div class="composer-actions-toolbar" style="display: ${isEditing ? 'flex' : 'none'};">
                 <button id="add-checklist-btn" class="toolbar-btn" title="הוסף צ'קליסט">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-square"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </button>
            </div>
            <div class="composer-toolbar" style="justify-content: flex-end; display: ${isEditing && !isNewEntry ? 'flex' : 'none'};">
                <button id="delete-entry-btn">מחק רשומה</button>
            </div>
        `;

        const titleInput = document.getElementById('entry-title');
        const textInput = document.getElementById('entry-textarea');
        const dateContainer = document.getElementById('date-container');

        if (isEditing) {
            dateContainer.innerHTML = `<input type="datetime-local" id="entry-date">`;
        }

        const dateInput = document.getElementById('entry-date'); // May be null in view mode

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
            if (isEditing) {
                dateInput.value = formatISOForInput(entry.date);
            } else {
                dateContainer.innerHTML = `<p class="date-display">${formatDateForComposerView(entry.date)}</p>`;
            }
        } else { // New entry
            dateInput.value = formatISOForInput(new Date().toISOString());
        }

        if (isEditing) {
            initialEntryState = {
                title: titleInput.value,
                text: textInput.innerText,
                date: dateInput.value,
            };
        } else {
            initialEntryState = null;
        }

        document.getElementById('close-cancel-btn').addEventListener('click', () => {
            if (isEditing && initialEntryState) {
                const currentState = {
                    title: document.getElementById('entry-title').value,
                    text: document.getElementById('entry-textarea').innerText,
                    date: document.getElementById('entry-date').value,
                };
                const hasChanged =
                    currentState.title !== initialEntryState.title ||
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

        if (isEditing) {
            const addChecklistBtn = document.getElementById('add-checklist-btn');
            addChecklistBtn.addEventListener('click', () => {
                const textInput = document.getElementById('entry-textarea');
                textInput.focus();
                document.execCommand('insertText', false, '- [ ] ');
            });
        }
    }

    function showEmojiPicker(date) {
        const modal = document.getElementById('emoji-picker-modal');
        const optionsContainer = document.getElementById('emoji-options-container');
        optionsContainer.innerHTML = ''; // Clear previous options

        EMOTIONS.forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'emoji-option-btn';
            button.textContent = emoji;
            button.addEventListener('click', () => {
                const journalId = appData.currentJournalId;
                if (journalId) {
                    const emojiRef = journalsRef.child(journalId).child('emojis').child(date);
                    if (emoji === '⚪') {
                        emojiRef.remove(); // Remove from Firebase if "empty" is chosen
                    } else {
                        emojiRef.set(emoji); // Set the emoji in Firebase
                    }
                }
                modal.style.display = 'none'; // Close modal on selection
            });
            optionsContainer.appendChild(button);
        });

        modal.style.display = 'flex';
    }

    document.getElementById('cancel-emoji-picker-btn').addEventListener('click', () => {
        document.getElementById('emoji-picker-modal').style.display = 'none';
    });
    // --- Insights Logic ---
    function calculateInsights() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        const stats = {
            byYear: {},
            allTime: { entries: 0, words: 0, days: new Set() },
            thisMonth: { entries: 0, words: 0, days: new Set() },
            thisYear: { entries: 0, words: 0, days: new Set() },
        };

        appData.journals.forEach(journal => {
            if (!journal.entries) return;
            Object.values(journal.entries).forEach(entry => {
                const date = new Date(entry.date);
                const year = date.getFullYear();
                const month = date.getMonth();
                const day = date.toISOString().split('T')[0];
                const wordCount = countWords(entry.text);

                if (!stats.byYear[year]) {
                    stats.byYear[year] = {
                        totalEntries: 0,
                        totalWords: 0,
                        totalDays: new Set(),
                        byMonth: Array(12).fill(0).map(() => ({ entries: 0, words: 0, days: new Set() })),
                    };
                }

                stats.byYear[year].totalEntries++;
                stats.byYear[year].totalWords += wordCount;
                stats.byYear[year].totalDays.add(day);
                stats.byYear[year].byMonth[month].entries++;
                stats.byYear[year].byMonth[month].words += wordCount;
                stats.byYear[year].byMonth[month].days.add(day);

                stats.allTime.entries++;
                stats.allTime.words += wordCount;
                stats.allTime.days.add(day);

                if (year === currentYear) {
                    stats.thisYear.entries++;
                    stats.thisYear.words += wordCount;
                    stats.thisYear.days.add(day);
                    if (month === currentMonth) {
                        stats.thisMonth.entries++;
                        stats.thisMonth.words += wordCount;
                        stats.thisMonth.days.add(day);
                    }
                }
            });
        });

        Object.keys(stats.byYear).forEach(year => {
            stats.byYear[year].totalDays = stats.byYear[year].totalDays.size;
            stats.byYear[year].byMonth.forEach(month => {
                month.days = month.days.size;
            });
        });

        stats.allTime.days = stats.allTime.days.size;
        stats.thisMonth.days = stats.thisMonth.days.size;
        stats.thisYear.days = stats.thisYear.days.size;

        return stats;
    }


    function renderInsightsWidget(stats) {
        const container = document.getElementById('insights-widget-container');
        container.innerHTML = `
            <div class="insights-widget">
                <div class="main-stat">
                    <div class="count">${stats.thisYear.entries}</div>
                    <div class="label">Entries This Year</div>
                </div>
                <div class="sub-stats">
                    <div class="stat-item">
                        <i class="fas fa-calendar-alt"></i>
                        <div class="text">
                            <div class="count">${stats.allTime.days}</div>
                            <div class="label">Days Journaled</div>
                        </div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-quote-left"></i>
                        <div class="text">
                            <div class="count">${stats.allTime.words}</div>
                            <div class="label">Words All Time</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.querySelector('.insights-widget').addEventListener('click', showInsightsView);
    }

    function renderInsightsDetailView(stats) {
        renderMainStatContent(stats);
        renderExpandedStatContent(stats);
    }

    function renderMainStatContent(stats) {
        const entriesCardMain = document.querySelector('.stat-card[data-stat="entries"] .stat-card-main');
        const journaledCardMain = document.querySelector('.stat-card[data-stat="journaled"] .stat-card-main');
        const writtenCardMain = document.querySelector('.stat-card[data-stat="written"] .stat-card-main');

        const yearData = stats.byYear[insightsChart.selectedYear] || { totalEntries: 0 };
        const displayEntries = insightsChart.allTime ? stats.allTime.entries : yearData.totalEntries;
        const displayYear = insightsChart.allTime ? '' : insightsChart.selectedYear;

        entriesCardMain.innerHTML = `
            <div class="count">${displayEntries}</div>
            <div class="label">Entries ${displayYear}</div>
        `;

        journaledCardMain.innerHTML = `
            <div class="count">${stats.allTime.days}</div>
            <div class="label">Days</div>
        `;

        writtenCardMain.innerHTML = `
            <div class="count">${stats.allTime.words}</div>
            <div class="label">Words</div>
        `;
    }

    function renderExpandedStatContent(stats) {
        renderBarChart(stats);
        renderExpandedDetails(stats, 'journaled');
        renderExpandedDetails(stats, 'written');
    }

    function renderBarChart(stats) {
        const container = document.querySelector('.stat-card[data-stat="entries"] .stat-card-expanded');
        const allYears = [new Date().getFullYear(), ...Object.keys(stats.byYear).map(Number)].filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => b - a);
        const currentYear = insightsChart.selectedYear;
        const yearData = stats.byYear[currentYear];

        let monthlyEntries = Array(12).fill(0);
        if (insightsChart.allTime) {
            allYears.forEach(year => {
                if (stats.byYear[year]) {
                    stats.byYear[year].byMonth.forEach((monthData, index) => {
                        monthlyEntries[index] += monthData.entries;
                    });
                }
            });
        } else if (yearData) {
            monthlyEntries = yearData.byMonth.map(m => m.entries);
        }

        const maxEntries = Math.max(...monthlyEntries, 1);

        const yearTabs = allYears.map(year =>
            `<button class="year-selector-tab ${!insightsChart.allTime && insightsChart.selectedYear === year ? 'active' : ''}" data-year="${year}">${year}</button>`
        ).join('');

        container.innerHTML = `
            <div class="year-selector-tabs">
                <button class="year-selector-tab ${insightsChart.allTime ? 'active' : ''}" data-year="all-time">All-time</button>
                ${yearTabs}
            </div>
            <div class="bar-chart-container">
                ${monthlyEntries.map(count => `<div class="bar-chart-bar" style="height: ${(count / maxEntries) * 100}%"></div>`).join('')}
            </div>
            <div class="bar-chart-labels">
                ${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map(l => `<span>${l}</span>`).join('')}
            </div>
        `;
    }

    function renderExpandedDetails(stats, type) {
        const container = document.querySelector(`.stat-card[data-stat="${type}"] .stat-card-expanded`);
        const data = (type === 'journaled')
            ? { thisMonth: stats.thisMonth.days, thisYear: stats.thisYear.days }
            : { thisMonth: stats.thisMonth.words, thisYear: stats.thisYear.words };

        container.innerHTML = `
            <div class="expanded-stat-details">
                <div class="expanded-stat-grid">
                     <div class="detail-stat">
                        <span class="count">${data.thisMonth}</span>
                        <span class="label">This Month</span>
                    </div>
                    <div class="detail-stat">
                        <span class="count">${data.thisYear}</span>
                        <span class="label">This Year</span>
                    </div>
                </div>
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
        monthYearDisplay.textContent = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

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
        // Use event delegation for multiple dynamic buttons
        if (e.target.closest('#show-graph-btn')) {
            showGraphView();
            return; // Exit after handling
        }

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
            return;
        }

        const emotionCard = e.target.closest('.emotion-day-card');
        if (emotionCard) {
            const date = emotionCard.dataset.date;
            showEmojiPicker(date);
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
        mainTitle.textContent = "Ask me what I learned from all those years...";
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

    const insightsStatsContainer = document.querySelector('.insights-main-stats');
    insightsStatsContainer.addEventListener('click', (e) => {
        const card = e.target.closest('.stat-card.expandable');
        if (!card) return;

        const yearTab = e.target.closest('.year-selector-tab');
        if (yearTab) {
            const year = yearTab.dataset.year;
            if (year === 'all-time') {
                insightsChart.allTime = true;
            } else {
                insightsChart.allTime = false;
                insightsChart.selectedYear = parseInt(year);
            }
            const stats = calculateInsights();
            renderInsightsDetailView(stats);
            return;
        }

        const isExpanded = card.classList.contains('expanded');

        insightsStatsContainer.classList.remove('journaled-expanded', 'written-expanded');
        insightsStatsContainer.querySelectorAll('.stat-card.expandable').forEach(c => c.classList.remove('expanded'));

        if (!isExpanded) {
            card.classList.add('expanded');
            const statType = card.dataset.stat;
            if (statType === 'journaled' || statType === 'written') {
                insightsStatsContainer.classList.add(`${statType}-expanded`);
            }
        }
    });

    // --- Password Logic ---
    const passwordInput = document.getElementById('password-input');
    const passwordSubmitBtn = document.getElementById('password-submit-btn');
    const CORRECT_PASSWORD = '6417';

    function checkPassword() {
        if (passwordInput.value.trim() === CORRECT_PASSWORD) {
            passwordView.style.display = 'none';

            let isFirstLoad = true;
            journalsRef.on('value', (snapshot) => {
                const journalsData = snapshot.val();
                appData.journals = journalsData ? Object.keys(journalsData).map(key => ({ id: key, ...journalsData[key] })) : [];

                const stats = calculateInsights();
                renderInsightsWidget(stats);

                const isInsightsVisible = insightsView.style.display === 'block';
                const isTimelineVisible = timelineView.style.display === 'block';

                if (isInsightsVisible) {
                    renderInsightsDetailView(stats);
                    renderCalendar(calendarDate);
                } else if (isTimelineVisible) {
                    if (appData.currentJournalId) {
                        const currentJournalExists = appData.journals.some(j => j.id === appData.currentJournalId);
                        if (currentJournalExists) {
                            showTimelineView(appData.currentJournalId);
                        } else {
                            showJournalsListView();
                        }
                    } else {
                        showAllEntriesView();
                    }
                } else if (isFirstLoad || journalsListView.style.display === 'block') {
                    showJournalsListView();
                }
                isFirstLoad = false;
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

    // --- Graph View Event Listeners ---
    document.getElementById('back-to-timeline-from-graph-btn').addEventListener('click', () => {
        graphView.style.display = 'none';
        timelineView.style.display = 'block';
    });

    document.querySelector('.graph-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            // Update active button state
            document.querySelectorAll('.graph-filters .filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            // Re-render the chart with the new range
            const range = e.target.dataset.range;
            const journal = appData.journals.find(j => j.id === appData.currentJournalId);
            const data = parseWeightData(journal);
            renderWeightChart(data, range);
        }
    });
});