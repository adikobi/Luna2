import asyncio
import os
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={'width': 375, 'height': 667}, device_scale_factor=2)
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
        await page.locator('#new-journal-name-input').fill('Test Journal for Checklist')
        await page.locator('#create-new-journal-btn').click()
        await expect(page.locator('.journal-list-item').last).to_have_text('Test Journal for Checklist')
        await page.locator('.journal-list-item').last.click()
        await expect(page.locator('#timeline-view')).to_be_visible()

        # --- 1. Verify Deleting a New, Unsaved Entry ---
        print("Verifying delete behavior for new entry...")
        await page.locator('#fab').click()
        await expect(page.locator('#composer-view')).to_be_visible()
        await page.locator('#delete-entry-btn').click()
        await expect(page.locator('#composer-view')).not_to_be_visible()
        print("OK: Deleting a new entry closes the composer immediately.")

        # --- 2. Verify Checklist State Persistence and Redesign ---
        print("\nVerifying checklist state persistence and redesign...")
        await page.locator('#fab').click()
        await expect(page.locator('#composer-view')).to_be_visible()

        add_checklist_btn = page.locator('#add-checklist-btn')

        # Add first item using more robust keyboard actions
        await add_checklist_btn.click()
        await page.keyboard.type('First item')

        # Add second item
        await page.keyboard.press('Enter')
        await page.keyboard.type('Second item')

        # Check the second item, ensuring it's visible first
        second_item_label = page.locator('.checklist-item label').last
        await second_item_label.scroll_into_view_if_needed()
        await second_item_label.click()

        # Take a screenshot of the redesigned checklist
        await page.screenshot(path='tests/screenshots/redesigned_checklist.png')
        print("OK: Screenshot of redesigned checklist saved.")

        # Save the entry
        await page.locator('#save-btn').click()
        await expect(page.locator('#composer-view')).not_to_be_visible()
        await expect(page.locator('.journal-card')).to_have_count(1, timeout=5000)

        # Re-open the entry
        await page.locator('.journal-card').click()
        await expect(page.locator('#composer-view')).to_be_visible()

        # Verify the state
        first_item_checkbox = page.locator('.checklist-item input[type="checkbox"]').first
        second_item_checkbox = page.locator('.checklist-item input[type="checkbox"]').last

        await expect(first_item_checkbox).not_to_be_checked()
        await expect(second_item_checkbox).to_be_checked()
        print("OK: Checklist state was saved and restored correctly.")

        # --- 3. Verify Deleting an Existing Entry ---
        print("\nVerifying delete behavior for existing entry...")

        await page.locator('#edit-btn').click()
        await expect(page.locator('#delete-entry-btn')).to_be_visible()

        dialog_accepted = False
        # FIX: The handler must be async and `dialog.accept()` must be awaited.
        async def handle_dialog(dialog):
            nonlocal dialog_accepted
            dialog_accepted = True
            assert dialog.message == 'האם את בטוחה שאת רוצה למחוק את הרשומה?'
            await dialog.accept()

        page.on('dialog', handle_dialog)

        await page.locator('#delete-entry-btn').click()

        await page.wait_for_timeout(500) # Give time for dialog to be handled
        assert dialog_accepted, "Confirmation dialog was not shown for an existing entry."
        print("OK: Confirmation dialog appeared for existing entry.")

        await expect(page.locator('#composer-view')).not_to_be_visible()
        await expect(page.locator('.journal-card')).to_have_count(0)
        print("OK: Existing entry was deleted successfully.")

        await browser.close()
        print("\nAll verifications passed!")

if __name__ == '__main__':
    asyncio.run(main())