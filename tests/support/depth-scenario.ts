import { scenario } from "./scenario.ts";
import { emptyDepth } from "../../src/domain/depth-config.ts";
import * as D from "../../src/domain/depth.ts";
const zeros = "0".repeat(64);
export function legacyScenario() {
  const p = scenario();
  p.sessions = [
    {
      id: "legacy",
      label: "v0.1.0 固定旧试玩",
      mode: "agent_simulated",
      author_ref: {
        owner_plugin_id: "org.wordflowlab.murder-mystery",
        object_id: "ext_legacy",
        revision: 1,
        sha256: zeros,
      },
      snapshot: Object.fromEntries(
        ["premise", "gm_notes", "solution", "roles", "acts", "clues"].map(
          (k) => [k, structuredClone(p[k])],
        ),
      ),
      assignments: p.roles.map((r: any) => ({
        role_id: r.id,
        participant: r.name + "旧模拟",
      })),
      events: [],
    },
  ];
  return p;
}
export function depthScenario() {
  const p = scenario();
  p.depth = emptyDepth();
  const d = p.depth;
  p.clues.push({
    id: "farewell",
    title: "站台留言",
    text: "末幕公开：两个人都选择把站门留给来人。",
    act_id: "departure",
    audience: "public",
    role_ids: [],
    required: true,
  });
  d.facts = [
    {
      id: "sent",
      title: "来信先于抵达",
      text: "管理员在旅人抵达前给旧站寄了信。",
      order: 1,
      time_label: "抵达前一日",
      role_ids: ["keeper"],
      clue_ids: ["seal"],
      qualification: "作者声明的虚构案情，不是现实事实。",
    },
    {
      id: "key",
      title: "钥匙留在门后",
      text: "林溪以前来过旧站，但此次没有寄出这封信。",
      order: 2,
      time_label: "抵达前",
      role_ids: ["lin"],
      clue_ids: ["letter"],
      qualification: "",
    },
    {
      id: "signature",
      title: "名册中的签名",
      text: "守站人保留的名册中，有管理员本人留下的签名。",
      order: 3,
      time_label: "第二幕开门后",
      role_ids: ["keeper"],
      clue_ids: ["register"],
      qualification: "此项在第二幕核对。",
    },
  ];
  const bodies: any = {
    lin: {
      arrival:
        "你叫林溪，带着一封始终没有寄出的旧信回到雨港。你记得从前有人把钥匙放在站门后，却不确定今天等在门内的人是否还认得你。众人问起信件时，你只说自己来取回一个答案。请先听守站人的自述，再说明你何时抵达；不要替自己补写未曾看到的名册。",
      departure:
        "站门打开后，你终于能把旧信放在桌上。你知道钥匙放在哪里，却还需要从已经拿到的线索确认来信的先后。你可以解释自己的行动，也可以承认那封没有寄出的信与本案来信不同。最后请根据实际获得的材料投票，不把旁人的沉默当成证明。",
    },
    keeper: {
      arrival:
        "你是旧站的守站人，负责保存邮局留下的记录。林溪的归来让你想起多年没有拆开的抽屉，但第一幕你还没有把其中的名册交给任何人。你可以讲自己看到的雨夜和门口的邮戳，也可以询问来客；不能因为你是守站人，就声称看过尚未公开的签名。",
      departure:
        "你打开抽屉取出名册，决定是否把其中的记录交给林溪。名册能说明谁留下签名，但它不能替别人解释动机。你要把实际获得的材料和自己的猜测分开，完成讨论与投票。等站台留言公开以后，再回顾此前哪一个推断缺少依据。",
    },
  };
  for (const role of p.roles)
    for (const act of p.acts) {
      const facts =
        role.id === "lin"
          ? ["key"]
          : act.id === "arrival"
            ? ["sent"]
            : ["sent", "signature"];
      d.briefings.push({
        id: role.id + "-" + act.id,
        role_id: role.id,
        act_id: act.id,
        title: role.name + " " + act.title,
        body: bodies[role.id][act.id],
        goals: ["保留本人知情范围", "依据实际收到的材料判断"],
        known_fact_ids: facts,
        basis_sha256: D.briefingBasis(p, role.id, act.id, facts),
      });
    }
  d.deductions = [
    {
      id: "early",
      title: "信件先后",
      conclusion: "来信比林溪抵达更早寄出。",
      act_id: "arrival",
      clue_ids: ["seal"],
      premise_ids: [],
      reasoning: "邮戳记载的先后支持这一有限结论，不自动证明寄信人的身份。",
      basis_sha256: zeros,
    },
  ];
  d.deductions[0].basis_sha256 = D.deductionBasis(p, d.deductions[0]);
  d.deductions.push({
    id: "sender",
    title: "寄信人与旧站",
    conclusion: "名册签名使管理员成为需要进一步核对的寄信人。",
    act_id: "departure",
    clue_ids: ["letter", "register"],
    premise_ids: ["early"],
    reasoning:
      "先核对寄送时间，再区分未寄旧信和本案来信，最后对照名册；保留解释边界。",
    basis_sha256: zeros,
  });
  d.deductions[1].basis_sha256 = D.deductionBasis(p, d.deductions[1]);
  d.clue_rules = p.clues.map((c: any) => ({
    id: "rule-" + c.id,
    clue_id: c.id,
    searchable: c.id !== "farewell",
    shareable: c.id === "letter" || c.id === "register",
    cost: 1,
  }));
  d.rounds = [
    {
      id: "search-one",
      act_id: "arrival",
      title: "第一轮搜证",
      order: 1,
      kind: "search",
      budget: 2,
      required_clue_ids: ["seal", "letter"],
      options: [],
      all_roles_vote: false,
    },
    {
      id: "exchange",
      act_id: "arrival",
      title: "线索交换",
      order: 2,
      kind: "exchange",
      budget: 0,
      required_clue_ids: [],
      options: [],
      all_roles_vote: false,
    },
    {
      id: "search-two",
      act_id: "departure",
      title: "开门后的搜证",
      order: 1,
      kind: "search",
      budget: 1,
      required_clue_ids: ["register"],
      options: [],
      all_roles_vote: false,
    },
    {
      id: "vote",
      act_id: "departure",
      title: "证据与投票",
      order: 2,
      kind: "vote",
      budget: 0,
      required_clue_ids: ["seal", "letter", "register"],
      options: ["林溪", "守站人"],
      all_roles_vote: true,
    },
    {
      id: "reveal",
      act_id: "departure",
      title: "末幕留言",
      order: 3,
      kind: "reveal",
      budget: 0,
      required_clue_ids: ["farewell"],
      options: [],
      all_roles_vote: false,
    },
  ];
  d.endings = [
    {
      id: "lin-ending",
      title: "林溪获多数票",
      body: "这是本轮投票的分支记录，不证明真实案情。",
      round_id: "vote",
      option: "林溪",
      min_votes: 2,
    },
    {
      id: "keeper-ending",
      title: "守站人获多数票",
      body: "继续对照主持解答复盘证据，投票本身不是事实认证。",
      round_id: "vote",
      option: "守站人",
      min_votes: 2,
    },
  ];
  d.reviews = [
    {
      id: "review",
      target_kind: "briefing",
      target_id: "lin-arrival",
      target_sha256: D.targetDigest(p, "briefing", "lin-arrival"),
      origin: "agent",
      comment: "核对林溪第一幕是否仅使用本人已知资料。",
      status: "open",
      resolution: "",
      category: "leakage",
    },
  ];
  return p;
}
export function startRun(p: any, id = "test") {
  D.writeDepth("start_test", p, {
    test_id: id,
    label: "固定版本模拟测本",
    mode: "agent_simulated",
    object_id: "ext_test",
    expected_revision: 1,
    expected_sha256: zeros,
    assignments: p.roles.map((r: any) => ({
      role_id: r.id,
      participant: r.name + "模拟",
    })),
  });
  return p.depth.test_runs.at(-1);
}
export function append(p: any, action: string, args: any = {}) {
  D.writeDepth(action, p, { test_id: "test", ...args });
  return D.testState(p.depth.test_runs[0]);
}
export function throughSearch(p: any) {
  startRun(p);
  append(p, "search_test_clue", { role_id: "lin", clue_id: "seal" });
  append(p, "search_test_clue", { role_id: "lin", clue_id: "letter" });
  append(p, "advance_test_round");
  return p;
}
export function throughVote(p: any, tie = false) {
  throughSearch(p);
  append(p, "share_test_clue", {
    role_id: "lin",
    target_role_id: "keeper",
    clue_id: "letter",
  });
  append(p, "advance_test_round");
  append(p, "search_test_clue", { role_id: "keeper", clue_id: "register" });
  append(p, "advance_test_round");
  append(p, "vote_test", { role_id: "lin", option: "守站人" });
  append(p, "vote_test", {
    role_id: "keeper",
    option: tie ? "林溪" : "守站人",
  });
  return p;
}
export function complete(p: any, tie = false) {
  throughVote(p, tie);
  append(p, "advance_test_round");
  append(p, "reveal_test_clue", { clue_id: "farewell" });
  append(p, "advance_test_round");
  append(p, "close_test", {
    text: "模拟复盘：保留线索先后与角色知情范围，未进行真人测本。",
  });
  return p;
}
