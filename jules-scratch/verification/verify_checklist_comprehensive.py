import asyncio
from playwright.async_api import async_playwright, expect
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(storage_state=None, no_viewport=True)
        page = await context.new_page()
        await page.set_viewport_size({"width": 480, "height": 800})

        test_start_time = int(time.time())

        try:
            await page.goto("http://localhost:8000", timeout=60000)

            # --- Full Authentication and Setup ---
            await page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")
            await page.reload()

            await page.wait_for_function("""
                () => {
                    const pinView = document.getElementById('pin-view');
                    const authView = document.getElementById('auth-view');
                    return (pinView && pinView.style.display !== 'none') ||
                           (authView && authView.style.display !== 'none');
                }
            """, timeout=15000)

            if await page.locator("#auth-view").is_visible():
                print("Auth view is visible. Signing up a new user...")
                await page.get_by_role("button", name="הרשמה").click()
                username = f"tester{test_start_time}"
                email = f"tester{test_start_time}@test.com"
                await page.locator("#signup-username").fill(username)
                await page.locator("#signup-email").fill(email)
                await page.locator("#signup-password").fill("password123")
                await page.get_by_role("button", name="הרשמה").nth(1).click()

                await page.wait_for_selector("#pin-setup-view", state="visible", timeout=15000)
                await page.locator("#pin-setup-input").fill("1234")
                await page.get_by_role("button", name="הגדר").click()
            else:
                print("PIN view is visible. Entering PIN...")
                await page.wait_for_selector("#pin-input", state="visible", timeout=15000)
                await page.locator("#pin-input").fill("1234")
                await page.get_by_role("button", name="כניסה").click()

            await page.wait_for_selector("#journals-list-view", state="visible", timeout=15000)

            if await page.locator(".journal-list-item", has_text="ויטמינים").count() == 0:
                print("Creating 'ויטמינים' journal...")
                await page.locator("#add-journal-fab").click()
                await page.wait_for_selector("#new-journal-modal", state="visible")
                await page.locator("#new-journal-name-input").fill("ויטמינים")
                await page.get_by_role("button", name="צור").click()
                await expect(page.locator("#new-journal-modal")).not_to_be_visible()
                await page.wait_for_timeout(1000)

            await page.locator(".journal-list-item", has_text="ויטמינים").click()

            # --- Scenario A: Edit mode ---
            print("Testing Scenario A: Edit mode...")
            await page.locator("#fab").click()
            await page.wait_for_selector("#composer-view.visible")

            composer = page.locator("#composer-view.visible")
            vitamin_d_item_a = composer.locator(".checklist-item", has_text="ויטמין D")
            await vitamin_d_item_a.locator("label").click()
            await expect(vitamin_d_item_a.locator("input[type='checkbox']")).to_be_checked()

            await page.get_by_role("button", name="סיום").click()
            await expect(composer).not_to_be_visible()
            await page.wait_for_timeout(1000)

            await page.locator(".journal-card").first.click()
            await page.wait_for_selector("#composer-view.visible")

            composer_reopened_a = page.locator("#composer-view.visible")
            await expect(composer_reopened_a.locator(".checklist-item", has_text="ויטמין D").locator("input[type='checkbox']")).to_be_checked()
            print("Scenario A successful.")

            await page.get_by_role("button", name="סגור").click()
            await expect(composer_reopened_a).not_to_be_visible()

            # --- Scenario B: Timeline view quick-toggle ---
            print("Testing Scenario B: Timeline view quick-toggle...")
            card = page.locator(".journal-card").first
            vitamin_b12_item_b = card.locator(".checklist-item", has_text="ויטמין B12")

            await vitamin_b12_item_b.locator("label").click()
            await expect(vitamin_b12_item_b.locator("input[type='checkbox']")).to_be_checked()
            print("Quick-toggle successful visually.")

            await page.wait_for_timeout(2000) # Allow time for Firebase to save

            print("Reloading page to verify persistence...")
            await page.reload()

            # Re-authenticate after reload
            await page.wait_for_selector("#pin-input", state="visible", timeout=15000)
            await page.locator("#pin-input").fill("1234")
            await page.get_by_role("button", name="כניסה").click()

            await page.wait_for_selector(".journal-list-item", state="visible")
            await page.locator(".journal-list-item", has_text="ויטמינים").click()

            await page.wait_for_selector(".journal-card", state="visible")
            card_reloaded = page.locator(".journal-card").first

            await expect(card_reloaded.locator(".checklist-item", has_text="ויטמין D").locator("input")).to_be_checked()
            await expect(card_reloaded.locator(".checklist-item", has_text="ויטמין B12").locator("input")).to_be_checked()
            print("Scenario B successful.")

            await page.screenshot(path="jules-scratch/verification/checklist_comprehensive_verification.png")
            print("\nComprehensive verification successful!")

        except Exception as e:
            print(f"\nAn error occurred during verification: {e}")
            await page.screenshot(path="jules-scratch/verification/verification_error.png")
            raise

        finally:
            await context.close()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())