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

        // Directly call the initial logic
        window.showJournalsListView(null);
    }""")
    page.wait_for_timeout(1000)

    # Let's inspect what is visible on the page
    print("Page elements:", page.evaluate("() => document.body.innerHTML"))

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
