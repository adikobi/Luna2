import asyncio
import os
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2) # iPhone X viewport
        page = await context.new_page()

        # Navigate to the local index.html file
        file_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../index.html'))
        await page.goto(f'file://{file_path}')

        # --- Log in ---
        await page.locator('#password-input').fill('6417')
        await page.locator('#password-submit-btn').click()
        await expect(page.locator('#journals-list-view')).to_be_visible()

        # --- Create a new journal for a clean test state ---
        await page.locator('#add-journal-fab').click()
        await page.locator('#new-journal-name-input').fill('Test Journal for Final Polish')
        await page.locator('#create-new-journal-btn').click()
        await expect(page.locator('.journal-list-item').last).to_have_text('Test Journal for Final Polish')
        await page.locator('.journal-list-item').last.click()
        await expect(page.locator('#timeline-view')).to_be_visible()

        # --- 1. Verify RTL Alignment ---
        print("Verifying RTL checklist alignment...")
        await page.locator('#fab').click()
        await expect(page.locator('#composer-view')).to_be_visible()
        await page.locator('#add-checklist-btn').click()
        await page.keyboard.type('משימה בעברית') # Hebrew text
        await page.locator('#save-btn').click()
        await expect(page.locator('.journal-card')).to_have_count(1)

        # Take screenshot for RTL alignment verification
        await page.locator('.journal-card').screenshot(path='tests/screenshots/rtl_checklist_alignment.png')
        print("OK: Screenshot for RTL alignment saved.")

        # --- 2. Verify On-the-Fly Saving (Timeline View) ---
        print("\nVerifying on-the-fly saving from timeline view...")
        first_item_checkbox = page.locator('.journal-card .checklist-item input[type="checkbox"]').first
        await expect(first_item_checkbox).not_to_be_checked()

        await page.locator('.journal-card .checklist-item label').first.click()
        await expect(first_item_checkbox).to_be_checked()

        await page.reload()
        await page.locator('#password-input').fill('6417')
        await page.locator('#password-submit-btn').click()
        # FIX: Remove expect() from click action
        await page.locator('.journal-list-item').last.click() # Re-navigate to the journal
        await expect(page.locator('#timeline-view')).to_be_visible(timeout=10000)
        await expect(page.locator('.journal-card')).to_have_count(1)

        reloaded_checkbox = page.locator('.journal-card .checklist-item input[type="checkbox"]').first
        await expect(reloaded_checkbox).to_be_checked()
        print("OK: Checklist change from timeline view was saved automatically.")

        # --- 3. Verify On-the-Fly Saving (Composer View Mode) ---
        print("\nVerifying on-the-fly saving from composer view mode...")
        await page.locator('.journal-card').click()
        await expect(page.locator('#composer-view')).to_be_visible()
        await expect(page.locator('#edit-btn')).to_be_visible()

        composer_checkbox = page.locator('#composer-view .checklist-item input[type="checkbox"]').first
        await expect(composer_checkbox).to_be_checked()
        await page.locator('#composer-view .checklist-item label').first.click()
        await expect(composer_checkbox).not_to_be_checked()

        await page.locator('#close-cancel-btn').click()
        await expect(page.locator('#composer-view')).not_to_be_visible()

        await page.reload()
        await page.locator('#password-input').fill('6417')
        await page.locator('#password-submit-btn').click()
        # FIX: Remove expect() from click action
        await page.locator('.journal-list-item').last.click() # Re-navigate to the journal
        await expect(page.locator('#timeline-view')).to_be_visible(timeout=10000)
        await expect(page.locator('.journal-card')).to_have_count(1)

        final_reloaded_checkbox = page.locator('.journal-card .checklist-item input[type="checkbox"]').first
        await expect(final_reloaded_checkbox).not_to_be_checked()
        print("OK: Checklist change from composer view mode was saved automatically.")

        await browser.close()
        print("\nAll verifications passed!")

if __name__ == '__main__':
    asyncio.run(main())