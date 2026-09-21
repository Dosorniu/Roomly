import { createClient, type SupabaseClient } from "@supabase/supabase-js";
export const sharedMode = process.env.NEXT_PUBLIC_ROOMLY_MODE === "supabase";
let client: SupabaseClient | undefined;
export function getSupabase() {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key)
    throw new Error(
      "Supabase is not configured. Add the project URL and publishable key.",
    );
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" &&
    !["localhost", "127.0.0.1"].includes(parsed.hostname)
  )
    throw new Error("Supabase requires HTTPS.");
  // Only a publishable / legacy anon key belongs in the client bundle.
  client = createClient(url, key, {
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)])
            : AbortSignal.timeout(15000),
        }),
    },
  });
  return client;
}
