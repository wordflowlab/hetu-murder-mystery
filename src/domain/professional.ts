import * as D from "./depth.ts";
import {
  requireValue as need,
  canonical,
  data,
} from "../../vendor/project-store.ts";
import { artifact } from "./artifact.ts";
import { escapeHTML as esc, htmlPage } from "./presentation.ts";
const find = (rows: any[], id: string, label: string) => {
  const v = rows.find((x) => x.id === id);
  need(v, label + "不存在。");
  return v;
};
const unique = (ids: string[], label: string) =>
  need(new Set(ids).size === ids.length, label + "重复。");
export const authorSnapshot = (p: any) =>
  Object.fromEntries(
    ["premise", "gm_notes", "solution", "roles", "acts", "clues"].map((k) => [
      k,
      structuredClone(p[k]),
    ]),
  );
export const orderedActs = (p: any) =>
  [...p.acts].sort((a, b) => a.order - b.order);
export function validateScenario(p: any) {
  for (const name of ["roles", "acts", "clues"])
    unique(
      p[name].map((v: any) => v.id),
      name,
    );
  unique(
    p.acts.map((v: any) => v.order),
    "幕次顺序",
  );
  for (const role of p.roles)
    need(
      (role.entity_ref === null) === (role.entity_source_index === null),
      "人物身份与固定设定来源须成对提供。",
    );
  for (const clue of p.clues) {
    find(p.acts, clue.act_id, "线索幕次");
    unique(clue.role_ids, "线索接收角色");
    for (const id of clue.role_ids) find(p.roles, id, "接收角色");
    need(
      clue.audience === "public"
        ? clue.role_ids.length === 0
        : clue.role_ids.length > 0,
      "公开线索不指定角色，私有线索须指定接收角色。",
    );
  }
}
export function checkScenario(p: any) {
  return {
    role_count: p.roles.length,
    act_count: p.acts.length,
    clue_count: p.clues.length,
    missing:
      p.roles.length < 2
        ? ["至少两个角色才能开始试玩"]
        : !p.acts.length
          ? ["尚无幕次"]
          : [],
    roles: p.roles.map((r: any) => ({
      name: r.name,
      clue_count: p.clues.filter(
        (c: any) => c.audience === "public" || c.role_ids.includes(r.id),
      ).length,
    })),
    acts: orderedActs(p).map((a) => ({
      title: a.title,
      required_count: p.clues.filter(
        (c: any) => c.act_id === a.id && c.required,
      ).length,
    })),
    note: "只验证资料与发放结构，文本自身可能包含剧透；不证明推理公平或真人体验。",
  };
}
export function playerView(
  p: any,
  roleID: string,
  actID: string,
  released?: Set<string>,
) {
  if (p.depth) return D.playerView(p, roleID, actID, released);
  const role = find(p.roles, roleID, "玩家角色"),
    act = find(p.acts, actID, "玩家幕次"),
    acts = orderedActs(p).filter((a) => a.order <= act.order);
  // 构造最小投影，绝不从全工程删除字段后返回。
  return {
    role: {
      name: role.name,
      public_profile: role.public_profile,
      private_brief: role.private_brief,
    },
    premise: p.premise,
    acts: acts.map((a) => ({ title: a.title, public_brief: a.public_brief })),
    clues: p.clues
      .filter(
        (c: any) =>
          acts.some((a) => a.id === c.act_id) &&
          (c.audience === "public" || c.role_ids.includes(roleID)) &&
          (!released || released.has(c.id)),
      )
      .map((c: any) => ({ title: c.title, text: c.text })),
    note: "角色创作视角；不包含主持解答、其他角色秘密与未来线索。",
  };
}
const textHTML = (title: string, text: string) =>
  "<section><h2>" +
  esc(title) +
  '</h2><p style="white-space:pre-wrap">' +
  esc(text) +
  "</p></section>";
