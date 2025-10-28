
from playwright.sync_api import sync_playwright, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Generate a unique user for this test run
    unique_id = str(int(time.time()))
    username = f"testuser_{unique_id}"
    email = f"testuser_{unique_id}@example.com"
    password = "password123"

    try:
        page.goto("http://localhost:8000")

        # --- Sign up a new user ---
        expect(page.locator("#auth-view")).to_be_visible()
        page.locator("#show-signup-btn").click()
        expect(page.locator("#signup-form")).to_be_visible()

        page.locator("#signup-username").fill(username)
        page.locator("#signup-email").fill(email)
        page.locator("#signup-password").fill(password)
        page.locator("#signup-btn").click()

        # --- Set up PIN ---
        expect(page.locator("#pin-setup-view")).to_be_visible(timeout=10000)
        page.locator("#pin-setup-input").fill("1234")
        page.locator("#pin-setup-btn").click()

        # --- Main Test Logic ---
        expect(page.locator("#journals-list-view")).to_be_visible(timeout=10000)

        # Create a new journal with an icon
        page.locator("#add-journal-fab").click()
        expect(page.locator("#new-journal-modal")).to_be_visible()
        page.locator("#new-journal-name-input").fill("Icon Test Journal")
        page.locator('#new-journal-icon-picker button[data-icon="star"]').click()
        page.locator("#create-new-journal-btn").click()
        expect(page.locator("#new-journal-modal")).not_to_be_visible()

        # Wait for the journal to appear
        expect(page.get_by_text("Icon Test Journal")).to_be_visible(timeout=10000)

        # Edit the journal
        page.locator("#journals-list-edit-btn").click()

        # Disable animations before clicking
        page.evaluate("document.head.insertAdjacentHTML('beforeend', '<style id=\\'no-animations\\'>@keyframes jiggle { from { transform: none; } to { transform: none; } }</style>')")

        journal_wrapper = page.locator('.journal-list-item-wrapper:has-text("Icon Test Journal")')
        journal_wrapper.locator(".edit-journal-btn").click()

        # Re-enable animations
        page.evaluate("document.getElementById('no-animations').remove()")

        expect(page.locator("#edit-journal-modal")).to_be_visible()
        page.locator("#edit-journal-name-input").fill("Edited Journal")
        page.locator('#edit-journal-icon-picker button[data-icon="heart"]').click()
        page.locator("#save-edit-journal-btn").click()
        expect(page.locator("#edit-journal-modal")).not_to_be_visible()

        # Wait for the edited journal to appear
        expect(page.get_by_text("Edited Journal")).to_be_visible(timeout=10000)

        # Done editing
        page.locator("#journals-list-done-btn").click()

        # Give a moment for final render before screenshot
        page.wait_for_timeout(500)

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
        print("Error screenshot taken.")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)
