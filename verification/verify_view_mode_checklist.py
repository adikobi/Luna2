from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8080")

    # Force UI state to allow clicking FAB
    page.evaluate("""
        document.body.classList.remove('loading');
        const splash = document.getElementById('splash-screen-overlay');
        if (splash) splash.remove();

        // Hide auth, show main layout
        document.getElementById('auth-view').style.display = 'none';

        // Force FAB to be visible (it might be hidden by default logic)
        const fab = document.getElementById('fab');
        fab.style.display = 'block';
        fab.style.visibility = 'visible';
        fab.style.opacity = '1';

        // Also ensure timeline view is theoretically 'active' so logic holds
        document.getElementById('timeline-view').style.display = 'block';

        // Create a dummy journal data for testing
        window.appData.currentJournalId = 'test-journal-1';
        window.appData.journals = [{id: 'test-journal-1', name: 'Test Journal', entries: {}}];
        window.journalsRef = {
            child: () => ({
                child: () => ({
                    child: () => ({
                        update: (data) => {
                            console.log('MOCK UPDATE:', data);
                            document.body.setAttribute('data-last-update', JSON.stringify(data));
                        }
                    })
                })
            })
        };
    """)

    # We need to simulate opening an existing entry in VIEW mode
    # populateComposerView(entry, 'view') is called
    page.evaluate("""
        const entry = {
            id: 'entry-1',
            date: new Date().toISOString(),
            text: `
                <div class="checklist-item" dir="rtl">
                    <input type="checkbox" id="test-check-view">
                    <label for="test-check-view">View Mode Checklist Item</label>
                </div>
            `
        };
        // Call the function directly to open in View mode
        // Assuming populateComposerView is globally accessible via the window or scope
        // If it's not exposed, we might need to rely on click handlers.
        // It is NOT exposed in window.
        // But we can trigger a click on a fake card.

        const feed = document.getElementById('journal-feed');
        const card = document.createElement('div');
        card.className = 'journal-card';
        card.dataset.id = 'entry-1';
        card.dataset.journalId = 'test-journal-1';
        card.innerHTML = entry.text; // Simplification
        feed.appendChild(card);

        // Mock the entry in appData
        window.appData.journals[0].entries['entry-1'] = entry;

        // Click the card to open composer in View mode
        card.click();
    """)

    # Wait for composer to be visible
    page.wait_for_selector('#composer-view.visible')

    # Click the label in the VIEW mode composer
    label = page.locator('#composer-view label[for="test-check-view"]')
    label.click()

    # Wait for a moment for async updates
    page.wait_for_timeout(500)

    # Verify visual state
    page.screenshot(path="/home/jules/verification/checklist_view_mode.png")

    # Check if checkbox is checked (Visual/State)
    is_checked = page.is_checked('#composer-view #test-check-view')
    print(f"Checkbox is checked: {is_checked}")

    # Check if update was called (via our mock)
    last_update = page.get_attribute('body', 'data-last-update')
    print(f"Update called with: {last_update}")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
