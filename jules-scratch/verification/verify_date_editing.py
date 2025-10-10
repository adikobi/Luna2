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
        await page.goto(f'file://{file_path}')

        # 1. Initial state screenshot
        await page.screenshot(path="jules-scratch/verification/01_date_initial.png")

        # 2. Edit the first entry and change its date to the past
        await page.locator('.journal-card[data-index="0"] .edit-btn').click()

        composer_view = page.locator("#composer-view")
        await expect(composer_view).to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500)

        # Change the date to October 1st, 2025
        await page.locator("#entry-date").fill("2025-10-01T10:00")

        # 3. Screenshot the composer with the new date
        await page.screenshot(path="jules-scratch/verification/02_date_editing_view.png")

        await page.locator("#done-btn").click()

        await expect(composer_view).not_to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500)

        # 4. Screenshot after edit and re-sort. The entry should have moved down.
        await page.screenshot(path="jules-scratch/verification/03_after_date_edit.png")

        # 5. Create a new entry with a future date
        await page.locator("#fab").click()
        await expect(composer_view).to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500)

        await page.locator("#entry-title").fill("Future Entry")
        await page.locator("#entry-textarea").fill("This entry is from the future.")
        await page.locator("#entry-date").fill("2026-01-01T12:00")

        await page.locator("#done-btn").click()
        await expect(composer_view).not_to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500)

        # 6. Screenshot the final state with the future entry at the top
        await page.screenshot(path="jules-scratch/verification/04_after_future_entry.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())