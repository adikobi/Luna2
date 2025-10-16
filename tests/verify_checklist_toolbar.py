import asyncio
import os
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2)
        page = await context.new_page()

        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../index.html'))

        # --- Setup: Create one journal for all tests ---
        print("--- Setting up test journal ---")
        await page.goto(f'file://{file_path}')
        await page.locator('#password-input').fill('6417')
        await page.locator('#password-submit-btn').click()
        await expect(page.locator('#journals-list-view')).to_be_visible()

        journal_name = "Combined Formatting Test"
        # Cleanup from previous runs
        while await page.locator(f'.journal-list-item:has-text("{journal_name}")').count() > 0:
            print(f"Cleaning up existing journal: {journal_name}")
            await page.locator('#journals-list-edit-btn').click()
            await page.locator(f'.journal-list-item-wrapper:has-text("{journal_name}") .delete-journal-btn').first.click(force=True)
            await page.locator('#journals-list-done-btn').click()
            await page.wait_for_timeout(500)

        await page.locator('#add-journal-fab').click()
        await page.locator('#new-journal-name-input').fill(journal_name)
        await page.locator('#create-new-journal-btn').click()
        await expect(page.locator('.journal-list-item').last).to_have_text(journal_name)
        await page.locator('.journal-list-item').last.click()
        await expect(page.locator('#timeline-view')).to_be_visible()

        # --- Combined Test: Verify Formatting for both cases in one entry ---
        print("\n--- Running combined formatting test ---")
        await page.locator('#fab').click()
        await expect(page.locator('#composer-view')).to_be_visible()

        editor = page.locator('#entry-textarea')

        # Case 1: Text followed by a checklist item
        await editor.type("This is a line of text.")
        await editor.press("Enter")
        await page.locator('#add-checklist-btn').click()
        await page.keyboard.type("First item")

        # Case 2: A second, consecutive checklist item
        await page.keyboard.press("Enter")
        await page.keyboard.type("Second item")

        # Save the combined entry
        await page.locator('#save-btn').click()
        await expect(page.locator('.journal-card')).to_have_count(1)

        # --- Assertions ---
        body_text_html = await page.locator('.journal-card .body-text').inner_html()

        # Assertion for Case 1
        assert "This is a line of text.<br>" in body_text_html
        print("OK: Text and checklist are on separate lines.")

        # Assertion for Case 2
        expected_structure = '</div><div class="checklist-item">'
        cleaned_html = body_text_html.replace('\n', '').replace(' ', '')
        assert expected_structure in cleaned_html
        print("OK: No extra newline is added between consecutive checklist items.")

        await browser.close()
        print("\nAll formatting verifications passed!")

if __name__ == '__main__':
    asyncio.run(main())