import React, { useState, useEffect } from "react";
import { readArtifact } from "./artifact.ts";
import { useProfessionalReport } from "./professional-state.ts";
const sorted = (rows: any[]) => [...rows].sort((a, b) => a.order - b.order);
const kinds: any = {
  search: "搜证",
  exchange: "交换",
  vote: "投票",
  reveal: "揭示",
  share: "交换线索",
  advance: "完成轮次",
  skip: "明确跳过",
  close: "关闭复盘",
};
export function DepthView(props: any) {
  const { p, tab, invoke, selection, run, write, show, download } = props,
    d = p.depth,
    { report, error } = useProfessionalReport(props, "check_depth");
  const [role, setRole] = useState(""),
    [act, setAct] = useState(""),
    [testID, setTest] = useState(""),
    [clue, setClue] = useState(""),
    [target, setTarget] = useState(""),
    [option, setOption] = useState(""),
    [text, setText] = useState(""),
    [html, setHTML] = useState<any>(),
    [state, setState] = useState<any>(),
    [stateError, setStateError] = useState(""),
    [noteTarget, setNoteTarget] = useState("");
  const roleID = p.roles.some((r: any) => r.id === role)
      ? role
      : p.roles[0]?.id,
    actID = p.acts.some((a: any) => a.id === act) ? act : sorted(p.acts)[0]?.id,
    test = d.test_runs.find((r: any) => r.id === testID) ?? d.test_runs.at(-1),
    ref = selection(),
    key =
      ref.object_id +
      ":" +
      ref.revision +
      ":" +
      roleID +
      ":" +
      actID +
      ":" +
      test?.id;
  const testKey = ref.object_id + ":" + ref.revision + ":" + test?.id;
  useEffect(() => {
    let active = true;
    if (!test) {
      setState(undefined);
      return;
    }
    void invoke("test_view", { ...ref, test_id: test.id }).then(
      (value: any) => {
        if (active) {
          setState({ key: testKey, value });
          setStateError("");
        }
      },
      (e: any) => {
        if (active) setStateError(e.message);
      },
    );
    return () => {
      active = false;
    };
  }, [testKey, p]);
  const s = state?.key === testKey ? state.value : undefined,
    currentRound = s?.current_round,
    source = test?.snapshot ?? p,
    sourceRoles = source.roles,
    actor = sourceRoles.some((r: any) => r.id === roleID)
      ? roleID
      : sourceRoles[0]?.id,
    targetID = sourceRoles.some((r: any) => r.id === target)
      ? target
      : sourceRoles.find((r: any) => r.id !== actor)?.id,
    clueID = source.clues.some((c: any) => c.id === clue)
      ? clue
      : source.clues.find((c: any) => c.act_id === currentRound?.act_id)?.id,
    optionValue = currentRound?.options.includes(option)
      ? option
      : currentRound?.options[0];
  const choices = [
      ...d.briefings.map((b: any) => ({
        key: "briefing:" + b.id,
        kind: "briefing",
        id: b.id,
        title: b.title,
      })),
      ...d.deductions.map((x: any) => ({
        key: "deduction:" + x.id,
        kind: "deduction",
        id: x.id,
        title: x.title,
      })),
      ...d.rounds.map((x: any) => ({
        key: "round:" + x.id,
        kind: "round",
        id: x.id,
        title: x.title,
      })),
    ],
    picked = choices.find((x: any) => x.key === noteTarget) ?? choices[0];
  async function readPlayer(action: string, args: any) {
    const capture = key,
      result = await readArtifact(invoke, action, { ...selection(), ...args });
    setHTML({ key: capture, value: new TextDecoder().decode(result.bytes) });
  }
  const notes = (
    <>
      <h3>具体测本意见</h3>
      {d.reviews.map((n: any) => (
        <article key={n.id}>
          <p>{n.comment}</p>
          <p className="muted">
            {report?.stale_review_ids.includes(n.id)
              ? "意见依据已变化，需复核"
              : n.status === "open"
                ? "待处理"
                : "已记录处理"}{" "}
            {n.resolution}
          </p>
        </article>
      ))}
      {picked && (
        <details>
          <summary>为具体目标留意见</summary>
          <label>
            意见目标
            <select
              aria-label="意见目标"
              value={picked.key}
              onChange={(e) => setNoteTarget(e.target.value)}
            >
              {choices.map((x: any) => (
                <option key={x.key} value={x.key}>
                  {x.title}
                </option>
              ))}
            </select>
          </label>
          <textarea
            className="short-input"
            aria-label="专业意见"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            disabled={!text.trim()}
            onClick={() =>
              void run(async () => {
                const value = await invoke("depth_target_digest", {
                  ...selection(),
                  target_kind: picked.kind,
                  target_id: picked.id,
                });
                await write("put_review", {
                  review: {
                    id: "review-" + crypto.randomUUID(),
                    target_kind: picked.kind,
                    target_id: picked.id,
                    target_sha256: value.target_sha256,
                    origin: "author",
                    comment: text,
                    status: "open",
                    resolution: "",
                    category: "other",
                  },
                });
                setText("");
              })
            }
          >
            保存固定意见
          </button>
        </details>
      )}
    </>
  );
  return (
    <>
      {(error || stateError) && <p role="alert">{error || stateError}</p>}
      {tab === 0 && (
        <div className="work-layout">
          <div className="reading">
            <h3>故事背景</h3>
            <p>{p.premise}</p>
            {sorted(p.acts).map((a: any) => (
              <section key={a.id}>
                <h3>{a.title}</h3>
                <p>{a.public_brief}</p>
                {d.briefings
                  .filter((b: any) => b.act_id === a.id)
                  .map((b: any) => (
                    <details key={b.id}>
                      <summary>
                        {p.roles.find((r: any) => r.id === b.role_id)?.name}{" "}
                        分幕正文
                      </summary>
                      <p>{b.body}</p>
                      <p className="annotation">目标：{b.goals.join("；")}</p>
                    </details>
                  ))}
              </section>
            ))}
          </div>
          <aside className="side">
            <h3>完整创作</h3>
            <p>
              {d.briefings.length} 份分幕正文，{d.deductions.length} 条推导，
              {d.rounds.length} 个轮次
            </p>
            <details>
              <summary>主持解答与案件事实</summary>
              <p>{p.solution}</p>
              {sorted(d.facts).map((f: any) => (
                <article key={f.id}>
                  <h3>{f.title}</h3>
                  <p>
                    {f.time_label} {f.text}
                  </p>
                  <p className="muted">{f.qualification}</p>
                </article>
              ))}
            </details>
            <button onClick={() => void run(() => show("check_depth"))}>
              检查完整创作覆盖
            </button>
            <button onClick={() => void run(() => download("export_depth_gm"))}>
              导出完整主持本
            </button>
          </aside>
        </div>
      )}
      {tab === 1 && (
        <>
          <h3>证据与推导</h3>
          {d.deductions.map((x: any) => (
            <article key={x.id}>
              <h3>{x.title}</h3>
              <p>{x.conclusion}</p>
              <p>{x.reasoning}</p>
              <p className="muted">
                证据：
                {x.clue_ids
                  .map(
                    (id: string) =>
                      p.clues.find((c: any) => c.id === id)?.title,
                  )
                  .join("、")}
                　前提：
                {x.premise_ids
                  .map(
                    (id: string) =>
                      d.deductions.find((x: any) => x.id === id)?.title,
                  )
                  .join("、") || "无"}
              </p>
              <p
                className={
                  report?.stale_deduction_ids.includes(x.id)
                    ? "warning"
                    : "muted"
                }
              >
                {report?.stale_deduction_ids.includes(x.id)
                  ? "推导依据变化，待复核"
                  : "声明的证据关系"}
              </p>
              <button
                onClick={() =>
                  void run(() =>
                    show("deduction_view", {
                      deduction_id: x.id,
                      clue_ids: p.clues.map((c: any) => c.id),
                    }),
                  )
                }
              >
                核对这条推导
              </button>
              <button
                onClick={() =>
                  void run(async () => {
                    const v = await invoke("deduction_basis", {
                      ...selection(),
                      deduction: x,
                    });
                    await write("put_deduction", {
                      deduction: { ...x, basis_sha256: v.basis_sha256 },
                    });
                  })
                }
              >
                重新固定推导依据
              </button>
            </article>
          ))}
          <h3>机制轮次</h3>
          {sorted(p.acts).map((a: any) => (
            <section key={a.id}>
              <h3>{a.title}</h3>
              <ol>
                {sorted(d.rounds.filter((r: any) => r.act_id === a.id)).map(
                  (r: any) => (
                    <li key={r.id}>
                      <strong>{r.title}</strong>　{kinds[r.kind]}
                      <p>
                        每人预算 {r.budget}　
                        {r.all_roles_vote ? "全员投票后推进" : ""}
                      </p>
                      <p className="muted">
                        必备线索：
                        {r.required_clue_ids
                          .map(
                            (id: string) =>
                              p.clues.find((c: any) => c.id === id)?.title,
                          )
                          .join("、") || "无"}
                      </p>
                    </li>
                  ),
                )}
              </ol>
            </section>
          ))}
          {notes}
        </>
      )}
      {tab === 2 && (
        <>
          <div className="actions">
            <label>
              玩家角色
              <select
                aria-label="玩家角色"
                value={roleID ?? ""}
                onChange={(e) => setRole(e.target.value)}
              >
                {p.roles.map((r: any) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              阅读幕次
              <select
                aria-label="阅读幕次"
                value={actID ?? ""}
                onChange={(e) => setAct(e.target.value)}
              >
                {sorted(p.acts).map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.title}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={!roleID || !actID}
              onClick={() =>
                void run(() =>
                  readPlayer("export_depth_player", {
                    role_id: roleID,
                    act_id: actID,
                  }),
                )
              }
            >
              阅读完整角色本
            </button>
            <button
              disabled={!roleID || !actID}
              onClick={() =>
                void run(() =>
                  download("export_depth_player", {
                    role_id: roleID,
                    act_id: actID,
                  }),
                )
              }
            >
              导出完整角色本
            </button>
          </div>
          <p className="muted">
            可切换每名角色和每幕。主持资料与未来正文不随角色本导出，文本自身是否泄底需具体核对。
          </p>
          {html?.key === key && (
            <iframe
              title="固定角色资料"
              className="artifact-frame"
              srcDoc={html.value}
              sandbox=""
            />
          )}
          <h3>角色正文复核</h3>
          {d.briefings
            .filter((b: any) => b.role_id === roleID)
            .map((b: any) => (
              <article key={b.id}>
                <h3>{b.title}</h3>
                <p
                  className={
                    report?.stale_briefing_ids.includes(b.id)
                      ? "warning"
                      : "muted"
                  }
                >
                  {report?.stale_briefing_ids.includes(b.id)
                    ? "知情依据变化，需复核"
                    : "知情依据已固定"}
                </p>
                <button
                  onClick={() =>
                    void run(async () => {
                      const v = await invoke("briefing_basis", {
                        ...selection(),
                        role_id: b.role_id,
                        act_id: b.act_id,
                        known_fact_ids: b.known_fact_ids,
                      });
                      await write("put_briefing", {
                        briefing: { ...b, basis_sha256: v.basis_sha256 },
                      });
                    })
                  }
                >
                  重新固定该角色正文
                </button>
              </article>
            ))}
        </>
      )}
      {tab === 3 && (
        <>
          <div className="actions">
            <button
              onClick={() =>
                void run(() =>
                  write("start_test", {
                    test_id: "test-" + crypto.randomUUID(),
                    label: "新一轮完整模拟测本",
                    mode: "agent_simulated",
                    assignments: p.roles.map((r: any) => ({
                      role_id: r.id,
                      participant: r.name + " 模拟",
                    })),
                  }),
                )
              }
            >
              开始完整模拟测本
            </button>
            <select
              aria-label="完整测本"
              value={test?.id ?? ""}
              onChange={(e) => setTest(e.target.value)}
            >
              {d.test_runs.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {test && (
            <>
              <h3>{test.label}</h3>
              <p className="muted">
                {test.mode === "agent_simulated"
                  ? "Agent模拟，不是真人体验"
                  : "提交者声明的人工记录"}
                　固定作者修订 {test.author_ref.revision}
              </p>
              {s ? (
                <>
                  <p aria-live="polite">
                    {s.closed
                      ? "测本已关闭"
                      : s.ready_to_close
                        ? "所有轮次已完成，等待复盘"
                        : currentRound?.title}
                  </p>
                  <ol>
                    {s.events.map((e: any) => (
                      <li key={e.sequence}>
                        {kinds[e.kind]}{" "}
                        {e.clue_id
                          ? source.clues.find((c: any) => c.id === e.clue_id)
                              ?.title
                          : ""}{" "}
                        {e.text}
                      </li>
                    ))}
                  </ol>
                  {!s.closed && (
                    <>
                      <div className="actions">
                        <label>
                          行动角色
                          <select
                            aria-label="行动角色"
                            value={actor ?? ""}
                            onChange={(e) => setRole(e.target.value)}
                          >
                            {sourceRoles.map((r: any) => (
                              <option key={r.id} value={r.id}>
                                {r.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          行动线索
                          <select
                            aria-label="行动线索"
                            value={clueID ?? ""}
                            onChange={(e) => setClue(e.target.value)}
                          >
                            {source.clues.map((c: any) => (
                              <option key={c.id} value={c.id}>
                                {c.title}
                              </option>
                            ))}
                          </select>
                        </label>
                        {currentRound?.kind === "search" && (
                          <button
                            onClick={() =>
                              void run(() =>
                                write("search_test_clue", {
                                  test_id: test.id,
                                  role_id: actor,
                                  clue_id: clueID,
                                }),
                              )
                            }
                          >
                            记录本次搜证
                          </button>
                        )}
                        {currentRound?.kind === "reveal" && (
                          <button
                            onClick={() =>
                              void run(() =>
                                write("reveal_test_clue", {
                                  test_id: test.id,
                                  clue_id: clueID,
                                }),
                              )
                            }
                          >
                            记录本次揭示
                          </button>
                        )}
                      </div>
                      {currentRound?.kind === "exchange" && (
                        <div className="actions">
                          <label>
                            交换给谁
                            <select
                              aria-label="交换给谁"
                              value={targetID ?? ""}
                              onChange={(e) => setTarget(e.target.value)}
                            >
                              {sourceRoles
                                .filter((r: any) => r.id !== actor)
                                .map((r: any) => (
                                  <option key={r.id} value={r.id}>
                                    {r.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <button
                            onClick={() =>
                              void run(() =>
                                write("share_test_clue", {
                                  test_id: test.id,
                                  role_id: actor,
                                  target_role_id: targetID,
                                  clue_id: clueID,
                                }),
                              )
                            }
                          >
                            记录线索交换
                          </button>
                        </div>
                      )}
                      {currentRound?.kind === "vote" && (
                        <div className="actions">
                          <label>
                            投票选项
                            <select
                              aria-label="投票选项"
                              value={optionValue ?? ""}
                              onChange={(e) => setOption(e.target.value)}
                            >
                              {currentRound.options.map((o: string) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            onClick={() =>
                              void run(() =>
                                write("vote_test", {
                                  test_id: test.id,
                                  role_id: actor,
                                  option: optionValue,
                                }),
                              )
                            }
                          >
                            记录本轮投票
                          </button>
                        </div>
                      )}
                      <label>
                        测本原因或复盘
                        <textarea
                          className="short-input"
                          aria-label="测本记录"
                          value={text}
                          onChange={(e) => setText(e.target.value)}
                        />
                      </label>
                      <div className="actions">
                        <button
                          disabled={!currentRound}
                          onClick={() =>
                            void run(() =>
                              write("advance_test_round", { test_id: test.id }),
                            )
                          }
                        >
                          完成当前轮次
                        </button>
                        <button
                          disabled={!currentRound || !text.trim()}
                          onClick={() =>
                            void run(() =>
                              write("skip_test_round", {
                                test_id: test.id,
                                reason: text,
                              }),
                            )
                          }
                        >
                          说明并跳过本轮
                        </button>
                        <button
                          disabled={!s.ready_to_close || !text.trim()}
                          onClick={() =>
                            void run(() =>
                              write("close_test", { test_id: test.id, text }),
                            )
                          }
                        >
                          结束并保存完整复盘
                        </button>
                      </div>
                    </>
                  )}
                  <div className="actions">
                    <button
                      onClick={() =>
                        void run(() => show("test_view", { test_id: test.id }))
                      }
                    >
                      回读完整固定测本
                    </button>
                    <button
                      onClick={() =>
                        void run(() =>
                          readPlayer("export_test_player", {
                            test_id: test.id,
                            role_id: actor,
                          }),
                        )
                      }
                    >
                      核对测本角色资料
                    </button>
                    <button
                      onClick={() =>
                        void run(() =>
                          download("export_test_player", {
                            test_id: test.id,
                            role_id: actor,
                          }),
                        )
                      }
                    >
                      导出测本角色资料
                    </button>
                  </div>
                  {html?.key === key && (
                    <iframe
                      title="固定测本角色资料"
                      className="artifact-frame"
                      srcDoc={html.value}
                      sandbox=""
                    />
                  )}
                </>
              ) : (
                <p>正在读取固定测本</p>
              )}
            </>
          )}
          <details>
            <summary>v0.1.0旧试玩</summary>
            {p.sessions.map((r: any) => (
              <p key={r.id}>
                {r.label}　{r.events.length} 条旧事件
                <button
                  onClick={() =>
                    void run(() => show("session_view", { session_id: r.id }))
                  }
                >
                  回读旧试玩
                </button>
              </p>
            ))}
          </details>
        </>
      )}
      {tab === 4 && (
        <>
          <div className="actions">
            <button onClick={() => void run(() => download("export_depth_gm"))}>
              导出完整主持本
            </button>
            <button onClick={() => void run(() => show("check_depth"))}>
              交付前复核
            </button>
            <button
              onClick={() =>
                void run(() =>
                  show("create_handoff", {
                    goal: "按完整角色正文、证据与固定测本意见接续下一稿，保留旧试玩。",
                  }),
                )
              }
            >
              准备固定创作交接
            </button>
          </div>
          {notes}
          <p className="muted">
            角色本、主持本和完整工程分开交付；模拟测本不代替真人体验。正文采纳和定稿另行决定。
          </p>
        </>
      )}
    </>
  );
}
