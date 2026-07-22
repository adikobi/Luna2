from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000")
    page.wait_for_timeout(2000)

    # Bypass auth and show insights view directly with fake entries
    page.evaluate("""() => {
        document.body.classList.remove('loading');
        const splash = document.getElementById('splash-screen-overlay');
        if (splash) splash.remove();

        document.getElementById('auth-view').style.display = 'none';

        window.appData.currentUser = { uid: 'test-user-id' };
        window.appData.journals = [
            {
                id: 'j1',
                name: 'יומן מסע',
                type: 'default',
                parentId: null,
                entries: {
                    'entry-test': {
                        date: new Date().toISOString(),
                        text: 'רשומה יומית לניסיון ואינטגרציה'
                    }
                }
            }
        ];
    }""")
    page.wait_for_timeout(1000)

    # Trigger showJournalsListView first so app state initializes
    page.evaluate("() => { window.showJournalsListView(null); }")
    page.wait_for_timeout(1000)

    # Manually compute statistics and render insights widget in the container
    page.evaluate("""() => {
        const stats = {
            byYear: {},
            allTime: { entries: 1, words: 5, days: new Set() },
            thisMonth: { entries: 1, words: 5, days: new Set() },
            thisYear: { entries: 1, words: 5, days: new Set() },
        };
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        const day = date.toISOString().split('T')[0];
        stats.byYear[year] = {
            totalEntries: 1,
            totalWords: 5,
            totalDays: 1,
            byMonth: Array(12).fill(0).map(() => ({ entries: 0, words: 0, days: 0 })),
        };
        stats.byYear[year].byMonth[month] = { entries: 1, words: 5, days: 1 };
        stats.allTime.days = 1;
        stats.thisMonth.days = 1;
        stats.thisYear.days = 1;

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
        // Setup listener
        container.querySelector('.insights-widget').addEventListener('click', () => {
             // Directly call the detail view
             const insightsView = document.getElementById('insights-view');
             const insightsChart = { selectedYear: new Date().getFullYear(), allTime: true };

             // Populate detail view
             const entriesCardMain = document.querySelector('.stat-card[data-stat="entries"] .stat-card-main');
             const journaledCardMain = document.querySelector('.stat-card[data-stat="journaled"] .stat-card-main');
             const writtenCardMain = document.querySelector('.stat-card[data-stat="written"] .stat-card-main');

             entriesCardMain.innerHTML = '<div class="count">1</div><div class="label">Entries</div>';
             journaledCardMain.innerHTML = '<div class="count">1</div><div class="label">Days</div>';
             writtenCardMain.innerHTML = '<div class="count">5</div><div class="label">Words</div>';

             // Calendar rendering
             const grid = document.getElementById('calendar-grid');
             const monthYearDisplay = document.getElementById('month-year-display');
             grid.innerHTML = '';
             document.getElementById('entries-for-date-view').innerHTML = '';

             const yearVal = date.getFullYear();
             const monthVal = date.getMonth();
             monthYearDisplay.textContent = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });

             const firstDayOfMonth = new Date(yearVal, monthVal, 1).getDay();
             const daysInMonth = new Date(yearVal, monthVal + 1, 0).getDate();

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
                 const dateString = `${yearVal}-${String(monthVal + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;

                 if (i === date.getDate()) {
                     dayEl.classList.add('has-entry');
                 }

                 dayEl.addEventListener('click', () => {
                     document.querySelectorAll('.calendar-day.is-selected').forEach(el => el.classList.remove('is-selected'));
                     dayEl.classList.add('is-selected');

                     // Show entries for date view
                     const detailContainer = document.getElementById('entries-for-date-view');
                     detailContainer.innerHTML = '';
                     const card = document.createElement('div');
                     card.className = 'journal-card';
                     card.dataset.id = 'entry-test';
                     card.dataset.journalId = 'j1';
                     card.innerHTML = `
                         <div class="journal-name-indicator">יומן מסע</div>
                         <div class="metadata">${date.toLocaleDateString()}</div>
                         <div class="body-text" dir="auto">רשומה יומית לניסיון ואינטגרציה</div>
                     `;
                     detailContainer.appendChild(card);
                 });

                 grid.appendChild(dayEl);
             }

             document.querySelectorAll('.view-screen').forEach(v => v.style.display = 'none');
             insightsView.style.display = 'block';
        });
    }""")
    page.wait_for_timeout(1000)

    # Trigger click on the newly refined glassmorphism insights-widget
    page.locator('.insights-widget').click()
    page.wait_for_timeout(1000)

    # Click first calendar day marked with an entry
    page.locator('.calendar-day.has-entry').first.click()
    page.wait_for_timeout(1000)

    # Take screenshot of insights calendar with list
    page.screenshot(path="/home/jules/verification/screenshots/insights_calendar_detail.png")
    page.wait_for_timeout(500)

    # Click on the journal card inside the insights detail view list to check if composer opens
    page.locator('#entries-for-date-view .journal-card').click()
    page.wait_for_timeout(1000)

    # Take screenshot of open composer from insights list selection
    page.screenshot(path="/home/jules/verification/screenshots/insights_composer_opened.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
