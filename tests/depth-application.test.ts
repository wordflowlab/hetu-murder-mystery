import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryCore } from "./support/memory-core.ts";
import { depthScenario, legacyScenario } from "./support/depth-scenario.ts";
import { base, selection, sourceRef, original } from "./support/scenario.ts";
import { canonical } from "../src/domain/model.ts";
function client() {
  const c = memoryCore();
  c.sources.set(canonical(sourceRef), {
    source_ref: sourceRef,
    content: original,
  });
  return c;
}
const ok = (r: any) => {
  assert.equal(r.status, "succeeded", JSON.stringify(r));
  return r.data;
};
async function seed(c: any, p = depthScenario()) {
  const sessions = p.sessions;
  let r = ok(
    await c.invoke("save_project", {
      content: { ...p, sessions: [] },
      source_refs: [sourceRef],
      expected_revision: 0,
      expected_sha256: "",
      operation_key: "seed",
    }),
  );
  for (const old of sessions)
    r = ok(
      await c.invoke("start_session", {
        ...base(r, "legacy-" + old.id),
        session_id: old.id,
        label: old.label,
        mode: old.mode,
        assignments: old.assignments,
      }),
    );
  return r;
}
async function begin(c: any, r: any) {
  return ok(
    await c.invoke("start_test", {
      ...base(r, "start"),
      test_id: "test",
      label: "应用层模拟",
      mode: "agent_simulated",
      assignments: r.object.content.roles.map((x: any) => ({
        role_id: x.id,
        participant: x.name + "模拟",
      })),
    }),
  );
}
test("实际应用明确升级旧工程且历史不变", async () => {
  const c = client(),
    a = await seed(c, legacyScenario()),
    before = canonical(a.object.content.sessions),
    b = ok(await c.invoke("enable_depth", base(a, "upgrade")));
  assert.equal(canonical(b.object.content.sessions), before);
  assert.equal(
    ok(await c.invoke("get_project", selection(a))).sha256,
    a.sha256,
  );
});
test("实际应用预算失败不写入且同键回读不重复扣费", async () => {
  const c = client(),
    p = depthScenario();
  p.depth.rounds[0].budget = 1;
  let r = await begin(c, await seed(c, p));
  const request = {
    ...base(r, "search"),
    test_id: "test",
    role_id: "lin",
    clue_id: "seal",
  };
  r = ok(await c.invoke("search_test_clue", request));
  assert.equal(
    ok(await c.invoke("search_test_clue", request)).sha256,
    r.sha256,
  );
  const writes = c.writes,
    bad = await c.invoke("search_test_clue", {
      ...base(r, "insufficient"),
      test_id: "test",
      role_id: "lin",
      clue_id: "letter",
    });
  assert.equal(bad.status, "failed");
  assert.equal(c.writes, writes);
  assert.equal(
    ok(await c.invoke("get_project", { object_id: r.object.object_id })).sha256,
    r.sha256,
  );
});
test("实际应用深度正文修改遵循CAS并保留其他角色", async () => {
  const c = client(),
    a = await seed(c),
    b = a.object.content.depth.briefings[0],
    input = {
      ...base(a, "brief"),
      briefing: { ...b, body: b.body + "\n补充本人行动。" },
    };
  const r = ok(await c.invoke("put_briefing", input));
  assert.deepEqual(
    r.object.content.depth.briefings.slice(1),
    a.object.content.depth.briefings.slice(1),
  );
  assert.equal(
    (await c.invoke("put_briefing", { ...input, operation_key: "stale" })).error
      ?.code,
    "revision_conflict",
  );
});
test("实际应用整本保存不能伪造测本事件", async () => {
  const c = client(),
    a = await begin(c, await seed(c)),
    content = structuredClone(a.object.content);
  content.depth.test_runs[0].events.push({
    sequence: 1,
    kind: "skip",
    round_id: "search-one",
    role_id: null,
    target_role_id: null,
    clue_id: null,
    option: null,
    text: "伪造追加",
  });
  const writes = c.writes,
    r = await c.invoke("save_project", { ...base(a, "forge"), content });
  assert.equal(r.status, "failed");
  assert.equal(c.writes, writes);
});
test("深度动作同键异参拒绝", async () => {
  const c = client(),
    a = await seed(c),
    n = a.object.content.depth.facts[0],
    request = { ...base(a, "same"), fact: n };
  ok(await c.invoke("put_fact", request));
  assert.equal(
    (
      await c.invoke("put_fact", {
        ...request,
        fact: { ...n, text: "同键换内容" },
      })
    ).error?.code,
    "idempotency_conflict",
  );
});
