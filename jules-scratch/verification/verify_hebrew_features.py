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

        # 1. Initial state screenshot (check for Hebrew title and dates)
        await page.screenshot(path="jules-scratch/verification/01_hebrew_initial.png")

        # 2. Open the composer and check for translated UI
        await page.locator("#fab").click()
        composer_view = page.locator("#composer-view")
        await expect(composer_view).to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500)

        await expect(page.locator("#cancel-btn")).to_have_text("ביטול")
        await expect(page.locator("#done-btn")).to_have_text("סיום")
        await expect(page.locator("#entry-title")).to_have_attribute("placeholder", "כותרת")

        # 3. Create a new entry with Hebrew text and a link
        title_input = page.locator("#entry-title")
        text_input = page.locator("#entry-textarea")

        await title_input.fill("רשומה בעברית")
        await text_input.fill("זוהי בדיקה. הנה קישור: https://www.google.com")

        # 4. Check for dynamic RTL direction
        await expect(title_input).to_have_attribute("dir", "rtl")
        await expect(text_input).to_have_attribute("dir", "rtl")

        # 5. Screenshot the composer view with Hebrew text
        await page.screenshot(path="jules-scratch/verification/02_hebrew_composer.png")

        # 6. Save the entry
        await page.locator("#done-btn").click()
        await expect(composer_view).not_to_have_class(re.compile("visible"))
        await page.wait_for_timeout(500)

        # 7. Verify the new entry is displayed correctly
        new_entry_card = page.locator('.journal-card[data-index="0"]')
        body_text = new_entry_card.locator(".body-text")

        # Check for RTL direction
        await expect(body_text).to_have_attribute("dir", "rtl")

        # Check for clickable link
        link = body_text.locator("a")
        await expect(link).to_have_attribute("href", "https://www.google.com")
        await expect(link).to_be_visible()

        # 8. Final screenshot
        await page.screenshot(path="jules-scratch/verification/03_hebrew_final_timeline.png")

        await browser.close()

if __name__ == '__main__':
    asyncio.run(main())