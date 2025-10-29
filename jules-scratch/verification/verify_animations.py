from playwright.sync_api import sync_playwright, expect
import time
import os

def run_verification(playwright):
    # Ensure the verification directory exists
    os.makedirs("jules-scratch/verification", exist_ok=True)

    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={'width': 375, 'height': 812},
        is_mobile=True,
        record_video_dir="jules-scratch/verification/",
        record_video_size={'width': 375, 'height': 812}
    )
    page = context.new_page()

    try:
        page.goto("http://localhost:8000")

        # Create a unique user
        unique_email = f"anim_test_{int(time.time())}@example.com"
        unique_username = f"anim_test_{int(time.time())}"

        page.locator("#show-signup-btn").click()
        page.locator("#signup-username").fill(unique_username)
        page.locator("#signup-email").fill(unique_email)
        page.locator("#signup-password").fill("password123")
        page.locator("#signup-btn").click()

        expect(page.locator("#pin-setup-view")).to_be_visible(timeout=10000)
        page.locator("#pin-setup-input").fill("1234")
        page.locator("#pin-setup-btn").click()

        # Wait for the empty state to be visible
        expect(page.locator("#empty-state-container")).to_be_visible(timeout=10000)
        page.wait_for_timeout(500) # Wait for initial render

        # --- Test fade-in animation ---
        # Create a new journal
        page.locator("#create-first-journal-btn").click()
        expect(page.locator("#new-journal-modal")).to_be_visible()
        page.locator("#new-journal-name-input").fill("My Animated Journal")
        page.locator("#create-new-journal-btn").click()

        # Wait for the new journal to appear in the list. The animation is handled by CSS.
        expect(page.locator(".journal-list-item-wrapper")).to_be_visible()
        page.wait_for_timeout(1000) # Allow time to see the fade-in

        # --- Test slide-up animation ---
        fab = page.locator("#add-journal-fab")
        expect(fab).to_be_visible()
        fab.click()

        # The composer should slide up. We'll check for the 'visible' class.
        composer = page.locator("#composer-view")
        expect(composer).to_have_class("visible", timeout=2000)
        page.wait_for_timeout(1000) # Allow time to see the slide-up animation finish

        # Close the composer to see it slide down
        page.locator("#close-cancel-btn").click()
        expect(composer).not_to_have_class("visible", timeout=2000)
        page.wait_for_timeout(1000) # Allow time to see the slide-down animation finish

    finally:
        # Save video path before closing context
        video_path = page.video.path()
        context.close()
        browser.close()
        # Rename the video file
        os.rename(video_path, "jules-scratch/verification/animation_verification.webm")


with sync_playwright() as playwright:
    run_verification(playwright)
