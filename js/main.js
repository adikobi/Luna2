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
    const auth = firebase.auth();
    const database = firebase.database();

    // Ensure composer is a direct child of body to avoid stacking context issues
    document.body.appendChild(document.getElementById('composer-view'));

    // --- View Elements ---
    const authView = document.getElementById('auth-view');
    const pinSetupView = document.getElementById('pin-setup-view');
    const pinView = document.getElementById('pin-view');
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
        currentUser: null,
        currentFolderId: null, // To track the currently viewed folder
    };
    let currentlyEditingEntryId = null;
    let initialEntryState = null; // Used to check for unsaved changes
    let currentImageURL = null; // To hold the URL of an uploaded image before saving
    let calendarDate = new Date(); // State for the calendar's currently displayed month
    let insightsChart = {
        selectedYear: new Date().getFullYear(),
        allTime: true,
    };
    let journalsRef = null;

    const EMOTION_SETS = {
        'emotion_default': ['😀', '😍', '😊', '😭', '😠', '😴', '😎', '🤔', '🤯', '🥺', '😂', '🥳', '😳', '😞', '😒', '😔', '🥹', '😕', '😋', '😖', '😢', '🙂', '😤', '😓', '😐', '🙄', '🥱', '🤢', '🤒', '🤧', '🤕', '⚪'],
        'emotion_pool': ['🏊', '❌', '😊', '😫', '⚪']
    };

    // --- Helper Functions ---
    function showToast(message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.textContent = message;
        container.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.classList.add('show');
        }, 10); // Small delay to ensure the element is in the DOM before animating

        // Animate out and remove
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, 3000); // 3 seconds visible
    }

    function formatISODateForDisplay(isoString) {
        const date = new Date(isoString);
        return date.toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
        });
    }

    function migrateJournalParentIds() {
        if (!journalsRef) return;
        appData.journals.forEach(journal => {
            // Check if parentId is missing (undefined)
            if (typeof journal.parentId === 'undefined') {
                journalsRef.child(journal.id).update({ parentId: null });
            }
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

    function isHebrew(text) {
        const hebrewRegex = /[\u0590-\u05FF]/;
        return hebrewRegex.test(text);
    }

    function countWords(str) {
        const cleanString = str.replace(/<\/?[^>]+(>|$)/g, " ").trim();
        if (cleanString === '') return 0;
        return cleanString.split(/\s+/).length;
    }

    function hideAllViews() {
        document.querySelectorAll('.view-screen').forEach(view => {
            view.style.display = 'none';
        });
    }

    async function hashPin(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function showLoadingIndicator() {
        document.body.classList.add('loading');
    }

    function hideLoadingIndicator() {
        document.body.classList.remove('loading');
    }

    function imageToBase64(file, maxWidth = 1024, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > maxWidth) {
                            height *= maxWidth / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxWidth) {
                            width *= maxWidth / height;
                            height = maxWidth;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    // Get the data URL with specified quality
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
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
            const textAlign = isHebrew(entry.text) ? 'right' : 'left';

            const bodyHtml = entry.text;
            // Backward compatibility: If an old imageUrl exists, prepend it to the body.
            // The new method embeds the image in the bodyHtml itself.
            const imageHtml = entry.imageUrl ? `<img src="${entry.imageUrl}" class="entry-image">` : '';

            card.innerHTML = `
                ${showJournalName ? `<div class="journal-name-indicator">${entry.journalName}</div>` : ''}
                <div class="metadata">${formatISODateForDisplay(entry.date)}</div>
                ${imageHtml}
                <div class="body-text" dir="${textDir}" style="text-align: ${textAlign};">${bodyHtml}</div>
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
            item.dataset.id = journal.id;

            if (journal.type === 'folder') {
                item.classList.add('folder');
            }

            const iconHTML = journal.icon ? `<i data-lucide="${journal.icon}" class="journal-icon"></i>` : '';
            const nameHTML = `<span class="journal-name">${journal.name}</span>`;

            item.innerHTML = iconHTML + nameHTML;

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-journal-btn';
            deleteBtn.innerHTML = '&times;';
            deleteBtn.dataset.id = journal.id;

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-journal-btn';
            editBtn.innerHTML = '<i data-lucide="pencil"></i>';
            editBtn.dataset.id = journal.id;

            wrapper.appendChild(item);
            wrapper.appendChild(deleteBtn);
            wrapper.appendChild(editBtn);
            container.appendChild(wrapper);
        });

        // After adding all items, call Lucide to render the icons
        lucide.createIcons();
    }

    function renderEmotionJournalView(journal) {
        journalFeed.innerHTML = ''; // Clear the feed

        const textEntryDates = journal.entries ? Object.values(journal.entries).map(e => new Date(e.date)) : [];
        const emojiEntryDates = journal.emojis ? Object.keys(journal.emojis).map(d => new Date(d)) : [];

        const allEntryDates = [...textEntryDates, ...emojiEntryDates];
        allEntryDates.sort((a, b) => a - b);

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
        allDates.reverse();

        const savedEmojis = journal.emojis || {};

        const datesByMonth = allDates.reduce((acc, date) => {
            const monthYear = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
            if (!acc[monthYear]) {
                acc[monthYear] = [];
            }
            acc[monthYear].push(date);
            return acc;
        }, {});

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

        const timelineHeader = document.querySelector('#timeline-view .timeline-top-bar');
        const existingGraphBtn = document.getElementById('show-graph-btn');
        if (existingGraphBtn) existingGraphBtn.remove();
        const existingSpacer = timelineHeader.querySelector('.spacer');
        if (existingSpacer) existingSpacer.remove();

        if (journal.type === 'graph') {
            const graphBtn = document.createElement('button');
            graphBtn.id = 'show-graph-btn';
            graphBtn.innerHTML = '<i class="fas fa-chart-line"></i>';

            const spacer = document.createElement('div');
            spacer.className = 'spacer';
            spacer.style.flexGrow = '1';

            const searchBtn = document.getElementById('search-toggle-btn');
            const backBtn = document.getElementById('back-to-journals-btn');

            backBtn.after(spacer);
            searchBtn.before(graphBtn);
        }

        if (journal.type === 'emotion') {
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
        hideAllViews();
        timelineView.style.display = 'block';
        timelineView.scrollTop = 0;
    }

    function showJournalsListView(folderId = null) {
        appData.currentJournalId = null;
        appData.currentFolderId = folderId;
        hideAllViews();
        fab.style.display = 'none'; // Ensure the timeline FAB is hidden

        const emptyStateContainer = document.getElementById('empty-state-container');
        const addJournalFab = document.getElementById('add-journal-fab');
        const backToParentFolderBtn = document.getElementById('back-to-parent-folder-btn');

        // Critical fix: Firebase doesn't store null, so root items have an undefined parentId.
        // This filter handles both null (for new items) and undefined (from Firebase).
        const journalsInCurrentFolder = appData.journals.filter(j => {
            if (folderId === null) {
                return !j.parentId;
            }
            return j.parentId === folderId;
        });

        // Corrected empty state logic
        if (appData.journals.length === 0) {
            // This is the true empty state: no journals exist anywhere.
            emptyStateContainer.style.display = 'block';
            journalsListView.style.display = 'none';
            addJournalFab.style.display = 'none';
            backToParentFolderBtn.style.display = 'none';
        } else {
            // Journals exist, so show the list view, even if this folder is empty.
            emptyStateContainer.style.display = 'none';
            journalsListView.style.display = 'block';
            addJournalFab.style.display = 'block';
            renderJournalsList(journalsInCurrentFolder);
        }

        if (folderId) {
            const parentFolder = appData.journals.find(j => j.id === folderId);
            backToParentFolderBtn.style.display = 'block';
            // Store the parent's ID to navigate back to it.
            backToParentFolderBtn.dataset.parentId = parentFolder ? parentFolder.parentId : '';
        } else {
            backToParentFolderBtn.style.display = 'none';
        }
    }

    function showInsightsView() {
        insightsChart.selectedYear = new Date().getFullYear();
        insightsChart.allTime = true;
        const stats = calculateInsights();
        renderInsightsDetailView(stats);
        renderCalendar(calendarDate);
        hideAllViews();
        insightsView.style.display = 'block';
    }

    // --- Graph View Logic ---
    let weightChart = null;

    function parseWeightData(journal) {
        if (!journal || !journal.entries) return [];

        const entriesArray = Object.values(journal.entries);

        let data = entriesArray.map(entry => {
            const cleanText = entry.text.replace(/<[^>]*>?/gm, '').trim();
            const isNumeric = /^\d+(\.\d+)?$/.test(cleanText);

            if (isNumeric) {
                return {
                    x: new Date(entry.date),
                    y: parseFloat(cleanText)
                };
            }

            const match = cleanText.match(/(\d+(\.\d+)?)/);
            if (match) {
                return {
                    x: new Date(entry.date),
                    y: parseFloat(match[1])
                };
            }
            return null;
        }).filter(item => item !== null);

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
            case 'all': startDate = new Date(0); break;
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
                        borderColor: 'rgba(211, 237, 231, 1)',
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
                            time: { unit: 'day', displayFormats: { day: 'MMM d' }},
                            ticks: { color: 'rgba(235, 235, 245, 0.6)' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        y: {
                            beginAtZero: false,
                            ticks: { color: 'rgba(235, 235, 245, 0.6)', stepSize: 0.2 },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: { legend: { display: false } }
                }
            });
        }
    }

    function showGraphView() {
        window.scrollTo(0, 0);
        const journal = appData.journals.find(j => j.id === appData.currentJournalId);
        if (!journal || journal.type !== 'graph') return;

        hideAllViews();
        graphView.style.display = 'block';

        const data = parseWeightData(journal);
        renderWeightChart(data, '1m');
    }

    // --- Composer Logic ---
    function populateComposerView(entry = null, mode = 'edit') {
        const isEditing = mode === 'edit';
        const isNewEntry = entry === null;
        const journal = appData.journals.find(j => j.id === appData.currentJournalId);
        const isWeightJournal = journal && journal.type === 'graph';

        let weightAdjusterHTML = '';
        if (isNewEntry && isWeightJournal) {
            weightAdjusterHTML = `
            <div class="weight-adjuster">
                <button id="weight-minus-btn" class="weight-btn">-</button>
                <span id="weight-display">--.-</span>
                <button id="weight-plus-btn" class="weight-btn">+</button>
            </div>
            `;
        }

        composerView.innerHTML = `
            <div class="composer-header">
                <button id="close-cancel-btn">${isEditing && !isNewEntry ? 'ביטול' : 'סגור'}</button>
                <div>
                    ${!isEditing && !isNewEntry ? '<button id="copy-all-btn">העתק הכל</button>' : ''}
                    ${!isEditing && !isNewEntry ? '<button id="edit-btn">ערוך</button>' : ''}
                    ${isEditing ? `<button id="save-btn">${isNewEntry ? 'סיום' : 'שמור'}</button>` : ''}
                </div>
            </div>
            <div class="composer-content">
                <div class="composer-metadata">
                    <input type="text" id="entry-title" placeholder="${isEditing ? 'כותרת' : ''}" dir="rtl" ${!isEditing ? 'disabled' : ''}>
                    <div id="date-container"></div>
                </div>
                ${weightAdjusterHTML}
                <div id="entry-textarea" ${isEditing ? 'contenteditable="true"' : ''} placeholder="התחל לכתוב..." dir="auto"></div>
            </div>
            <div class="composer-toolbar" style="display: ${isEditing ? 'flex' : 'none'};">
                <button id="add-checklist-btn" class="toolbar-btn" title="הוסף צ'קליסט">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-check-square"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                </button>
                <button id="add-image-btn" class="toolbar-btn" title="הוסף תמונה">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-image"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                </button>
                <button id="delete-entry-btn" class="toolbar-btn destructive" title="מחק רשומה">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        `;

        const titleInput = document.getElementById('entry-title');
        const textInput = document.getElementById('entry-textarea');
        const dateContainer = document.getElementById('date-container');

        if (isEditing) {
            dateContainer.innerHTML = `<input type="datetime-local" id="entry-date">`;
        }

        const dateInput = document.getElementById('entry-date');

        if (entry) {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = entry.text;

            const strongTag = tempDiv.querySelector('strong');
            if (strongTag && tempDiv.firstChild.nodeName === 'STRONG') {
                titleInput.value = strongTag.textContent;
                strongTag.remove();
                if (tempDiv.firstChild.nodeName === 'BR') {
                    tempDiv.firstChild.remove();
                }
            } else {
                titleInput.value = '';
            }

            textInput.innerHTML = tempDiv.innerHTML;

            if (isEditing) {
                dateInput.value = formatISOForInput(entry.date);
            } else {
                dateContainer.innerHTML = `<p class="date-display">${formatDateForComposerView(entry.date)}</p>`;
                textInput.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.disabled = true);
            }
        } else { // New entry
            dateInput.value = formatISOForInput(new Date().toISOString());
            if (journal && journal.type === 'template' && journal.template) {
                const templateLines = journal.template.split('\n').filter(line => line.trim() !== '');
                const now = Date.now();
                const checklistHtml = templateLines.map((line, index) => {
                    const itemId = `checklist-item-${now}-${index}`;
                    return `<div class="checklist-item"><input type="checkbox" id="${itemId}"><label for="${itemId}">${line.trim()}</label></div>`;
                }).join('');
                textInput.innerHTML = checklistHtml + '<div>&nbsp;</div>';
            }
        }

        if (isNewEntry && isWeightJournal) {
            const weightDisplay = document.getElementById('weight-display');
            const data = parseWeightData(journal);
            let lastWeight = data.length > 0 ? data[data.length - 1].y : 70.0; // Default if no entries

            const updateWeight = (newWeight) => {
                lastWeight = newWeight;
                const formattedWeight = newWeight.toFixed(1);
                weightDisplay.textContent = formattedWeight;
                textInput.innerHTML = formattedWeight; // Update the main text area
            };

            updateWeight(lastWeight);

            document.getElementById('weight-plus-btn').addEventListener('click', () => updateWeight(lastWeight + 0.1));
            document.getElementById('weight-minus-btn').addEventListener('click', () => updateWeight(lastWeight - 0.1));
        }


        if (isEditing) {
            initialEntryState = {
                title: titleInput.value,
                html: textInput.innerHTML,
                date: dateInput.value,
            };
        } else {
            initialEntryState = null;
        }

        // Scroll the composer's content area to the top, not the whole window
        const composerContent = composerView.querySelector('.composer-content');
        if (composerContent) {
            composerContent.scrollTop = 0;
        }

        // Backward compatibility for old entries with imageUrl
        if (entry && entry.imageUrl) {
            currentImageURL = entry.imageUrl;
            const container = document.createElement('div');
            container.className = 'image-preview-container';
            container.setAttribute('contenteditable', 'false');
            container.style.position = 'relative';
            container.style.display = 'inline-block';

            const img = document.createElement('img');
            img.src = entry.imageUrl;
            img.style.maxWidth = '100%';
            img.style.display = 'block';
            img.style.borderRadius = '8px';
            img.style.marginTop = '10px';
            container.appendChild(img);

            if (isEditing) {
                const deleteBtn = document.createElement('button');
                deleteBtn.innerHTML = '<i data-lucide="x"></i>';
                deleteBtn.className = 'delete-image-btn';
                deleteBtn.setAttribute('title', 'Remove Image');
                // Style is applied via CSS for consistency
                container.appendChild(deleteBtn);
            }

            textInput.insertBefore(container, textInput.firstChild);
            lucide.createIcons(); // Render the icon for legacy images
        } else {
            currentImageURL = null;
        }

        document.getElementById('close-cancel-btn').addEventListener('click', () => {
            if (isEditing && initialEntryState) {
                const currentState = {
                    title: document.getElementById('entry-title').value,
                    html: textInput.innerHTML,
                    date: document.getElementById('entry-date').value,
                };
                const hasChanged =
                    currentState.title !== initialEntryState.title ||
                    currentState.html !== initialEntryState.html ||
                    currentState.date !== initialEntryState.date;
                if (hasChanged && !confirm('עדיין לא שמרת. האם אתה בטוח שאתה רוצה לסגור?')) {
                    return;
                }
            }
            composerView.classList.remove('visible');
            currentImageURL = null;
        });

        const editBtn = document.getElementById('edit-btn');
        if (editBtn) {
            editBtn.addEventListener('click', () => populateComposerView(entry, 'edit'));
        }

        const copyAllBtn = document.getElementById('copy-all-btn');
        if (copyAllBtn) {
            copyAllBtn.addEventListener('click', () => {
                const title = titleInput.value;
                const bodyHtml = textInput.innerHTML;
                const fullText = (title ? title + '\n\n' : '') + bodyHtml.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
                navigator.clipboard.writeText(fullText.trim()).then(() => {
                    showToast('הטקסט הועתק בהצלחה');
                });
            });
        }

        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                // Manually sync checkbox state to the DOM before saving
                const checkboxes = textInput.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => {
                    if (cb.checked) {
                        cb.setAttribute('checked', 'checked');
                    } else {
                        cb.removeAttribute('checked');
                    }
                });

                const title = titleInput.value;
                const bodyHtml = textInput.innerHTML;
                const dateValue = dateInput.value;

                if (bodyHtml.trim() === '' && title.trim() === '') return;

                const newEntryText = (title ? `<strong>${title}</strong><br>` : '') + bodyHtml;
                const newEntryDate = new Date(dateValue).toISOString();

                // The `imageUrl` property is now legacy. By setting it to null on every save,
                // we ensure that old entries are migrated to the new embedded-image format
                // upon their first edit, preventing image duplication.
                const entryData = { date: newEntryDate, text: newEntryText, imageUrl: null };

                const journalEntriesRef = journalsRef.child(appData.currentJournalId).child('entries');

                if (isNewEntry) {
                    journalEntriesRef.push(entryData).then(() => {
                        showToast('הרשומה נשמרה בהצלחה');
                    });
                } else {
                    journalEntriesRef.child(currentlyEditingEntryId).update(entryData).then(() => {
                        showToast('הרשומה עודכנה בהצלחה');
                    });
                }

                composerView.classList.remove('visible');
            });
        }

        if (isEditing) {
            const addChecklistBtn = document.getElementById('add-checklist-btn');
            const addImageBtn = document.getElementById('add-image-btn');
            const deleteBtn = document.getElementById('delete-entry-btn');

            addImageBtn.addEventListener('click', () => {
                document.getElementById('image-upload-input').click();
            });

            // Centralized click handler for the text editor
            textInput.addEventListener('click', (e) => {
                // Handle delete image button clicks
                const deleteBtn = e.target.closest('.delete-image-btn');
                if (deleteBtn) {
                    if (confirm("האם אתה בטוח שאתה רוצה למחוק את התמונה?")) {
                        const imageContainer = deleteBtn.closest('.image-preview-container');
                        if (imageContainer) {
                            // The image container is wrapped in a contenteditable="false" div
                            imageContainer.parentElement.remove();
                        }
                        // Since this handles legacy images too, check if we need to clear the old URL
                        if (currentImageURL) {
                            currentImageURL = null;
                        }
                    }
                    return; // Stop processing after handling the delete
                }

                // Handle checklist item clicks
                const label = e.target.closest('.checklist-item label');
                if (label) {
                    e.stopPropagation(); // Stop the composer from closing.
                    e.preventDefault();  // Stop the browser's default label action.

                    const inputId = label.getAttribute('for');
                    if (inputId) {
                        const checkbox = textInput.querySelector(`#${inputId}`);
                        if (checkbox) {
                            checkbox.checked = !checkbox.checked; // Manually toggle the state.
                        }
                    }
                }
            });

            textInput.addEventListener('paste', (e) => {
                e.preventDefault();
                const text = e.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, text);
            });

            textInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const selection = window.getSelection();
                    const range = selection.getRangeAt(0);
                    const currentNode = range.startContainer;
                    const parentDiv = currentNode.nodeType === 3 ? currentNode.parentNode : currentNode;

                    if (parentDiv.classList.contains('checklist-item') || parentDiv.closest('.checklist-item')) {
                        e.preventDefault();
                        const newChecklistItem = document.createElement('div');
                        const inputId = `checklist-item-${Date.now()}`;
                        newChecklistItem.className = 'checklist-item';
                        newChecklistItem.innerHTML = `<input type="checkbox" id="${inputId}"><label for="${inputId}">&nbsp;</label>`;

                        const container = parentDiv.closest('.checklist-item') || parentDiv;
                        container.after(newChecklistItem);

                        const label = newChecklistItem.querySelector('label');
                        label.setAttribute('contenteditable', 'true');
                        label.focus();
                        const newRange = document.createRange();
                        newRange.selectNodeContents(label);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                    }
                }
            });

            addChecklistBtn.addEventListener('click', () => {
                const textInput = document.getElementById('entry-textarea');
                textInput.focus();
                const inputId = `checklist-item-${Date.now()}`;
                const htmlToInsert = `<div class="checklist-item"><input type="checkbox" id="${inputId}"><label for="${inputId}" contenteditable="true">&nbsp;</label></div>`;
                document.execCommand('insertHTML', false, htmlToInsert);
            });

            deleteBtn.addEventListener('click', () => {
                if (isNewEntry) {
                    composerView.classList.remove('visible');
                    return;
                }
                if (confirm('האם את בטוחה שאת רוצה למחוק את הרשומה?')) {
                    if (currentlyEditingEntryId) {
                        journalsRef.child(appData.currentJournalId).child('entries').child(currentlyEditingEntryId).remove();
                        composerView.classList.remove('visible');
                    }
                }
            });
        }
    }

    function showEmojiPicker(date) {
        const modal = document.getElementById('emoji-picker-modal');
        const optionsContainer = document.getElementById('emoji-options-container');
        optionsContainer.innerHTML = '';

        const journal = appData.journals.find(j => j.id === appData.currentJournalId);
        if (!journal) return;

        const emojiSet = EMOTION_SETS[journal.subtype] || [];

        emojiSet.forEach(emoji => {
            const button = document.createElement('button');
            button.className = 'emoji-option-btn';
            button.textContent = emoji;
            button.addEventListener('click', () => {
                const journalId = appData.currentJournalId;
                if (journalId) {
                    const emojiRef = journalsRef.child(journalId).child('emojis').child(date);
                    if (emoji === '⚪') {
                        emojiRef.remove();
                    } else {
                        emojiRef.set(emoji);
                    }
                }
                modal.style.display = 'none';
            });
            optionsContainer.appendChild(button);
        });

        modal.style.display = 'flex';
    }

    document.getElementById('cancel-emoji-picker-btn').addEventListener('click', () => {
        document.getElementById('emoji-picker-modal').style.display = 'none';
    });

    async function handleImageUpload(file) {
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.');
            return;
        }

        const softMaxSizeInMB = 2;
        const hardMaxSizeInMB = 10;

        if (file.size > hardMaxSizeInMB * 1024 * 1024) {
            showToast(`File is too large. Max size is ${hardMaxSizeInMB}MB.`);
            return;
        }

        if (file.size > softMaxSizeInMB * 1024 * 1024) {
            showToast('Image is large, compressing...');
        } else {
            showToast('Processing image...');
        }

        try {
            const base64String = await imageToBase64(file);

            const composerContent = document.querySelector('#composer-view .composer-content');
            if (!composerContent) return;

            const textarea = composerContent.querySelector('#entry-textarea');
            if (textarea) {
                textarea.focus();
                // Follow the established pattern of using execCommand to insert complex HTML
                // Make the container non-editable, and the image itself non-editable
                const htmlToInsert = `
                    <div contenteditable="false">
                        <div class="image-preview-container">
                            <img src="${base64String}" contenteditable="false">
                            <button class="delete-image-btn" title="Remove Image"><i data-lucide="x"></i></button>
                        </div>
                        <div><br></div>
                    </div>`;
                document.execCommand('insertHTML', false, htmlToInsert);
                lucide.createIcons(); // Render the new icon
            }

            showToast('Image added successfully');
        } catch (error) {
            console.error('Image to Base64 conversion failed:', error);
            showToast('Failed to process image.');
        }
    }

    document.getElementById('image-upload-input').addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0]);
        }
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
            dayEl.className = 'calendar-day is-clickable';
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
            // Find emoji for the date for any emotion-based journal
            if (journal.type === 'emotion' && journal.emojis && journal.emojis[dateString]) {
                entriesForDate.push({
                    id: `emoji-${dateString}-${journal.id}`,
                    journalId: journal.id,
                    journalName: journal.name,
                    date: new Date(dateString + "T12:00:00Z").toISOString(), // Consistent with timeline view
                    text: journal.emojis[dateString]
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
        // Handle checklist item clicks directly in the timeline view for quick toggling.
        const checklistLabel = e.target.closest('.journal-card .checklist-item label');
        if (checklistLabel) {
            e.stopPropagation(); // Prevent the composer from opening.
            e.preventDefault(); // Prevent default label behavior, we handle it manually.

            const card = e.target.closest('.journal-card');
            const entryId = card.dataset.id;
            const journalId = card.dataset.journalId;
            const journal = appData.journals.find(j => j.id === journalId);
            if (!journal || !journal.entries || !journal.entries[entryId] || !journalsRef) return;

            // Find the checkbox and toggle its state.
            const inputId = checklistLabel.getAttribute('for');
            const checkbox = card.querySelector(`#${inputId}`);
            if (checkbox) {
                checkbox.checked = !checkbox.checked; // Manually toggle the state
                // Sync the attribute for saving
                if (checkbox.checked) {
                    checkbox.setAttribute('checked', 'checked');
                } else {
                    checkbox.removeAttribute('checked');
                }

                // Now, save the entire updated body text.
                const bodyTextElement = card.querySelector('.body-text');
                const updatedHtml = bodyTextElement.innerHTML;
                const entryRef = journalsRef.child(journalId).child('entries').child(entryId);
                entryRef.update({ text: updatedHtml });
            }
            return; // Stop further processing
        }

        if (e.target.closest('#show-graph-btn')) {
            showGraphView();
            return;
        }

        const card = e.target.closest('.journal-card');
        if (card && card.parentElement.id !== 'entries-for-date-view') {
            // Do not open composer if a link was clicked
            if (e.target.tagName === 'A') return;

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
            return;
        }
    });

    document.getElementById('back-to-journals-btn').addEventListener('click', () => showJournalsListView(appData.currentFolderId));
    document.getElementById('back-to-parent-folder-btn').addEventListener('click', (e) => {
        const parentId = e.currentTarget.dataset.parentId === 'undefined' ? null : e.currentTarget.dataset.parentId;
        showJournalsListView(parentId);
    });
    document.getElementById('back-to-journals-from-insights-btn').addEventListener('click', () => showJournalsListView(null));
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
    const backupBtn = document.getElementById('backup-btn');
    const showAllEntriesBtn = document.getElementById('show-all-entries-btn');
    const editJournalsBtn = document.getElementById('journals-list-edit-btn');
    const doneJournalsBtn = document.getElementById('journals-list-done-btn');

    function showAllEntriesView() {
        // Clear out any journal-specific buttons from the header
        const timelineHeader = document.querySelector('#timeline-view .timeline-top-bar');
        const existingGraphBtn = document.getElementById('show-graph-btn');
        if (existingGraphBtn) existingGraphBtn.remove();
        const existingSpacer = timelineHeader.querySelector('.spacer');
        if (existingSpacer) existingSpacer.remove();

        let allEntries = [];
        appData.journals.forEach(journal => {
            if (journal.entries) {
                const entriesArray = Object.keys(journal.entries).map(key => ({
                    id: key, journalId: journal.id, journalName: journal.name, ...journal.entries[key]
                }));
                allEntries = allEntries.concat(entriesArray);
            }
            if (journal.type === 'emotion' && journal.emojis) {
                const emojiEntries = Object.keys(journal.emojis).map(dateString => ({
                    id: `emoji-${dateString}-${journal.id}`,
                    journalId: journal.id,
                    journalName: journal.name,
                    date: new Date(dateString + "T12:00:00Z").toISOString(), // Set to midday to avoid timezone issues
                    text: journal.emojis[dateString]
                }));
                allEntries = allEntries.concat(emojiEntries);
            }
        });
        allEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
        mainTitle.textContent = "Ask me what I learned from all those years...";
        renderJournalFeed(allEntries, true);
        hideAllViews();
        timelineView.style.display = 'block';
        appData.currentJournalId = null;
        fab.style.display = 'none'; // Hide FAB in this aggregate view
    }

    showAllEntriesBtn.addEventListener('click', showAllEntriesView);

    backupBtn.addEventListener('click', () => {
        if (!appData.currentUser) {
            alert("Please log in to create a backup.");
            return;
        }
        if (confirm('האם אתה בטוח שברצונך ליצור גיבוי? פעולה זו תחליף את הגיבוי הקיים.')) {
            const journalsDataRef = database.ref(`users/${appData.currentUser.uid}/journals`);
            journalsDataRef.once('value', (snapshot) => {
                const dataToBackup = snapshot.val();
                if (dataToBackup) {
                    const backupRef = database.ref(`users/${appData.currentUser.uid}/journals_backup`);
                    backupRef.set(dataToBackup)
                        .then(() => {
                            showToast('הגיבוי נוצר בהצלחה!');
                        })
                        .catch((error) => {
                            console.error("Backup failed: ", error);
                            showToast('יצירת הגיבוי נכשלה.');
                        });
                } else {
                    showToast('אין מידע לגבות.');
                }
            });
        }
    });

    lockAppBtn.addEventListener('click', () => {
        hideAllViews();
        composerView.classList.remove('visible');
        pinView.style.display = 'flex';
        document.getElementById('pin-input').value = '';
        document.getElementById('pin-input').focus();
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
        if (!journalsRef) return;
        if (journalsListView.classList.contains('edit-mode')) {
            const deleteBtn = e.target.closest('.delete-journal-btn');
            if (deleteBtn) {
                const journalId = deleteBtn.dataset.id;
                const journal = appData.journals.find(j => j.id === journalId);
                if (journal && confirm(`האם אתה בטוח שברצונך למחוק את "${journal.name}"? פעולה זו תמחק גם את כל התוכן שבפנים.`)) {
                    deleteJournalAndChildren(journalId);
                }
                return; // Prevent fall-through to other click handlers in edit mode
            }

            const editBtn = e.target.closest('.edit-journal-btn');
            if (editBtn) {
                const journalId = editBtn.dataset.id;
                openEditJournalModal(journalId);
                return; // Prevent fall-through
            }

        } else {
            const journalItem = e.target.closest('.journal-list-item');
            if (journalItem) {
                const journalId = journalItem.dataset.id;
                const journal = appData.journals.find(j => j.id === journalId);
                if (journal && journal.type === 'folder') {
                    showJournalsListView(journalId); // Navigate into the folder
                } else {
                    showTimelineView(journalId); // Open the journal timeline
                }
            }
        }
    });

    function deleteJournalAndChildren(journalId) {
        if (!journalsRef) return;

        const journalToDelete = appData.journals.find(j => j.id === journalId);
        if (!journalToDelete) return;

        // Find and delete all children recursively
        if (journalToDelete.type === 'folder') {
            const children = appData.journals.filter(j => j.parentId === journalId);
            children.forEach(child => {
                // This recursive call will handle nested folders
                deleteJournalAndChildren(child.id);
            });
        }

        // After all children are handled, delete the journal itself
        journalsRef.child(journalId).remove();
    }

    const newJournalModal = document.getElementById('new-journal-modal');
    const newJournalNameInput = document.getElementById('new-journal-name-input');
    const createNewJournalBtn = document.getElementById('create-new-journal-btn');
    const cancelNewJournalBtn = document.getElementById('cancel-new-journal-btn');

    function openNewJournalModal() {
        newJournalNameInput.value = '';
        document.getElementById('new-journal-type-select').value = 'default';
        document.getElementById('template-editor-container').style.display = 'none';
        document.getElementById('new-journal-template-input').value = '';
        // Reset icon picker selection
        document.querySelectorAll('#new-journal-icon-picker .icon-picker-btn.selected').forEach(btn => {
            btn.classList.remove('selected');
        });
        newJournalModal.style.display = 'flex';
        newJournalNameInput.focus();
    }

    document.getElementById('add-journal-fab').addEventListener('click', openNewJournalModal);
    document.getElementById('create-first-journal-btn').addEventListener('click', openNewJournalModal);

    // Handle icon selection in the new journal modal
    document.getElementById('new-journal-icon-picker').addEventListener('click', (e) => {
        const clickedBtn = e.target.closest('.icon-picker-btn');
        if (!clickedBtn) return;

        // Allow unselecting by clicking the same icon again
        if (clickedBtn.classList.contains('selected')) {
            clickedBtn.classList.remove('selected');
        } else {
            // Remove 'selected' from any other button
            document.querySelectorAll('#new-journal-icon-picker .icon-picker-btn.selected').forEach(btn => {
                btn.classList.remove('selected');
            });
            // Add 'selected' to the clicked button
            clickedBtn.classList.add('selected');
        }
    });

    document.getElementById('new-journal-type-select').addEventListener('change', (e) => {
        const templateEditor = document.getElementById('template-editor-container');
        if (e.target.value === 'template') {
            templateEditor.style.display = 'block';
        } else {
            templateEditor.style.display = 'none';
        }
    });

    function closeNewJournalModal() {
        newJournalModal.style.display = 'none';
    }

    cancelNewJournalBtn.addEventListener('click', closeNewJournalModal);

    createNewJournalBtn.addEventListener('click', () => {
        if (!journalsRef) return;
        const newName = newJournalNameInput.value.trim();
        const selectedType = document.getElementById('new-journal-type-select').value;
        const selectedIconEl = document.querySelector('#new-journal-icon-picker .icon-picker-btn.selected');
        let icon = selectedIconEl ? selectedIconEl.dataset.icon : null;

        let type = selectedType;
        let subtype = '';
        let template = '';

        if (selectedType.startsWith('emotion_')) {
            type = 'emotion';
            subtype = selectedType;
        } else if (type === 'template') {
            template = document.getElementById('new-journal-template-input').value;
        } else if (type === 'folder' && !icon) {
            icon = 'folder'; // Default icon for folders
        }

        if (newName) {
            const journalData = {
                name: newName,
                type: type,
                parentId: appData.currentFolderId || null,
            };

            if (icon) {
                journalData.icon = icon;
            }

            // Only add properties specific to non-folder types
            if (type !== 'folder') {
                journalData.subtype = subtype;
                journalData.template = template;
                journalData.entries = {};
            }

            journalsRef.push(journalData).then(() => {
                showToast(`"${newName}" נוצר בהצלחה`);
            });
            closeNewJournalModal();
        }
    });

    // --- Edit Journal Modal Logic ---
    const editJournalModal = document.getElementById('edit-journal-modal');
    const editJournalNameInput = document.getElementById('edit-journal-name-input');
    const cancelEditJournalBtn = document.getElementById('cancel-edit-journal-btn');
    const saveEditJournalBtn = document.getElementById('save-edit-journal-btn');
    let currentlyEditingJournalId = null;

    function openEditJournalModal(journalId) {
        currentlyEditingJournalId = journalId;
        const journal = appData.journals.find(j => j.id === journalId);
        if (!journal) return;

        editJournalNameInput.value = journal.name;

        const newJournalPicker = document.getElementById('new-journal-icon-picker');
        const editJournalPicker = document.getElementById('edit-journal-icon-picker');

        // --- DYNAMICALLY POPULATE ICONS ---
        // Clear previous icons
        editJournalPicker.innerHTML = '';

        // Clone icons from the new journal modal
        const icons = newJournalPicker.querySelectorAll('.icon-picker-btn');
        icons.forEach(iconBtn => {
            const clone = iconBtn.cloneNode(true);
            clone.classList.remove('selected'); // Ensure no selection is carried over
            if (clone.dataset.icon === journal.icon) {
                clone.classList.add('selected');
            }
            editJournalPicker.appendChild(clone);
        });

        // Add the "remove icon" button specifically for the edit modal
        const removeIconButton = document.createElement('button');
        removeIconButton.className = 'icon-picker-btn';
        removeIconButton.dataset.icon = '';
        removeIconButton.innerHTML = '<i data-lucide="x-circle"></i>';
        if (!journal.icon) { // Select if the journal has no icon
             removeIconButton.classList.add('selected');
        }
        editJournalPicker.appendChild(removeIconButton);


        editJournalModal.style.display = 'flex';
        lucide.createIcons(); // Render the newly added icons
    }

    function closeEditJournalModal() {
        editJournalModal.style.display = 'none';
        currentlyEditingJournalId = null;
    }

    cancelEditJournalBtn.addEventListener('click', closeEditJournalModal);

    saveEditJournalBtn.addEventListener('click', () => {
        if (!currentlyEditingJournalId || !journalsRef) return;

        const newName = editJournalNameInput.value.trim();
        if (!newName) {
            alert('Journal name cannot be empty.');
            return;
        }

        const selectedIconEl = document.querySelector('#edit-journal-icon-picker .icon-picker-btn.selected');
        const icon = selectedIconEl ? selectedIconEl.dataset.icon : null;

        const updates = {
            name: newName,
            icon: icon
        };

        journalsRef.child(currentlyEditingJournalId).update(updates).then(() => {
            showToast('Journal updated successfully');
            closeEditJournalModal();
        });
    });

    // Handle icon selection in the edit journal modal
    document.getElementById('edit-journal-icon-picker').addEventListener('click', (e) => {
        const clickedBtn = e.target.closest('.icon-picker-btn');
        if (!clickedBtn) return;

        if (clickedBtn.classList.contains('selected')) {
            clickedBtn.classList.remove('selected');
        } else {
            document.querySelectorAll('#edit-journal-icon-picker .icon-picker-btn.selected').forEach(btn => {
                btn.classList.remove('selected');
            });
            clickedBtn.classList.add('selected');
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

    // --- Authentication & PIN Logic ---
    const showLoginBtn = document.getElementById('show-login-btn');
    const showSignupBtn = document.getElementById('show-signup-btn');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const logoutBtn = document.getElementById('logout-btn');
    const pinSetupBtn = document.getElementById('pin-setup-btn');
    const pinSubmitBtn = document.getElementById('pin-submit-btn');

    // --- Enter Key Listeners for Auth Forms ---
    document.querySelectorAll('#login-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') loginBtn.click();
        });
    });

    document.querySelectorAll('#signup-form input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') signupBtn.click();
        });
    });

    document.getElementById('pin-setup-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') pinSetupBtn.click();
    });


    showLoginBtn.addEventListener('click', () => {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        showLoginBtn.classList.add('active');
        showSignupBtn.classList.remove('active');
    });

    showSignupBtn.addEventListener('click', () => {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        showLoginBtn.classList.remove('active');
        showSignupBtn.classList.add('active');
    });

    signupBtn.addEventListener('click', () => {
        try {
            const username = document.getElementById('signup-username').value.trim();
            const email = document.getElementById('signup-email').value.trim();
            const password = document.getElementById('signup-password').value;

            if (!username || !email || !password) {
                alert("Please fill all fields.");
                return;
            }

            auth.createUserWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    const user = userCredential.user;
                    // Also return the promise from the set operation
                    return database.ref(`users/${user.uid}/profile`).set({
                        username: username,
                        email: email
                    });
                })
                .catch((error) => {
                    console.error("Firebase auth error:", error);
                    alert(error.message)
                });
        } catch (error) {
            alert(`An unexpected error occurred: ${error.message}`);
        }
    });

    loginBtn.addEventListener('click', () => {
        try {
            const emailOrUsername = document.getElementById('login-email-username').value.trim();
            const password = document.getElementById('login-password').value;

            if (!emailOrUsername || !password) {
                alert("Please fill all fields.");
                return;
            }

            if (emailOrUsername.includes('@')) {
                auth.signInWithEmailAndPassword(emailOrUsername, password)
                    .catch((error) => alert(error.message));
            } else {
                database.ref('users').orderByChild('profile/username').equalTo(emailOrUsername).once('value', snapshot => {
                    if (snapshot.exists()) {
                        const uid = Object.keys(snapshot.val())[0];
                        const email = snapshot.val()[uid].profile.email;
                        auth.signInWithEmailAndPassword(email, password)
                            .catch((error) => alert(error.message));
                    } else {
                        alert("User not found.");
                    }
                });
            }
        } catch (error) {
            alert(`An unexpected error occurred: ${error.message}`);
        }
    });

    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        try {
            const email = prompt("Please enter your email address to reset your password:");
            if (email) {
                auth.sendPasswordResetEmail(email)
                    .then(() => alert("Password reset email sent!"))
                    .catch((error) => alert(error.message));
            }
        } catch (error) {
            alert(`An unexpected error occurred: ${error.message}`);
        }
    });

    logoutBtn.addEventListener('click', () => {
        auth.signOut();
    });

    pinSetupBtn.addEventListener('click', async () => {
        const pinInput = document.getElementById('pin-setup-input');
        const pin = pinInput.value;
        if (pin.length === 4 && /^\d{4}$/.test(pin)) {
            showLoadingIndicator();
            const pinHash = await hashPin(pin);
            localStorage.setItem(`luna_pin_${appData.currentUser.uid}`, pinHash);
            initializeData(appData.currentUser);
        } else {
            alert("Please enter a 4-digit PIN.");
            pinInput.value = '';
        }
    });

    const verifyPin = async () => {
        const pinInput = document.getElementById('pin-input');
        const pin = pinInput.value;
        if (pin.length === 4) {
            const storedHash = localStorage.getItem(`luna_pin_${appData.currentUser.uid}`);
            const enteredHash = await hashPin(pin);
            if (enteredHash === storedHash) {
                showLoadingIndicator();
                initializeData(appData.currentUser);
            } else {
                pinView.querySelector('.password-container').classList.add('shake');
                pinInput.value = '';
                setTimeout(() => pinView.querySelector('.password-container').classList.remove('shake'), 500);
            }
        }
    };

    pinSubmitBtn.addEventListener('click', verifyPin);
    document.getElementById('pin-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') verifyPin();
    });

    function migrateJournalTypes() {
        if (!journalsRef) return;

        appData.journals.forEach(journal => {
            let updatePayload = {};
            let needsUpdate = false;

            switch (journal.name) {
                case 'משקל':
                    if (journal.type !== 'graph') {
                        updatePayload.type = 'graph';
                        needsUpdate = true;
                    }
                    break;
                case 'רגשות':
                    if (journal.type !== 'emotion' || journal.subtype !== 'emotion_default') {
                        updatePayload.type = 'emotion';
                        updatePayload.subtype = 'emotion_default';
                        needsUpdate = true;
                    }
                    break;
                case 'בריכה':
                    if (journal.type !== 'emotion' || journal.subtype !== 'emotion_pool') {
                        updatePayload.type = 'emotion';
                        updatePayload.subtype = 'emotion_pool';
                        needsUpdate = true;
                    }
                    break;
                case 'ויטמינים':
                    const originalTemplate = "ויטמין D\nויטמין B12";
                    if (journal.type !== 'template' || journal.template !== originalTemplate) {
                        updatePayload.type = 'template';
                        updatePayload.template = originalTemplate;
                        needsUpdate = true;
                    }
                    break;
                default:
                    // For any other journal, if it doesn't have a type, set it to default.
                    if (typeof journal.type === 'undefined' || journal.type === '') {
                        updatePayload.type = 'default';
                        updatePayload.subtype = '';
                        updatePayload.template = '';
                        needsUpdate = true;
                    }
                    break;
            }

            if (needsUpdate) {
                journalsRef.child(journal.id).update(updatePayload);
            }
        });
    }

    // --- Main App Logic ---
    function initializeData(user) {
        appData.currentUser = user;
        journalsRef = database.ref(`users/${user.uid}/journals`);

        hideAllViews();

        let isFirstLoad = true;
        journalsRef.on('value', (snapshot) => {
            const journalsData = snapshot.val();
            appData.journals = journalsData ? Object.keys(journalsData).map(key => ({ id: key, ...journalsData[key] })) : [];

            if (isFirstLoad) {
                hideLoadingIndicator();
                migrateJournalTypes();
                migrateJournalParentIds();
            }

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
            } else {
                showJournalsListView(appData.currentFolderId || null);
            }
            isFirstLoad = false;
        }, (error) => {
            console.error("Firebase read failed: " + error.code);
            alert("Could not read data. Check security rules and network connection.");
        });
    }

    // --- Auth State Change Listener ---
    auth.onAuthStateChanged(user => {
        hideLoadingIndicator(); // Restore this to show the initial auth/pin view
        if (user) {
            appData.currentUser = user;
            const pinHash = localStorage.getItem(`luna_pin_${user.uid}`);
            hideAllViews();
            if (pinHash) {
                pinView.style.display = 'flex';
                document.getElementById('pin-input').focus();
            } else {
                pinSetupView.style.display = 'flex';
                document.getElementById('pin-setup-input').focus();
            }
        } else {
            appData.currentUser = null;
            if (journalsRef) {
                journalsRef.off();
            }
            hideAllViews();
            authView.style.display = 'flex';
        }
    });

    // --- Graph View Event Listeners ---
    document.getElementById('back-to-timeline-from-graph-btn').addEventListener('click', () => {
        hideAllViews();
        timelineView.style.display = 'block';
    });

    document.querySelector('.graph-filters').addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            document.querySelectorAll('.graph-filters .filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            e.target.classList.add('active');

            const range = e.target.dataset.range;
            const journal = appData.journals.find(j => j.id === appData.currentJournalId);
            const data = parseWeightData(journal);
            renderWeightChart(data, range);
        }
    });
    // Expose for testing
    window.showJournalsListView = showJournalsListView;
    window.showTimelineView = showTimelineView;
    window.appData = appData;
    window.openNewJournalModal = openNewJournalModal;
});
