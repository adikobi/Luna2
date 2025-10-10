import asyncio
from playwright.async_api import async_playwright, expect
import os
import re

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        file_path = os.path.abspath('index.html')
        await page.goto(f'file://{file_path}')

        # 1. Login and navigate to the first journal
        await page.locator("#password-input").fill("6417")
        await page.locator("#password-submit-btn").click()
        await expect(page.locator("#journals-list-view")).to_be_visible()
        await page.locator(".journal-list-item").first.click()
        await expect(page.locator("#timeline-view")).to_be_visible()

        # 2. Verify the date format and alignment of the first entry
        first_entry_metadata = page.locator(".journal-card .metadata").first

        # Check for English format (e.g., 'OCT')
        await expect(first_entry_metadata).to_contain_text("OCT")

        # Check for center alignment
        await expect(first_entry_metadata).to_have_css("text-align", "center")

        # 3. Screenshot the view to visually confirm
        await page.screenshot(path="jules-scratch/verification/01_date_revert_verified.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())