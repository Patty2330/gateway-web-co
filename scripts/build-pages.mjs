import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const hideRoot = path.join(root, ".pages-build-hide");
const moves = [
  [path.join(root, "src/app/api"), path.join(hideRoot, "api")],
  [path.join(root, "src/app/(check)/scans/[id]"), path.join(hideRoot, "scan-id")],
  // These tests import API route modules that are hidden for the static export.
  [path.join(root, "tests/checkout-route.test.ts"), path.join(hideRoot, "checkout-route.test.ts")],
  [path.join(root, "tests/scans-route.test.ts"), path.join(hideRoot, "scans-route.test.ts")],
  [path.join(root, "tests/leads-route.test.ts"), path.join(hideRoot, "leads-route.test.ts")],
  [path.join(root, "tests/cron.test.ts"), path.join(hideRoot, "cron.test.ts")],
];

function hide() {
  fs.mkdirSync(hideRoot, { recursive: true });
  for (const [from, to] of moves) {
    if (!fs.existsSync(from)) continue;
    fs.renameSync(from, to);
  }
}

function restore() {
  for (const [from, to] of moves) {
    if (!fs.existsSync(to)) continue;
    fs.mkdirSync(path.dirname(from), { recursive: true });
    fs.renameSync(to, from);
  }
  fs.rmSync(hideRoot, { recursive: true, force: true });
}

hide();
let status = 1;
try {
  const result = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: {
      ...process.env,
      PAGES_EXPORT: "1",
      NEXT_PUBLIC_PAGES_DEMO: "1",
      NEXT_PUBLIC_BASE_PATH: "/gateway-web-co",
    },
  });
  status = result.status ?? 1;
} finally {
  restore();
}

process.exit(status);
