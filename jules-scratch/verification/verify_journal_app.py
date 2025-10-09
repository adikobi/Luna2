import asyncio
from playwright.async_api import async_playwright, expect
import os
import re

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        # 1. Navigate to the local HTML file
        await page.goto(f'file://{file_path}')

        # 2. Screenshot the initial Timeline View
        await page.screenshot(path="jules-scratch/verification/01_timeline_view.png")

        # 3. Click the FAB to open the composer
        fab = page.locator("#fab")
        await fab.click()

        # Wait for the composer to be visible by checking for the 'visible' class
        composer_view = page.locator("#composer-view")
        await expect(composer_view).to_have_class(re.compile("visible"))

        # Add a delay for the animation to complete
        await page.wait_for_timeout(500)

        # 4. Screenshot the Composer View
        await page.screenshot(path="jules-scratch/verification/02_composer_view.png")

        # 5. Fill out the new entry
        await page.locator("#entry-title").fill("My New Entry")
        await page.locator("#entry-textarea").fill("This is a test entry from the verification script.")

        # 6. Click "Done"
        await page.locator("#done-btn").click()

        # Wait for composer to disappear by checking that the 'visible' class is removed
        await expect(composer_view).not_to_have_class(re.compile("visible"))

        # Add a delay for the closing animation to complete
        await page.wait_for_timeout(500)

        # 7. Screenshot the updated timeline
        await page.screenshot(path="jules-scratch/verification/03_updated_timeline.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())