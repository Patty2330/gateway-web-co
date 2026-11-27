import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = path.join(process.cwd(), ".github/workflows/monthly-monitor.yml");

function parseWorkflow(source: string): Record<string, unknown> {
  const result = spawnSync(
    "python3",
    ["-c", "import sys, yaml, json; json.dump(yaml.safe_load(sys.stdin), sys.stdout)"],
    { input: source, encoding: "utf8" },
  );
  expect(result.status, result.stderr).toBe(0);
  expect(result.stdout.length).toBeGreaterThan(0);
  const parsed = JSON.parse(result.stdout) as unknown;
  expect(parsed && typeof parsed === "object").toBe(true);
  return parsed as Record<string, unknown>;
}

describe("monthly monitor workflow", () => {
  const source = readFileSync(WORKFLOW_PATH, "utf8");
  const workflow = parseWorkflow(source);

  it("parses cleanly and uses the expected name, schedule, and manual trigger", () => {
    expect(workflow.name).toBe("Monthly AI Visibility Monitor");
    const triggers = workflow.on as Record<string, unknown>;
    expect(triggers).toBeTruthy();
    expect(triggers).not.toBe(true);
    const schedule = triggers.schedule as Array<{ cron: string }>;
    expect(schedule).toEqual([{ cron: "0 14 1 * *" }]);
    expect(Object.prototype.hasOwnProperty.call(triggers, "workflow_dispatch")).toBe(true);
  });

  it("uses least-privilege permissions, a 10-minute timeout, and a concurrency guard", () => {
    expect(workflow.permissions).toEqual({});
    const jobs = workflow.jobs as Record<string, { "timeout-minutes"?: number }>;
    const job = jobs.monitor ?? Object.values(jobs)[0];
    expect(job).toBeTruthy();
    expect(job["timeout-minutes"]).toBe(10);
    const concurrency = workflow.concurrency as { group?: string; "cancel-in-progress"?: boolean };
    expect(concurrency.group).toBeTruthy();
    expect(concurrency["cancel-in-progress"]).toBe(false);
  });

  it("defaults APP_URL to https://twoforksstudio.com and passes secrets through env", () => {
    expect(source).toContain("https://twoforksstudio.com");
    expect(source).toMatch(/vars\.APP_URL\s*\|\|\s*'https:\/\/twoforksstudio.com'/);
    expect(source).toContain("secrets.CRON_SECRET");
    expect(source).toMatch(/Authorization: Bearer \$\{CRON_SECRET\}/);
    expect(source).toMatch(/-X POST/);
    expect(source).toMatch(/--max-time 180/);
    expect(source).toContain("/api/cron/monitor");

    const envBlocks = [...source.matchAll(/^\s+env:\n((?:\s{2,}.+\n)+)/gm)].map((match) => match[1]);
    expect(envBlocks.some((block) => block.includes("secrets.CRON_SECRET"))).toBe(true);
    expect(envBlocks.some((block) => block.includes("vars.APP_URL"))).toBe(true);

    const runBlocks = [...source.matchAll(/^\s+run:\s*\|[^\n]*\n((?:\s{2,}.+\n)+)/gm)].map(
      (match) => match[1],
    );
    expect(runBlocks.length).toBeGreaterThan(0);
    for (const block of runBlocks) {
      expect(block).not.toMatch(/\$\{\{\s*secrets\./);
      expect(block).not.toMatch(/\$\{\{\s*vars\./);
    }
  });

  it("fails clearly when CRON_SECRET is missing or the response is not 2xx, without hardcoding secrets", () => {
    expect(source).toMatch(/\[ -z "\$\{CRON_SECRET\}" \]/);
    expect(source).toMatch(/exit 1/);
    expect(source).toMatch(/HTTP status/);
    expect(source).toMatch(/2\[0-9\]\[0-9\]|non-2xx|--fail-with-body/);
    expect(source).toMatch(/Monitor request failed with HTTP/);
    expect(source).not.toMatch(/set -x\b/);
    expect(source).not.toMatch(/echo\s+"?\$\{?CRON_SECRET/);
    expect(source).not.toMatch(/Bearer\s+(?!\$\{CRON_SECRET\})[A-Za-z0-9_\-.]{8,}/);
    expect(source).not.toMatch(/(ghp|sk_live|sk_test|whsec)_[A-Za-z0-9]+/);
    expect(source).not.toMatch(/CRON_SECRET\s*:\s*['\"][^$\s{]/);
  });
});
