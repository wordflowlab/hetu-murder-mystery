import assert from "node:assert/strict";
import { depthFields } from "../../src/domain/depth-config.ts";
import { depthScenario } from "./depth-scenario.ts";
import { base, selection } from "./scenario.ts";
const error = (r: any) => r.data?.result?.error?.code ?? r.error?.code;
export async function depthExercise(
  c: any,
  r: any,
  key: () => string,
  artifact: any,
) {
  const legacy = structuredClone(r.object.content.sessions);
  r = await c.invoke("enable_depth", base(r, key()));
  assert.deepEqual(r.object.content.sessions, legacy);
  const desired = depthScenario();
  r = await c.invoke("save_project", {
    ...base(r, key()),
    content: {
      ...r.object.content,
      clues: desired.clues,
      depth: desired.depth,
    },
  });
  for (const [item, field] of Object.entries(depthFields))
    for (const row of r.object.content.depth[field])
      r = await c.invoke("put_" + item, { ...base(r, key()), [item]: row });
  let s = selection(r);
  const b = r.object.content.depth.briefings[0];
  await c.invoke("briefing_basis", {
    ...s,
    role_id: b.role_id,
    act_id: b.act_id,
    known_fact_ids: b.known_fact_ids,
  });
  await c.invoke("deduction_basis", {
    ...s,
    deduction: r.object.content.depth.deductions[0],
  });
  await c.invoke("depth_target_digest", {
    ...s,
    target_kind: "briefing",
    target_id: b.id,
  });
  assert.equal((await c.invoke("check_depth", s)).missing_briefings.length, 0);
  assert.equal(
    (
      await c.invoke("deduction_view", {
        ...s,
        deduction_id: "sender",
        clue_ids: ["seal", "letter", "register"],
      })
    ).available,
    true,
  );
  const player = await artifact("export_depth_player", r, {
    role_id: "lin",
    act_id: "arrival",
  });
  assert.ok(player.toString().includes("你叫林溪"));
  assert.ok(!player.toString().includes("守站人私密"));
  assert.ok(!player.toString().includes("第二幕秘密"));
  assert.ok(!player.toString().includes("主持专有"));
  await artifact("export_depth_gm", r);
  r = await c.invoke("start_test", {
    ...base(r, key()),
    test_id: "mechanism",
    label: "完整固定版本机制测本",
    mode: "agent_simulated",
    assignments: r.object.content.roles.map((x: any) => ({
      role_id: x.id,
      participant: x.name + "模拟",
    })),
  });
  const step = async (action: string, args: any = {}) => {
    r = await c.invoke(action, {
      ...base(r, key()),
      test_id: "mechanism",
      ...args,
    });
  };
  await step("search_test_clue", { role_id: "lin", clue_id: "seal" });
  await step("search_test_clue", { role_id: "lin", clue_id: "letter" });
  const before = r.sha256;
  assert.ok(
    error(
      await c.raw("search_test_clue", {
        ...base(r, key()),
        test_id: "mechanism",
        role_id: "keeper",
        clue_id: "register",
      }),
    ),
  );
  assert.equal(
    (await c.invoke("get_project", { object_id: r.object.object_id })).sha256,
    before,
  );
  await step("advance_test_round");
  await step("share_test_clue", {
    role_id: "lin",
    target_role_id: "keeper",
    clue_id: "letter",
  });
  await step("advance_test_round");
  await step("search_test_clue", { role_id: "keeper", clue_id: "register" });
  await step("advance_test_round");
  await step("vote_test", { role_id: "lin", option: "守站人" });
  await step("vote_test", { role_id: "keeper", option: "林溪" });
  assert.equal(
    (await c.invoke("test_view", { ...selection(r), test_id: "mechanism" }))
      .matching_endings.length,
    0,
  );
  const projection = await c.invoke("test_player_view", {
    ...selection(r),
    test_id: "mechanism",
    role_id: "lin",
  });
  assert.equal(projection.own_votes.length, 1);
  assert.ok(!JSON.stringify(projection).includes("第二幕秘密"));
  await step("advance_test_round");
  await step("reveal_test_clue", { clue_id: "farewell" });
  await step("advance_test_round");
  await step("close_test", {
    text: "完整模拟复盘：分清已知线索和推测，平票不代替案情，真人体验另验。",
  });
  assert.equal(
    (await c.invoke("test_view", { ...selection(r), test_id: "mechanism" }))
      .closed,
    true,
  );
  await artifact("export_test_player", r, {
    test_id: "mechanism",
    role_id: "lin",
  });
  r = await c.invoke("start_test", {
    ...base(r, key()),
    test_id: "skipped",
    label: "明确跳过反例",
    mode: "agent_simulated",
    assignments: r.object.content.roles.map((x: any) => ({
      role_id: x.id,
      participant: x.name + "模拟",
    })),
  });
  r = await c.invoke("skip_test_round", {
    ...base(r, key()),
    test_id: "skipped",
    reason: "本轮专门保留缺少线索的卡点，不冒充条件通过。",
  });
  assert.equal(
    (await c.invoke("test_view", { ...selection(r), test_id: "skipped" }))
      .skipped.length,
    1,
  );
  const current = r.object.content.depth.facts.find((f: any) => f.id === "key");
  r = await c.invoke("put_fact", {
    ...base(r, key()),
    fact: { ...current, text: current.text + " 复盘后补充明确发生先后。" },
  });
  assert.ok(
    (await c.invoke("check_depth", selection(r))).stale_briefing_ids.includes(
      "lin-arrival",
    ),
  );
  const briefing = r.object.content.depth.briefings.find(
      (b: any) => b.id === "lin-arrival",
    ),
    basis = await c.invoke("briefing_basis", {
      ...selection(r),
      role_id: briefing.role_id,
      act_id: briefing.act_id,
      known_fact_ids: briefing.known_fact_ids,
    });
  r = await c.invoke("put_briefing", {
    ...base(r, key()),
    briefing: { ...briefing, basis_sha256: basis.basis_sha256 },
  });
  assert.deepEqual(r.object.content.sessions, legacy);
  assert.equal(
    (await c.invoke("test_view", { ...selection(r), test_id: "mechanism" }))
      .closed,
    true,
  );
  const scratch = structuredClone(r.object.content);
  scratch.sessions = [];
  scratch.depth.test_runs = [];
  let remove = await c.invoke("save_project", {
    content: { ...scratch, title: "独立深度移除用例" },
    source_refs: r.object.source_refs,
    expected_revision: 0,
    expected_sha256: "",
    operation_key: key(),
  });
  for (const [item, field] of Object.entries(depthFields).reverse())
    for (const row of [...remove.object.content.depth[field]].reverse())
      remove = await c.invoke("remove_" + item, {
        ...base(remove, key()),
        [item + "_id"]: row.id,
      });
  return r;
}
