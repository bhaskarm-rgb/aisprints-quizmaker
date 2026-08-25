import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
	// Pin the workspace root so a stray lockfile elsewhere on the machine cannot
	// make Turbopack infer the wrong project directory.
	turbopack: {
		root: __dirname,
	},
};

export default nextConfig;

// Enable calling `getCloudflareContext()` in `next dev` only.
// See https://opennext.js.org/cloudflare/bindings#local-access-to-bindings.
if (process.argv.includes("dev")) {
	initOpenNextCloudflareForDev();
}
