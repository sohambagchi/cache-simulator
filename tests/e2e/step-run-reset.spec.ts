import { expect, test } from "@playwright/test";

test("load built-in trace, then step/run/pause/reset shows visible transitions", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("Built-in example").selectOption("writeback-eviction-cascade");

  const progress = page.locator(".stats-grid > div").first().locator("dd");
  await expect(progress).toHaveText("0/4");
  await expect(page.getByText("No events yet")).toBeVisible();

  await page.getByRole("button", { name: "Step" }).click();
  await expect(progress).toHaveText("1/4");
  await expect(page.locator(".timeline-list li").first()).toBeVisible();

  await page.getByRole("button", { name: "Run" }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Pause" }).click();

  await expect(progress).not.toHaveText("1/4");
  await expect(page.locator("[data-testid='global-control-bar']")).toHaveAttribute("data-playing", "false");

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(progress).toHaveText("0/4");
  await expect(page.getByText("No events yet")).toBeVisible();
});
