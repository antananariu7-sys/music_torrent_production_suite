import { type Page, type Locator, expect } from '@playwright/test';

/**
 * Wait for element to be visible and return it
 */
export async function waitForElement(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<Locator> {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  return element;
}

/**
 * Fill form field with automatic waiting and validation
 */
export async function fillField(
  page: Page,
  selector: string,
  value: string,
  options?: { pressEnter?: boolean }
): Promise<void> {
  const field = await waitForElement(page, selector);
  await field.fill(value);

  if (options?.pressEnter) {
    await field.press('Enter');
  }

  // Verify the value was set
  await expect(field).toHaveValue(value);
}

/**
 * Click element with automatic waiting
 */
export async function clickElement(
  page: Page,
  selector: string,
  options?: { waitForNavigation?: boolean }
): Promise<void> {
  const element = await waitForElement(page, selector);

  if (options?.waitForNavigation) {
    await Promise.all([
      page.waitForLoadState('networkidle'),
      element.click(),
    ]);
  } else {
    await element.click();
  }
}

/**
 * Wait for text to appear on page
 */
export async function waitForText(
  page: Page,
  text: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector(`text=${text}`, { timeout });
}

/**
 * Check if element exists without waiting
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  const element = page.locator(selector);
  return (await element.count()) > 0;
}

/**
 * Get element text content
 */
export async function getElementText(page: Page, selector: string): Promise<string> {
  const element = await waitForElement(page, selector);
  return (await element.textContent()) || '';
}

/**
 * Select dropdown option
 */
export async function selectOption(
  page: Page,
  selector: string,
  value: string
): Promise<void> {
  const select = await waitForElement(page, selector);
  await select.selectOption(value);
}

/**
 * Wait for element to disappear
 */
export async function waitForElementToDisappear(
  page: Page,
  selector: string,
  timeout: number = 5000
): Promise<void> {
  await page.waitForSelector(selector, { state: 'hidden', timeout });
}

/**
 * Retry action until it succeeds or times out
 */
export async function retryUntilSuccess<T>(
  action: () => Promise<T>,
  maxAttempts: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Take screenshot on test failure
 */
export async function screenshotOnFailure(
  page: Page,
  testName: string
): Promise<void> {
  const sanitizedName = testName.replace(/[^a-z0-9]/gi, '_');
  await page.screenshot({
    path: `test-results/failures/${sanitizedName}.png`,
    fullPage: true,
  });
}

/**
 * Clear all input fields in a form
 */
export async function clearForm(page: Page, formSelector: string): Promise<void> {
  const form = page.locator(formSelector);
  const inputs = form.locator('input, textarea');
  const count = await inputs.count();

  for (let i = 0; i < count; i++) {
    await inputs.nth(i).clear();
  }
}
