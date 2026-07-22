from playwright.sync_api import sync_playwright

def run_cuj(page):
    page.goto("http://localhost:8000")
    page.wait_for_timeout(2000)

    # Force bypass auth and show the main list view with fake journals
    page.evaluate("""() => {
        document.body.classList.remove('loading');
        const splash = document.getElementById('splash-screen-overlay');
        if (splash) splash.remove();

        // Hide auth, setup main layout
        document.getElementById('auth-view').style.display = 'none';

        window.appData.currentUser = { uid: 'test-user-id' };
        window.appData.journals = [
            { id: 'j1', name: 'יומן מסע', type: 'default', parentId: null },
            { id: 'j2', name: 'משקל', type: 'graph', parentId: null },
            { id: 'j3', name: 'תיקיית בריאות', type: 'folder', parentId: null }
        ];

        window.showJournalsListView(null);
    }""")
    page.wait_for_timeout(1000)

    # Take screenshot of the Journals List View
    page.screenshot(path="/home/jules/verification/screenshots/journals_list.png")
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