export function playerHTML(view: any) {
  return htmlPage(
    view.role.name + " 角色资料",
    "<h1>" +
      esc(view.role.name) +
      "</h1>" +
      textHTML("故事背景", view.premise) +
      textHTML("公开身份", view.role.public_profile) +
      textHTML("你的资料", view.role.private_brief) +
      view.acts.map((a: any) => textHTML(a.title, a.public_brief)).join("") +
      (view.briefings ?? [])
        .map((b: any) =>
          textHTML(b.title, b.body + "\n目标：" + b.goals.join("；")),
        )
        .join("") +
      view.clues.map((c: any) => textHTML(c.title, c.text)).join(""),
  );
}
export function replay(session: any) {
  const p = session.snapshot,
    acts = orderedActs(p);
  need(acts.length > 0 && p.roles.length >= 2, "试玩需要幕次和至少两个角色。");
  let at = 0,
    closed = false;
  const released = new Set<string>(),
    skipped = new Set<string>(),
    guesses: any[] = [];
  const pending = () =>
    p.clues.filter(
      (c: any) =>
        c.act_id === acts[at].id &&
        c.required &&
        !released.has(c.id) &&
        !skipped.has(c.id),
    );
  for (const [index, e] of session.events.entries()) {
    need(!closed, "已结束试玩不可追加记录。");
    need(
      e.sequence === index + 1 && e.act_id === acts[at].id,
      "试玩事件顺序或幕次不一致。",
    );
    if (e.kind === "release" || e.kind === "skip") {
      const clue = find(p.clues, e.clue_id, "试玩线索");
      need(
        e.role_id === null &&
          clue.act_id === acts[at].id &&
          !released.has(clue.id) &&
          !skipped.has(clue.id),
        "线索已处理或不在当前幕。",
      );
      if (e.kind === "skip") {
        need(e.text.trim(), "跳过线索须说明原因。");
        skipped.add(clue.id);
      } else {
        need(e.text === "", "发放事件不附加任意文本。");
        released.add(clue.id);
      }
    } else if (e.kind === "advance") {
      need(
        e.clue_id === null && e.role_id === null && e.text === "",
        "推进事件字段无效。",
      );
      need(!pending().length, "当前幕必发线索尚未处理。");
      need(at + 1 < acts.length, "已经是最后一幕。");
      at++;
    } else if (e.kind === "guess") {
      need(e.clue_id === null && e.text.trim(), "推测须有文本且不附线索。");
      find(p.roles, e.role_id, "推测角色");
      guesses.push({ role_id: e.role_id, text: e.text, act_id: e.act_id });
    } else if (e.kind === "close") {
      need(
        e.clue_id === null && e.role_id === null && e.text.trim(),
        "结束须记录复盘。",
      );
      need(
        at === acts.length - 1 && !pending().length,
        "须完成最后一幕必发线索再结束。",
      );
      closed = true;
    } else need(false, "未知试玩事件。");
  }
  return {
    current_act_id: acts[at].id,
    current_act: acts[at].title,
    closed,
    released_clue_ids: [...released],
    skipped_clue_ids: [...skipped],
    pending_required_ids: pending().map((c: any) => c.id),
    guesses,
    event_count: session.events.length,
  };
}
export function validateDomain(p: any) {
  D.validateDepth(p);
  if (p.depth) for (const r of p.depth.test_runs) validateScenario(r.snapshot);
  validateScenario(p);
  unique(
    p.sessions.map((s: any) => s.id),
    "试玩ID",
  );
  for (const s of p.sessions) {
    validateScenario(s.snapshot);
    unique(
      s.assignments.map((a: any) => a.role_id),
      "角色分配",
    );
    need(
      s.assignments.length === s.snapshot.roles.length,
      "每位角色须有明确参与者标签。",
    );
    for (const a of s.assignments)
      find(s.snapshot.roles, a.role_id, "试玩角色");
    replay(s);
  }
}
const sessionActions = new Set([
  "start_session",
  "release_clue",
  "skip_clue",
  "advance_act",
  "record_guess",
  "close_session",
]);
export function validateTransition(
  next: any,
  previous: any,
  action = "save_project",
) {
  D.validateDepthTransition(next, previous, action);
  if (!sessionActions.has(action))
    need(
      canonical(next.sessions) === canonical(previous?.sessions ?? []),
      "试玩历史只能由专业动作追加，不能通过整本保存伪造或改写。",
    );
}
export async function checkSources(p: any, sources: any[], request: any) {
  const roles = [
    ...p.roles,
    ...p.sessions.flatMap((s: any) => s.snapshot.roles),
  ];
  for (const role of roles)
    if (role.entity_ref !== null) {
      const source = sources[role.entity_source_index]?.source_ref;
      need(source?.kind === "blueprint", "人物关联须固定作品设定。");
      const r = data(
        await request("hetu.extensions.sources.inspect", {
          source_ref: source,
          entity_ref: role.entity_ref,
        }),
      );
      need(r.entity_kind === "character", "关联对象不是人物。");
    }
}
export async function writeProfessional(
  a: string,
  p: any,
  _s: any[],
  i: any,
  _request?: any,
) {
  if (D.writeDepth(a, p, i)) return;
  if (a === "start_session") {
    need(!p.sessions.some((s: any) => s.id === i.session_id), "试玩ID已存在。");
    need(checkScenario(p).missing.length === 0, "试玩前须具备角色与幕次。");
    p.sessions.push({
      id: i.session_id,
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
    return;
  }
  const session = find(p.sessions, i.session_id, "试玩"),
    state = replay(session);
  need(!state.closed, "试玩已经结束。");
  const kind = (
    {
      release_clue: "release",
      skip_clue: "skip",
      advance_act: "advance",
      record_guess: "guess",
      close_session: "close",
    } as any
  )[a];
  need(kind, "未知专业写动作。");
  session.events.push({
    sequence: session.events.length + 1,
    kind,
    act_id: state.current_act_id,
    clue_id: i.clue_id ?? null,
    role_id: i.role_id ?? null,
    text: i.reason ?? i.text ?? "",
  });
  replay(session);
}
export async function pureAction(..._args: any[]) {
  return undefined;
}
export async function readProfessional(
  a: string,
  p: any,
  _s: any[],
  i: any,
  _request?: any,
): Promise<any> {
  if (a === "briefing_basis")
    return {
      basis_sha256: D.briefingBasis(p, i.role_id, i.act_id, i.known_fact_ids),
    };
  if (a === "deduction_basis")
    return { basis_sha256: D.deductionBasis(p, i.deduction) };
  if (a === "depth_target_digest")
    return { target_sha256: D.targetDigest(p, i.target_kind, i.target_id) };
  if (a === "check_depth") return D.checkDepth(p);
  if (a === "deduction_view")
    return D.deductionView(p, i.deduction_id, i.clue_ids);
  if (a === "test_view") {
    const r = find(D.enabled(p).test_runs, i.test_id, "测本");
    return {
      author_ref: r.author_ref,
      label: r.label,
      mode: r.mode,
      ...D.testState(r),
      events: r.events,
    };
  }
  if (a === "test_player_view")
    return D.testPlayerView(
      find(D.enabled(p).test_runs, i.test_id, "测本"),
      i.role_id,
    );
  if (a === "export_depth_player")
    return artifact(
      playerHTML(D.playerView(p, i.role_id, i.act_id)),
      "完整角色本.html",
      "text/html",
      i,
    );
  if (a === "export_test_player")
    return artifact(
      playerHTML(
        D.testPlayerView(
          find(D.enabled(p).test_runs, i.test_id, "测本"),
          i.role_id,
        ),
      ),
      "固定测本角色资料.html",
      "text/html",
      i,
    );
  if (a === "export_depth_gm" || (a === "export_gm" && p.depth))
    return artifact(
      htmlPage(
        p.title,
        "<h1>" + esc(p.title) + "</h1>" + textHTML("完整主持本", D.reading(p)),
      ),
      "完整主持本.html",
      "text/html",
      i,
    );

  if (a === "check_scenario") return checkScenario(p);
  if (a === "player_view") return playerView(p, i.role_id, i.act_id);
  if (a === "export_player")
    return artifact(
      playerHTML(playerView(p, i.role_id, i.act_id)),
      "角色资料.html",
      "text/html",
      i,
    );
  if (a === "export_gm")
    return artifact(
      htmlPage(
        "主持手册",
        "<h1>主持手册</h1>" +
          textHTML("背景", p.premise) +
          textHTML("主持提示", p.gm_notes) +
          textHTML("解答", p.solution) +
          p.roles
            .map((r: any) =>
              textHTML(r.name, r.public_profile + "\n" + r.private_brief),
            )
            .join("") +
          orderedActs(p)
            .map(
              (act) =>
                textHTML(
                  act.title,
                  act.public_brief + "\n主持提示：" + act.gm_notes,
                ) +
                p.clues
                  .filter((c: any) => c.act_id === act.id)
                  .map((c: any) =>
                    textHTML(
                      c.title,
                      c.text +
                        "\n接收者：" +
                        (c.audience === "public"
                          ? "全体"
                          : c.role_ids
                              .map(
                                (id: string) => find(p.roles, id, "角色").name,
                              )
                              .join("、")),
                    ),
                  )
                  .join(""),
            )
            .join(""),
      ),
      "主持手册.html",
      "text/html",
      i,
    );
  if (
    ["session_view", "session_player_view", "export_session_player"].includes(a)
  ) {
    const session = find(p.sessions, i.session_id, "试玩"),
      state = replay(session);
    if (a === "session_view")
      return {
        author_ref: session.author_ref,
        label: session.label,
        mode: session.mode,
        ...state,
        events: session.events,
        note: "回放固定作者修订；发放仅为记录，不向任何人发送。",
      };
    const view = playerView(
      session.snapshot,
      i.role_id,
      state.current_act_id,
      new Set(state.released_clue_ids),
    );
    if (a === "export_session_player")
      return artifact(playerHTML(view), "试玩角色资料.html", "text/html", i);
    return { ...view, author_ref: session.author_ref, mode: session.mode };
  }
}
export function summaries(p: any) {
  return [
    ...(p.depth
      ? [{ title: "完整创作与机制测本", lines: [D.reading(p)] }]
      : []),
    { title: "作者工程", lines: [p.premise, p.gm_notes, p.solution] },
    {
      title: "角色资料",
      lines: p.roles.map(
        (r: any) =>
          `${r.name}：${r.public_profile}\n私有资料：${r.private_brief}`,
      ),
    },
    {
      title: "分幕",
      lines: orderedActs(p).map(
        (a) => `${a.title}：${a.public_brief}\n主持提示：${a.gm_notes}`,
      ),
    },
    {
      title: "试玩与复盘",
      lines: p.sessions.map(
        (s: any) => `${s.label}（${s.mode}）：${replay(s).event_count}条事件`,
      ),
    },
  ];
}
