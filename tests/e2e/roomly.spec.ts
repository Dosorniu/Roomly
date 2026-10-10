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
  await expect(page.getByRole("link", { name: "My bookings" }).first()).toBeVisible();
});
