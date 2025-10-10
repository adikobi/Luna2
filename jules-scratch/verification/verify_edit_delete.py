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
        await page.screenshot(path="jules-scratch/verification/01_edit_delete_initial.png")

        # 2. Delete the second entry ("Another day, another entry...")
        await page.locator('.journal-card[data-index="1"] .delete-btn').click()
        await page.screenshot(path="jules-scratch/verification/02_after_delete.png")

        # 3. Edit the first entry ("This is the first journal entry...")
        await page.locator('.journal-card[data-index="0"] .edit-btn').click()

        # Wait for composer to be visible
        composer_view = page.locator("#composer-view")
        await expect(composer_view).to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500) # Wait for animation

        # 4. Screenshot the composer pre-filled for editing
        await page.screenshot(path="jules-scratch/verification/03_editing_view.png")

        # 5. Modify the text and update
        await page.locator("#entry-title").fill("Updated Title")
        await page.locator("#entry-textarea").fill("This entry has been successfully updated.")
        await page.locator("#done-btn").click()

        # Wait for composer to disappear by checking for the absence of the 'visible' class
        await expect(composer_view).not_to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500) # Wait for animation

        # 6. Screenshot the final state
        await page.screenshot(path="jules-scratch/verification/04_after_edit.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())