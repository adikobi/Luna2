import os
from playwright.sync_api import sync_playwright

os.makedirs('verification/screenshots', exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 390, 'height': 844})

    print("Loading app...")
    page.goto('http://localhost:8080/index.html')
    page.wait_for_timeout(3000)

    print("Injecting mock data...")
    page.evaluate('''() => {
        const entries = {};
        for (let i = 1; i <= 20; i++) {
            entries['entry_' + i] = {
                date: new Date(Date.now() - i * 86400000).toISOString(),
                text: 'רשומה ' + i + ' ביומן לבדיקת גלילה, עיצוב כרטיסים, אייקונים וצבעים עשירים. #תובנות #חיים #השראה'
            };
        }
        window.appData.journals = [
            { id: 'j1', name: 'יומן אישי', icon: 'book-open', type: 'default', order: 0, entries: entries },
            { id: 'j2', name: 'רעיונות ופרויקטים', icon: 'star', type: 'default', order: 1, entries: {} },
            { id: 'j3', name: 'כושר ובריאות', icon: 'smile', type: 'default', order: 2, entries: {} }
        ];
        window.appData.currentUser = { uid: 'mock_uid', displayName: 'משתמש' };
        document.getElementById('auth-view').style.display = 'none';
        document.getElementById('pin-view').style.display = 'none';
        window.journalsRef = { child: () => ({ remove: () => {} }) };
        window.showJournalsListView(null, false);
        if (window.renderInsightsWidget && window.calculateInsights) {
            window.renderInsightsWidget(window.calculateInsights());
        }
    }''')
    page.wait_for_timeout(600)

    # 1. Journals list screenshot
    page.screenshot(path='verification/screenshots/01_journals_list.png')
    print("Saved 01_journals_list.png")

    # 2. Edit mode & reordering
    page.click('#journals-list-edit-btn')
    page.wait_for_timeout(400)
    page.screenshot(path='verification/screenshots/02_journals_edit_mode.png')
    print("Saved 02_journals_edit_mode.png")

    page.click('.journal-list-item-wrapper:first-child .reorder-next')
    page.wait_for_timeout(400)
    page.click('#journals-list-done-btn')
    page.wait_for_timeout(400)
    page.screenshot(path='verification/screenshots/03_journals_reordered.png')
    print("Saved 03_journals_reordered.png")

    # 3. Open journal feed
    page.click('.journal-list-item[data-id="j1"]')
    page.wait_for_selector('#journal-feed .journal-card')
    page.wait_for_timeout(600)
    page.screenshot(path='verification/screenshots/04_feed_cards.png')
    print("Saved 04_feed_cards.png")

    # 4. Scroll FAB hide/show
    page.evaluate('() => window.scrollTo(0, 500)')
    page.wait_for_timeout(400)
    page.screenshot(path='verification/screenshots/05_feed_scrolled_fab_hidden.png')
    print("Saved 05_feed_scrolled_fab_hidden.png")

    # 5. Open and close composer
    page.click('#fab')
    page.wait_for_timeout(400)
    page.screenshot(path='verification/screenshots/07_composer_open.png')
    print("Saved 07_composer_open.png")

    page.click('#close-cancel-btn')
    page.wait_for_timeout(400)

    # 6. Insights view
    page.click('#back-to-journals-btn')
    page.wait_for_timeout(400)
    page.click('.insights-widget')
    page.wait_for_timeout(600)
    page.screenshot(path='verification/screenshots/09_insights_view.png')
    print("Saved 09_insights_view.png")

    browser.close()
    print("All Playwright checks succeeded!")
