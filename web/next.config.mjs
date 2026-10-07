/** @type {import('next').NextConfig} */
const nextConfig = {
  // packages/shared is plain ESM sitting outside web/ (an npm workspace); compile it with the app.
  transpilePackages: ["@aruvi/shared"],
  // ★ STATIC EXPORT (2026-10-07, docs/going_live.md §1). The web app has no server-side
  // features — it is a client app talking to the Render API over REST, like the phone — so
  // `next build` writes a plain web/out/ folder that Cloudflare Pages serves at app.meyy.in.
  // ⚠️ next.config.build-check.mjs must carry the same `output` (they must not drift).
  output: "export",
};
export default nextConfig;
