import { canonical, requireValue as need } from "../../vendor/project-store.ts";
import { digest, find, unique } from "./shared.ts";
import { emptyDepth } from "./depth-config.ts";
export const enabled = (p: any) => {
  need(p.depth?.version === 1, "请先明确启用完整创作结构。");
  return p.depth;
};
const actOrder = (p: any, id: string) => find(p.acts, id).order;
export function briefingBasis(
  p: any,
  roleID: string,
  actID: string,
  factIDs: string[],
) {
  const d = enabled(p);
  return digest({
    role: find(p.roles, roleID),
    act: find(p.acts, actID),
    facts: factIDs.map((id) => find(d.facts, id)),
  });
}
export function deductionBasis(
  p: any,
  node: any,
  visiting = new Set<string>(),
): string {
  const d = enabled(p);
  need(!visiting.has(node.id), "证据推导成环。");
  const path = new Set(visiting);
  path.add(node.id);
  const { basis_sha256, ...content } = node;
  return digest({
    content,
    act: find(p.acts, node.act_id),
    clues: node.clue_ids.map((id: string) => find(p.clues, id)),
    premises: node.premise_ids.map((id: string) => {
      const x = find(d.deductions, id);
      return { node: x, current_basis: deductionBasis(p, x, path) };
    }),
  });
}
export function targetDigest(p: any, k: string, id: string) {
  const d = enabled(p);
  if (k === "briefing") {
    const b = find(d.briefings, id);
    return digest({
      briefing: b,
      current_basis: briefingBasis(p, b.role_id, b.act_id, b.known_fact_ids),
    });
  }
  if (k === "deduction") {
    const x = find(d.deductions, id);
    return digest({ deduction: x, current_basis: deductionBasis(p, x) });
  }
  need(k === "round", "未知深度意见目标。");
  const round = find(d.rounds, id);
  return digest({
    round,
    clues: round.required_clue_ids.map((id: string) => find(p.clues, id)),
    roles: p.roles,
    clue_rules: d.clue_rules,
  });
}
export function deductionView(p: any, id: string, clueIDs: string[]) {
  const d = enabled(p);
  unique(clueIDs, "可见线索重复。");
  clueIDs.forEach((x) => find(p.clues, x));
  const known = new Set(clueIDs),
    cache = new Map<string, any>();
  function visit(id: string): any {
    if (cache.has(id)) return cache.get(id);
    const node = find(d.deductions, id),
      premises = node.premise_ids.map(visit),
      missing = node.clue_ids.filter((x: string) => !known.has(x)),
      stale = node.basis_sha256 !== deductionBasis(p, node);
    const out = {
      id: node.id,
      title: node.title,
      conclusion: node.conclusion,
      reasoning: node.reasoning,
      missing_clue_ids: missing,
      premises,
      stale,
      available:
        !stale &&
        missing.length === 0 &&
        premises.every((x: any) => x.available),
    };
    cache.set(id, out);
    return out;
  }
  return {
    ...visit(id),
    note: "仅核验作者声明的证据与前提，不证明推理公平或结论真实。",
  };
}
export function authorSnapshot(p: any) {
  const d = enabled(p),
    { test_runs, ...depth } = d;
  return {
    premise: p.premise,
    gm_notes: p.gm_notes,
    solution: p.solution,
    roles: structuredClone(p.roles),
    acts: structuredClone(p.acts),
    clues: structuredClone(p.clues),
    depth: structuredClone(depth),
  };
}
export function validateSpec(p: any) {
  const d = enabled(p);
  for (const k of [
    "facts",
    "briefings",
    "deductions",
    "clue_rules",
    "rounds",
    "endings",
    "reviews",
  ])
    unique(
      d[k].map((x: any) => x.id),
      k + "身份重复。",
    );
  for (const f of d.facts) {
    unique(f.role_ids, "案件人物重复。");
    unique(f.clue_ids, "案件支持线索重复。");
    f.role_ids.forEach((id: string) => find(p.roles, id));
    f.clue_ids.forEach((id: string) => find(p.clues, id));
  }
  unique(
    d.briefings.map((b: any) => canonical([b.role_id, b.act_id])),
    "同角色同幕正文重复。",
  );
  for (const b of d.briefings) {
    find(p.roles, b.role_id);
    find(p.acts, b.act_id);
    unique(b.known_fact_ids, "知情事实重复。");
    b.known_fact_ids.forEach((id: string) => find(d.facts, id));
  }
  for (const x of d.deductions) {
    find(p.acts, x.act_id);
    unique(x.clue_ids, "推导线索重复。");
    unique(x.premise_ids, "推导前提重复。");
    x.clue_ids.forEach((id: string) => {
      const c = find(p.clues, id);
      need(
        actOrder(p, c.act_id) <= actOrder(p, x.act_id),
        "推导不能在所需线索开放前完成。",
      );
    });
    x.premise_ids.forEach((id: string) => {
      const prev = find(d.deductions, id);
      need(
        actOrder(p, prev.act_id) <= actOrder(p, x.act_id),
        "前置推导不能来自未来幕次。",
      );
    });
    deductionBasis(p, x);
  }
  unique(
    d.clue_rules.map((x: any) => x.clue_id),
    "同线索机制规则重复。",
  );
  d.clue_rules.forEach((r: any) => find(p.clues, r.clue_id));
  unique(
    d.rounds.map((r: any) => canonical([r.act_id, r.order])),
    "同幕机制轮次顺序重复。",
  );
  for (const r of d.rounds) {
    find(p.acts, r.act_id);
    unique(r.required_clue_ids, "轮次必备线索重复。");
    r.required_clue_ids.forEach((id: string) =>
      need(
        actOrder(p, find(p.clues, id).act_id) <= actOrder(p, r.act_id),
        "轮次要求未来线索。",
      ),
    );
    unique(r.options, "投票选项重复。");
    need(
      r.kind === "vote"
        ? r.options.length >= 2
        : r.options.length === 0 && !r.all_roles_vote,
      "只有投票轮次可有选项和全员投票条件。",
    );
    need(r.kind === "search" || r.budget === 0, "只有搜证轮次使用预算。");
  }
  for (const e of d.endings) {
    const r = find(d.rounds, e.round_id);
    need(
      r.kind === "vote" && r.options.includes(e.option),
      "结局须引用明确投票轮次及选项。",
    );
    need(e.min_votes <= p.roles.length, "结局最少票数不能超过角色数。");
  }
  for (const n of d.reviews) {
    targetDigest(p, n.target_kind, n.target_id);
    need(n.status !== "resolved" || n.resolution.trim(), "处理意见须有说明。");
  }
}
export function checkDepth(p: any) {
  const d = enabled(p);
  return {
    missing_briefings: p.roles.flatMap((r: any) =>
      p.acts
        .filter(
          (a: any) =>
            !d.briefings.some(
              (b: any) => b.role_id === r.id && b.act_id === a.id,
            ),
        )
        .map((a: any) => ({ role_id: r.id, act_id: a.id })),
    ),
    missing_clue_rules: p.clues
      .filter((c: any) => !d.clue_rules.some((r: any) => r.clue_id === c.id))
      .map((c: any) => c.id),
    stale_briefing_ids: d.briefings
      .filter(
        (b: any) =>
          b.basis_sha256 !==
          briefingBasis(p, b.role_id, b.act_id, b.known_fact_ids),
      )
      .map((b: any) => b.id),
    stale_deduction_ids: d.deductions
      .filter((x: any) => x.basis_sha256 !== deductionBasis(p, x))
      .map((x: any) => x.id),
    stale_review_ids: d.reviews
      .filter(
        (n: any) =>
          n.target_sha256 !== targetDigest(p, n.target_kind, n.target_id),
      )
      .map((n: any) => n.id),
    roles: p.roles.map((r: any) => ({
      id: r.id,
      name: r.name,
      briefings: d.briefings.filter((b: any) => b.role_id === r.id).length,
      initial_clues: p.clues.filter(
        (c: any) => c.audience === "public" || c.role_ids.includes(r.id),
      ).length,
    })),
    round_count: d.rounds.length,
    test_count: d.test_runs?.length ?? 0,
    note: "覆盖数量不裁定边缘角色、诡计公平或真人体验。",
  };
}
export function orderedRounds(p: any) {
  return [...enabled(p).rounds].sort(
    (a, b) =>
      actOrder(p, a.act_id) - actOrder(p, b.act_id) || a.order - b.order,
  );
}
export function replayTest(run: any) {
  const p = run.snapshot,
    d = enabled(p),
    rounds = orderedRounds(p);
  need(rounds.length > 0, "机制测本须至少一个轮次。");
  let index = 0,
    closed = false;
  const visible = new Map<string, Set<string>>(
      p.roles.map((r: any) => [r.id, new Set<string>()]),
    ),
    spent = new Map<string, number>(),
    votes = new Map<string, Map<string, string>>(),
    skipped: any[] = [];
  const allKnown = (id: string) =>
    p.roles.every((r: any) => visible.get(r.id)!.has(id));
  const anyKnown = (id: string) =>
    p.roles.some((r: any) => visible.get(r.id)!.has(id));
  const pending = (round: any) => ({
    clue_ids: round.required_clue_ids.filter((id: string) => !anyKnown(id)),
    role_ids:
      round.kind === "vote" && round.all_roles_vote
        ? p.roles
            .filter((r: any) => !votes.get(round.id)?.has(r.id))
            .map((r: any) => r.id)
        : [],
  });
  for (const [n, e] of run.events.entries()) {
    need(!closed && index < rounds.length, "已结束轮次或关闭测本不可追加。");
    const round = rounds[index];
    need(
      e.sequence === n + 1 && e.round_id === round.id,
      "测本事件顺序或轮次不符。",
    );
    if (e.kind === "search") {
      need(
        round.kind === "search" &&
          e.role_id &&
          e.clue_id &&
          e.target_role_id === null &&
          e.option === null &&
          e.text === "",
        "搜证事件字段无效。",
      );
      find(p.roles, e.role_id);
      const clue = find(p.clues, e.clue_id),
        rule = find(
          d.clue_rules.find((r: any) => r.clue_id === clue.id)
            ? d.clue_rules
            : [],
          d.clue_rules.find((r: any) => r.clue_id === clue.id)?.id,
          "线索规则",
        );
      need(
        clue.act_id === round.act_id && rule.searchable,
        "线索不可在本轮搜证。",
      );
      need(
        clue.audience === "public" || clue.role_ids.includes(e.role_id),
        "该角色不是线索初始接收者。",
      );
      need(!visible.get(e.role_id)!.has(clue.id), "角色已持有线索。");
      const key = round.id + ":" + e.role_id,
        cost = (spent.get(key) ?? 0) + rule.cost;
      need(cost <= round.budget, "搜证预算不足。");
      spent.set(key, cost);
      if (clue.audience === "public")
        for (const ids of visible.values()) ids.add(clue.id);
      else visible.get(e.role_id)!.add(clue.id);
    } else if (e.kind === "share") {
      need(
        round.kind === "exchange" &&
          e.role_id &&
          e.target_role_id &&
          e.clue_id &&
          e.option === null &&
          e.text === "",
        "交换事件字段无效。",
      );
      find(p.roles, e.role_id);
      find(p.roles, e.target_role_id);
      const rule = d.clue_rules.find((r: any) => r.clue_id === e.clue_id);
      need(rule?.shareable, "线索不允许交换。");
      need(
        e.role_id !== e.target_role_id &&
          visible.get(e.role_id)!.has(e.clue_id) &&
          !visible.get(e.target_role_id)!.has(e.clue_id),
        "只能向尚未持有的其他角色交换已持有线索。",
      );
      visible.get(e.target_role_id)!.add(e.clue_id);
    } else if (e.kind === "reveal") {
      need(
        round.kind === "reveal" &&
          e.role_id === null &&
          e.target_role_id === null &&
          e.clue_id &&
          e.option === null &&
          e.text === "",
        "揭示事件字段无效。",
      );
      const clue = find(p.clues, e.clue_id);
      need(clue.act_id === round.act_id, "不能跨幕揭示线索。");
      const recipients =
        clue.audience === "public"
          ? p.roles.map((r: any) => r.id)
          : clue.role_ids;
      need(
        recipients.some((id: string) => !visible.get(id)!.has(clue.id)),
        "线索已给全部指定接收者。",
      );
      for (const id of recipients) visible.get(id)!.add(clue.id);
    } else if (e.kind === "vote") {
      need(
        round.kind === "vote" &&
          e.role_id &&
          e.option &&
          e.clue_id === null &&
          e.target_role_id === null &&
          e.text === "",
        "投票事件字段无效。",
      );
      find(p.roles, e.role_id);
      need(round.options.includes(e.option), "投票选项不存在。");
      const map = votes.get(round.id) ?? new Map<string, string>();
      need(!map.has(e.role_id), "同一轮角色只能投一票。");
      map.set(e.role_id, e.option);
      votes.set(round.id, map);
    } else if (e.kind === "advance" || e.kind === "skip") {
      need(
        e.role_id === null &&
          e.target_role_id === null &&
          e.clue_id === null &&
          e.option === null,
        "轮次结束字段无效。",
      );
      const missing = pending(round);
      if (e.kind === "advance")
        need(
          e.text === "" &&
            missing.clue_ids.length === 0 &&
            missing.role_ids.length === 0,
          "本轮必备线索或必需投票未齐。",
        );
      else {
        need(e.text.trim(), "跳过轮次须有原因。");
        skipped.push({ round_id: round.id, reason: e.text, missing });
      }
      index++;
    } else need(false, "未知机制事件。");
  }
  // 关闭是独立尾事件，先由下方包装器剥离，再验证完整前缀。
  const voteRows = [...votes].map(([round_id, by]) => ({
    round_id,
    votes: [...by].map(([role_id, option]) => ({ role_id, option })),
    counts: [...new Set([...by.values()])].map((option) => ({
      option,
      count: [...by.values()].filter((x) => x === option).length,
    })),
  }));
  const endings = d.endings
    .filter(
      (e: any) =>
        (votes.get(e.round_id)
          ? [...votes.get(e.round_id)!.values()].filter((x) => x === e.option)
              .length
          : 0) >= e.min_votes,
    )
    .map((e: any) => ({ id: e.id, title: e.title, body: e.body }));
  return {
    current_round_id: rounds[index]?.id ?? null,
    current_round: rounds[index] ?? null,
    rounds_completed: index,
    ready_to_close: index === rounds.length,
    closed,
    pending: rounds[index]
      ? pending(rounds[index])
      : { clue_ids: [], role_ids: [] },
    visible: Object.fromEntries(
      [...visible].map(([id, ids]) => [id, [...ids]]),
    ),
    spent: Object.fromEntries(spent),
    votes: voteRows,
    matching_endings: endings,
    skipped,
    event_count: run.events.length,
  };
}
export function testState(run: any): any {
  const close = run.events.at(-1);
  if (close?.kind !== "close") return replayTest(run);
  const prefix = { ...run, events: run.events.slice(0, -1) },
    state = replayTest(prefix);
  need(
    state.ready_to_close &&
      close.sequence === run.events.length &&
      close.round_id === orderedRounds(run.snapshot).at(-1)!.id &&
      close.role_id === null &&
      close.clue_id === null &&
      close.target_role_id === null &&
      close.option === null &&
      close.text.trim(),
    "关闭测本须完成全部轮次并记录复盘。",
  );
  return {
    ...state,
    closed: true,
    event_count: run.events.length,
    summary: close.text,
  };
}
export function playerView(
  p: any,
  roleID: string,
  actID: string,
  known?: Set<string>,
) {
  const d = enabled(p),
    role = find(p.roles, roleID),
    act = find(p.acts, actID),
    acts = [...p.acts]
      .filter((a: any) => a.order <= act.order)
      .sort((a, b) => a.order - b.order);
  return {
    role: {
      name: role.name,
      public_profile: role.public_profile,
      private_brief: role.private_brief,
    },
    premise: p.premise,
    acts: acts.map((a) => ({ title: a.title, public_brief: a.public_brief })),
    briefings: d.briefings
      .filter(
        (b: any) => b.role_id === roleID && acts.some((a) => a.id === b.act_id),
      )
      .sort((a: any, b: any) => actOrder(p, a.act_id) - actOrder(p, b.act_id))
      .map((b: any) => ({
        title: b.title,
        body: b.body,
        goals: b.goals,
        stale:
          b.basis_sha256 !==
          briefingBasis(p, b.role_id, b.act_id, b.known_fact_ids),
      })),
    clues: p.clues
      .filter(
        (c: any) =>
          acts.some((a) => a.id === c.act_id) &&
          (known
            ? known.has(c.id)
            : c.audience === "public" || c.role_ids.includes(roleID)),
      )
      .map((c: any) => ({ title: c.title, text: c.text })),
    note: "作者核对用角色投影，不包含主持解答、其他角色秘密、未来正文或全工程。",
  };
}
export function testPlayerView(run: any, roleID: string) {
  const state = testState(run),
    p = run.snapshot;
  find(p.roles, roleID);
  const round = state.current_round ?? orderedRounds(p).at(-1);
  return {
    ...playerView(p, roleID, round!.act_id, new Set(state.visible[roleID])),
    mode: run.mode,
    closed: state.closed,
    current_round: state.current_round
      ? { title: state.current_round.title, kind: state.current_round.kind }
      : null,
    own_votes: state.votes.flatMap((v: any) =>
      v.votes
        .filter((x: any) => x.role_id === roleID)
        .map((x: any) => ({ round_id: v.round_id, option: x.option })),
    ),
    note: "固定旧测本角色投影；模拟记录不是真人体验。",
  };
}
const testWrites = new Set([
  "start_test",
  "reveal_test_clue",
  "search_test_clue",
  "share_test_clue",
  "vote_test",
  "advance_test_round",
  "skip_test_round",
  "close_test",
]);
export function validateDepth(p: any) {
  if (!p.depth) return;
  validateSpec(p);
  const d = enabled(p);
  unique(
    d.test_runs.map((r: any) => r.id),
    "测本ID重复。",
  );
  for (const run of d.test_runs) {
    validateSpec(run.snapshot);
    unique(
      run.assignments.map((a: any) => a.role_id),
      "测本角色分配重复。",
    );
    need(
      run.assignments.length === run.snapshot.roles.length,
      "测本须有全部角色标签。",
    );
    run.assignments.forEach((a: any) => find(run.snapshot.roles, a.role_id));
    testState(run);
  }
}
export function validateDepthTransition(p: any, old: any, action: string) {
  if (old?.depth) need(p.depth?.version === 1, "不能裁掉已启用的深度结构。");
  if (!p.depth) return;
  const d = enabled(p),
    prev = old?.depth;
  for (const k of ["briefings", "deductions"])
    for (const x of d[k]) {
      const before = prev?.[k].find((y: any) => y.id === x.id);
      if (!before || canonical(before) !== canonical(x))
        need(
          x.basis_sha256 ===
            (k === "briefings"
              ? briefingBasis(p, x.role_id, x.act_id, x.known_fact_ids)
              : deductionBasis(p, x)),
          "新正文或推导须固定当前依据。",
          "hetu.stale_evidence",
        );
    }
  for (const n of d.reviews) {
    const before = prev?.reviews.find((x: any) => x.id === n.id);
    if (
      !before ||
      canonical([
        before.target_kind,
        before.target_id,
        before.target_sha256,
      ]) !== canonical([n.target_kind, n.target_id, n.target_sha256])
    )
      need(
        n.target_sha256 === targetDigest(p, n.target_kind, n.target_id),
        "新测本意见摘要不符。",
      );
  }
  if (!testWrites.has(action))
    need(
      canonical(d.test_runs) === canonical(prev?.test_runs ?? []),
      "测本历史只能由专业动作追加。",
    );
  else {
    for (const before of prev?.test_runs ?? []) {
      const after = find(d.test_runs, before.id);
      const { events: a, ...metaA } = after,
        { events: b, ...metaB } = before;
      need(
        canonical(metaA) === canonical(metaB) &&
          canonical(a.slice(0, b.length)) === canonical(b),
        "旧测本快照或事件不可改写。",
      );
      need(
        a.length === b.length || a.length === b.length + 1,
        "每次只追加一个事件。",
      );
    }
    for (const run of d.test_runs)
      if (!prev?.test_runs.some((x: any) => x.id === run.id))
        need(
          action === "start_test" &&
            run.events.length === 0 &&
            canonical(run.snapshot) === canonical(authorSnapshot(p)),
          "新测本须经start_test固定当前完整快照。",
        );
  }
}
export function writeDepth(a: string, p: any, i: any) {
  if (a === "enable_depth") {
    need(!p.depth, "当前工程已启用完整创作结构。");
    p.depth = emptyDepth();
    return true;
  }
  if (!testWrites.has(a)) return false;
  const d = enabled(p);
  if (a === "start_test") {
    need(!d.test_runs.some((x: any) => x.id === i.test_id), "测本ID已存在。");
    const report = checkDepth(p);
    need(
      p.roles.length >= 2 &&
        d.rounds.length > 0 &&
        report.missing_briefings.length === 0 &&
        report.missing_clue_rules.length === 0 &&
        report.stale_briefing_ids.length === 0 &&
        report.stale_deduction_ids.length === 0,
      "测本前须补齐角色正文、线索规则、轮次并复核依据。",
    );
    d.test_runs.push({
      id: i.test_id,
      label: i.label,
      mode: i.mode,
      author_ref: {
        owner_plugin_id: "org.wordflowlab.murder-mystery",
        object_id: i.object_id,
        revision: i.expected_revision,
        sha256: i.expected_sha256,
      },
      snapshot: authorSnapshot(p),
      assignments: i.assignments,
      events: [],
    });
    return true;
  }
  const run = find(d.test_runs, i.test_id),
    state = testState(run);
  need(!state.closed, "测本已关闭。");
  const kind = (
    {
      search_test_clue: "search",
      reveal_test_clue: "reveal",
      share_test_clue: "share",
      vote_test: "vote",
      advance_test_round: "advance",
      skip_test_round: "skip",
      close_test: "close",
    } as any
  )[a];
  const roundID =
    state.current_round_id ?? orderedRounds(run.snapshot).at(-1)!.id;
  const event = {
    sequence: run.events.length + 1,
    kind,
    round_id: roundID,
    role_id: i.role_id ?? null,
    target_role_id: i.target_role_id ?? null,
    clue_id: i.clue_id ?? null,
    option: i.option ?? null,
    text: i.reason ?? i.text ?? "",
  };
  const next = { ...run, events: [...run.events, event] };
  testState(next);
  run.events = next.events;
  return true;
}
export function reading(p: any) {
  const d = enabled(p);
  return (
    p.title +
    "\n\n故事背景\n" +
    p.premise +
    "\n\n主持解答\n" +
    p.solution +
    "\n\n案件事实\n" +
    [...d.facts]
      .sort((a, b) => a.order - b.order)
      .map(
        (f: any) =>
          f.time_label + " " + f.title + "\n" + f.text + "\n" + f.qualification,
      )
      .join("\n\n") +
    "\n\n角色分幕正文\n" +
    d.briefings
      .map(
        (b: any) =>
          find(p.roles, b.role_id).name +
          " / " +
          find(p.acts, b.act_id).title +
          " / " +
          b.title +
          "\n" +
          b.body +
          "\n目标：" +
          b.goals.join("；"),
      )
      .join("\n\n") +
    "\n\n推导与依据\n" +
    d.deductions
      .map(
        (x: any) =>
          x.title +
          "\n" +
          x.conclusion +
          "\n" +
          x.reasoning +
          "\n线索：" +
          x.clue_ids.map((id: string) => find(p.clues, id).title).join("、"),
      )
      .join("\n\n") +
    "\n\n机制轮次\n" +
    orderedRounds(p)
      .map(
        (r) =>
          find(p.acts, r.act_id).title +
          " / " +
          r.title +
          " [" +
          r.kind +
          "]\n每人预算 " +
          r.budget +
          "\n选项：" +
          r.options.join("、"),
      )
      .join("\n\n") +
    "\n\n候选结局\n" +
    d.endings
      .map(
        (e: any) =>
          e.title +
          "\n" +
          e.body +
          "\n条件：" +
          find(d.rounds, e.round_id).title +
          " " +
          e.option +
          " 至少" +
          e.min_votes +
          "票",
      )
      .join("\n\n") +
    "\n\n固定测本与复盘\n" +
    d.test_runs
      .map(
        (r: any) =>
          r.label +
          " [" +
          r.mode +
          "] " +
          r.events.length +
          "条事件\n" +
          (testState(r).summary ?? "尚未关闭"),
      )
      .join("\n\n")
  );
}
