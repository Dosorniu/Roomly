import { test, expect } from "@playwright/test";

test("HTTP 404 and preserved legacy QR links", async ({ request }) => {
  const missing = await request.get("/rooms/not-a-room");
  expect(missing.status()).toBe(404);
  const invalid = await request.get("/app/cbs/main-building/1/room-214");
  expect(invalid.status()).toBe(404);
  const old = await request.get("/app/cbs/main-building/2/room-214", {
    maxRedirects: 0,
  });
  expect(old.status()).toBe(308);
  expect(old.headers().location).toBe("/rooms/214");
  const home = await request.get("/");
  expect(home.headers()["content-security-policy"]).toContain(
    "object-src 'none'",
  );
  expect(home.headers()["content-security-policy"]).toContain(
    "script-src 'self' 'nonce-",
  );
});

test("search and mobile layout retain the 27-room catalog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  // The catalog shows all study spaces by default.
  await expect(page.locator(".room-row")).toHaveCount(27);
  await page
    .getByPlaceholder("Search by room, building or floor...")
    .fill("Copenhagen");
  await expect(page.locator(".room-row")).toHaveCount(1);
  await expect(page.getByText("Copenhagen", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  // All five quick filters fit on a phone — no sideways scrolling of the row.
  expect(
    await page.evaluate(() => {
      const row = document.querySelector(".quick-actions")!;
      return row.scrollWidth <= row.clientWidth;
    }),
  ).toBe(true);
});

test("check-in, cross-tab join, holder transfer and final leave", async ({
  page,
  context,
}) => {
  await page.goto("/rooms/112");
  await page.getByRole("button", { name: "Check In", exact: true }).click();
  await page.getByRole("switch").check();
  await page
    .getByRole("button", { name: "Confirm Check In", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Leave Room", exact: true }),
  ).toBeVisible();
  const participant = await context.newPage();
  await participant.addInitScript(() =>
    sessionStorage.setItem("cbs-demo-user", "student-B"),
  );
  await participant.goto("/rooms/112");
  await participant
    .getByRole("button", { name: "Join Room", exact: true })
    .click();
  await expect(page.getByText("2 / 6", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Leave Room", exact: true }).click();
  await expect(
    participant.getByRole("button", { name: "Update Status", exact: true }),
  ).toBeVisible();
  await participant
    .getByRole("button", { name: "Leave Room", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check In", exact: true }),
  ).toBeVisible();
});

test("saved dark appearance applies even before React hydrates", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "nagroom-appearance-v1",
      JSON.stringify({
        mode: "dark",
        palette: "cbs",
        textSize: "large",
        fontWeight: "bold",
      }),
    ),
  );
  // Block the application entry: the small pre-paint script must stand alone.
  await page.route(/virtual:vinext|@vite\/client|@react-refresh/, (route) =>
    route.abort(),
  );
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator("html")).toHaveAttribute("data-palette", "cbs");
});

test("My bookings page shows the empty state by default", async ({ page }) => {
  await page.goto("/bookings");
  await expect(
    page.getByRole("heading", { name: "My bookings", level: 1 }),
  ).toBeVisible();
  // Demo mode starts with no reservations.
  await expect(page.getByText("No upcoming bookings")).toBeVisible();
  // The nav link to bookings is present in the header.
  await expect(
    page.getByRole("link", { name: "My bookings" }).first(),
  ).toBeVisible();
});

test("check-in works on a room with no recent update — no confirmation step", async ({
  page,
}) => {
  await page.goto("/rooms/321");
  await page.getByRole("button", { name: "Check In", exact: true }).click();
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Confirm Check In", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Leave Room", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leave Room", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Check In", exact: true }),
  ).toBeVisible();
});

test("a calendar booking can be shared with others", async ({ page }) => {
  await page.goto("/rooms/214");
  await page
    .locator(".bkslot, button", { hasText: /^Free$/ })
    .first()
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Can others join you?")).toBeVisible();
  await sheet.getByRole("switch").click();
  await expect(sheet.getByText("Yes — Open to Share")).toBeVisible();
  await sheet.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.locator(".bkblock.mine")).toContainText("open");
});

test("cancelling your own booking asks for confirmation first", async ({
  page,
}) => {
  await page.goto("/rooms/214");
  await page.locator("button.freecell").first().click();
  await page.getByRole("button", { name: "Confirm booking" }).click();
  const mine = page.locator(".bkblock.mine");
  await expect(mine).toHaveCount(1);
  await mine.click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Cancel this booking?")).toBeVisible();
  await sheet.getByRole("button", { name: "Keep booking" }).click();
  await expect(mine).toHaveCount(1);
  await mine.click();
  await page.getByRole("button", { name: "Cancel booking" }).click();
  await expect(mine).toHaveCount(0);
});

test("My bookings shows the current check-in and can leave it", async ({
  page,
}) => {
  await page.goto("/rooms/321");
  await page.getByRole("button", { name: "Check In", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm Check In", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Leave Room", exact: true }),
  ).toBeVisible();
  // Another room names the room you are in.
  await page.goto("/rooms/214");
  await expect(page.getByText("You are checked in to")).toBeVisible();
  await page.goto("/bookings");
  await expect(page.getByText("Checked in now")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open room" })).toBeVisible();
  await page.getByRole("button", { name: "Leave", exact: true }).click();
  await expect(page.getByText("Checked in now")).toHaveCount(0);
});
