import asyncio
from playwright.async_api import async_playwright, expect
import time

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Listen for all console events and print them
        page.on("console", lambda msg: print(f"BROWSER CONSOLE: {msg.text}"))

        # Generate unique credentials for this test run
        timestamp = int(time.time())
        username = f"testuser_{timestamp}"
        email = f"test_{timestamp}@example.com"
        password = "password123"
        pin = "1234"

        try:
            # Navigate to the app
            await page.goto("http://localhost:8000/index.html", wait_until="domcontentloaded")

            # --- Sign Up ---
            await page.get_by_role("button", name="הרשמה").nth(0).click() # The signup tab button
            await expect(page.locator("#signup-form")).to_be_visible()

            await page.locator("#signup-username").fill(username)
            await page.locator("#signup-email").fill(email)
            await page.locator("#signup-password").fill(password)

            await page.get_by_role("button", name="הרשמה").nth(1).click() # The signup form button

            # --- Set PIN ---
            await expect(page.locator("#pin-setup-view")).to_be_visible(timeout=15000)
            await page.locator("#pin-setup-input").fill(pin)
            await page.locator("#pin-setup-btn").click()

            # --- Main App & Logout ---
            await expect(page.locator("#journals-list-view")).to_be_visible(timeout=15000)

            await page.locator("#lock-app-btn").click()
            await expect(page.locator("#pin-view")).to_be_visible()
            await page.locator("#logout-btn").click()

            # --- Login ---
            await expect(page.locator("#auth-view")).to_be_visible()
            await page.locator("#login-email-username").fill(username)
            await page.locator("#login-password").fill(password)
            await page.locator("#login-btn").click()

            # --- Enter PIN ---
            await expect(page.locator("#pin-view")).to_be_visible(timeout=15000)
            await page.locator("#pin-input").fill(pin)
            await page.locator("#pin-submit-btn").click()

            # --- Final Verification ---
            await expect(page.locator("#journals-list-view")).to_be_visible(timeout=15000)
            await page.screenshot(path="jules-scratch/verification/verification.png")
            print("Screenshot saved to jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            await page.screenshot(path="jules-scratch/verification/error_screenshot.png")
            print("Error screenshot saved to jules-scratch/verification/error_screenshot.png")
            raise

        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())