import asyncio
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context()
        page = await context.new_page()

        # Navigate to the app
        await page.goto("http://localhost:8000")

        # Wait for the page to be somewhat loaded
        await page.wait_for_timeout(2000)

        # Force the composer view to be visible
        await page.evaluate("""() => {
            const composerView = document.getElementById('composer-view');
            composerView.classList.add('visible');
            composerView.style.opacity = '1';
            composerView.style.visibility = 'visible';
        }""")

        # Interact with Editor
        await expect(page.locator("#entry-textarea")).to_be_visible()
        await page.locator("#entry-textarea").click()
        await page.locator("#entry-textarea").type("Hello, world!")

        # Take screenshot for verification
        await page.screenshot(path="tests/cursor_verification.png")

        await browser.close()

asyncio.run(main())
