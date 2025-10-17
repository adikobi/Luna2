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
                () => document.getElementById('auth-view') && document.getElementById('auth-view').style.display !== 'none'
            """, timeout=15000)

            print("Auth view is visible. Signing up a new user to test 'Enter' key...")
            await page.get_by_role("button", name="הרשמה").click()

            username = f"tester{test_start_time}"
            email = f"tester{test_start_time}@test.com"
            await page.locator("#signup-username").fill(username)
            await page.locator("#signup-email").fill(email)

            # Test 'Enter' on the last field of the signup form
            await page.locator("#signup-password").fill("password123")
            await page.locator("#signup-password").press("Enter")

            await page.wait_for_selector("#pin-setup-view", state="visible", timeout=15000)
            print("Signup with 'Enter' successful.")

            # Test 'Enter' on PIN setup
            await page.locator("#pin-setup-input").fill("1234")
            await page.locator("#pin-setup-input").press("Enter")

            # Assert that the setup was successful by waiting for the journals list view
            await expect(page.locator("#journals-list-view")).to_be_visible(timeout=10000)
            print("PIN setup with 'Enter' successful.")

            # Log out and log back in to test PIN entry
            await page.locator("#lock-app-btn").click()
            await page.wait_for_selector("#pin-view", state="visible")

            await page.locator("#pin-input").fill("1234")
            await page.locator("#pin-input").press("Enter")

            await expect(page.locator("#journals-list-view")).to_be_visible(timeout=10000)
            print("PIN login with 'Enter' successful.")

            await page.screenshot(path="jules-scratch/verification/enter_to_submit_verification.png")
            print("\nComprehensive 'Enter' key verification successful!")

        except Exception as e:
            print(f"\nAn error occurred during verification: {e}")
            await page.screenshot(path="jules-scratch/verification/verification_error.png")
            raise

        finally:
            await context.close()
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())