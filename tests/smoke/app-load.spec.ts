import { expect, test } from "@playwright/test";

test("app shell loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Multi-Level Cache Simulator" })).toBeVisible();
});
