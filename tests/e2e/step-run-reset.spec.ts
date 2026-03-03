import { expect, test } from "@playwright/test";

test("load built-in trace, then step/run/pause/reset shows visible transitions", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Built-in example").selectOption("writeback-eviction-cascade");

  const progress = page.locator("dt", { hasText: "Progress" }).locator("xpath=following-sibling::dd[1]");
  await expect(progress).toHaveText("0/4");
  await expect(page.getByText("No events yet")).toBeVisible();

  await page.getByRole("button", { name: "Step" }).click();
  await expect(progress).toHaveText("1/4");
  expect(await page.locator(".timeline-list li").count()).toBeGreaterThan(0);

  const postStepProgress = await progress.textContent();

  await page.getByRole("button", { name: "Run" }).click();
  await expect
    .poll(async () => progress.textContent(), {
      timeout: 5000,
      message: "Expected run mode to advance progress beyond the single-step state",
    })
    .not.toBe(postStepProgress);
  await page.getByRole("button", { name: "Pause" }).click();

  await expect(progress).not.toHaveText(postStepProgress ?? "1/4");
  await expect(page.locator("[data-testid='global-control-bar']")).toHaveAttribute("data-playing", "false");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(progress).toHaveText("0/4");
  await expect(page.getByText("No events yet")).toBeVisible();
});
