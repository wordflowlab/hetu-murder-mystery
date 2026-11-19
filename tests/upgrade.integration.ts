import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { start } from "./support/machine.ts";
import { fixedScript } from "./support/fixed-script.ts";
import {
  scenario,
  original,
  base,
  selection,
  sha,
} from "./support/scenario.ts";
const publicArchive =
    "https://github.com/wordflowlab/hetu-murder-mystery/releases/download/v0.1.0/org.wordflowlab.murder-mystery-0.1.0.tgz",
  archiveSHA =
    "1761a0cb369695f48bf5f9eafc166eedf60a47c2b401eff58a343281a376aaa4",
  packageSHA =
    "c2bf8995da6ddb2cbead5e4962bb9d9130ee6e8d387df5bdca39015374bfed24";
test(
  "公开v0.1.0建立旧工程与真实旧试玩，原地升级v0.2.0保持修订原键及快照",
  { timeout: 600000 },
  async () => {
    const c = await start("novel");
    try {
      const source = await fixedScript(c, original, "old-package-source"),
        download = path.join(c.directory, "old-public-package");
      await mkdir(download);
      const archive = path.join(download, "v010.tgz"),
        unpacked = path.join(download, "bundle");
      await mkdir(unpacked);
      const fetch = spawnSync(
        "curl",
        [
          "--silent",
          "--show-error",
          "--location",
          "--max-time",
          "120",
          "--output",
          archive,
          publicArchive,
        ],
        { encoding: "utf8", timeout: 130000 },
      );
      assert.equal(fetch.status, 0, fetch.stderr);
      assert.equal(sha(await readFile(archive)), archiveSHA);
      const unpack = spawnSync("tar", ["-xzf", archive, "-C", unpacked], {
        encoding: "utf8",
      });
      assert.equal(unpack.status, 0, unpack.stderr);
      const pkg = await c.ok("hetu_plugins_inspect_package", {
        package_directory: unpacked,
      });
      assert.equal(pkg.package_sha256, packageSHA);
      assert.equal(pkg.manifest.version, "0.1.0");
      await c.ok("hetu_plugins_apply", {
        action: "install",
        plugin_id: pkg.manifest.id,
        package_directory: unpacked,
        package_sha256: packageSHA,
        expected_sha256: (await c.ok("hetu_plugins_inspect")).state_sha256,
        authorization_note:
          "隔离验收：使用不可变公开v0.1.0建立旧工程后原地升级",
        operation_key: "install-public-v010",
      });
      const binding = { ...c.binding, package_sha256: packageSHA },
        cap = await c.ok("hetu_plugins_capabilities", binding);
      const old = async (action: string, args: any) => {
        const r = await c.ok("hetu_plugins_invoke", {
          ...binding,
          capabilities_sha256: cap.capabilities_sha256,
          action,
          arguments: args,
        });
        assert.equal(r.result.status, "succeeded", JSON.stringify(r));
        return r.result.data;
      };
      const first = await old("save_project", {
        content: scenario(),
        source_refs: [source.source_ref],
        expected_revision: 0,
        expected_sha256: "",
        operation_key: "real-v010-create",
      });
      let r = await old("start_session", {
        ...base(first, "real-v010-start"),
        session_id: "old",
        label: "公开v0.1.0真实建立的旧试玩",
        mode: "agent_simulated",
        assignments: first.object.content.roles.map((x: any) => ({
          role_id: x.id,
          participant: x.name + "模拟",
        })),
      });
      r = await old("release_clue", {
        ...base(r, "real-v010-release"),
        session_id: "old",
        clue_id: "seal",
      });
      const before = JSON.stringify(r.object.content.sessions),
        state = await old("session_view", {
          ...selection(r),
          session_id: "old",
        });
      await c.apply("install");
      await c.discover();
      const read = await c.invoke("get_project", selection(r));
      assert.equal(read.sha256, r.sha256);
      assert.equal(read.object.content.depth, undefined);
      assert.equal(
        (await c.invoke("get_operation", { operation_key: "real-v010-create" }))
          .sha256,
        first.sha256,
      );
      const upgraded = await c.invoke(
        "enable_depth",
        base(r, "real-v020-enable"),
      );
      assert.equal(JSON.stringify(upgraded.object.content.sessions), before);
      assert.deepEqual(
        await c.invoke("session_view", {
          ...selection(upgraded),
          session_id: "old",
        }),
        state,
      );
      assert.equal(
        (await c.invoke("get_project", selection(first))).sha256,
        first.sha256,
      );
      const out = process.env.HETU_RECEIPT_DIRECTORY ?? "output";
      await mkdir(out, { recursive: true });
      await writeFile(
        path.join(out, "upgrade-acceptance.json"),
        JSON.stringify(
          {
            recorded_at: new Date().toISOString(),
            old_release: publicArchive,
            old_archive_sha256: archiveSHA,
            old_package_sha256: packageSHA,
            new_package_sha256: c.pkg.package_sha256,
            host_version: c.coreVersion,
            public_old_package_created_project: true,
            old_session_created_by_public_v010: true,
            read_did_not_migrate: true,
            original_operation_preserved: true,
            old_revision_preserved: true,
            old_snapshot_and_replay_preserved: true,
            upgraded_revision: upgraded.object.revision,
          },
          null,
          2,
        ) + "\n",
      );
    } finally {
      await c.client.close();
    }
  },
);
