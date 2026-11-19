import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, clone } from "../src/domain/model.ts";
import { validateTransition, replay } from "../src/domain/professional.ts";
import * as D from "../src/domain/depth.ts";
import {
  depthScenario,
  legacyScenario,
  startRun,
  append,
  throughSearch,
  throughVote,
  complete,
} from "./support/depth-scenario.ts";
const zeros = "0".repeat(64);
test("v0.1.0工程及固定旧试玩保持有效", () => {
  const p = legacyScenario();
  assert.doesNotThrow(() => validate(p));
  assert.equal(p.depth, undefined);
  assert.equal(replay(p.sessions[0]).event_count, 0);
});
test("显式启用不改写旧试玩", () => {
  const p = legacyScenario(),
    old = clone(p);
  D.writeDepth("enable_depth", p, {});
  validate(p);
  validateTransition(p, old, "enable_depth");
  assert.deepEqual(p.sessions, old.sessions);
  assert.throws(() => D.writeDepth("enable_depth", p, {}));
});
test("含完整案情角色正文与机制的Schema通过", () =>
  assert.doesNotThrow(() => validate(depthScenario())));
test("已启用depth不能被旧客户端裁掉", () => {
  const old = depthScenario(),
    p = clone(old);
  delete p.depth;
  assert.throws(() => validateTransition(p, old));
});
test("同角色同幕重复正文拒绝", () => {
  const p = depthScenario();
  p.depth.briefings.push({ ...p.depth.briefings[0], id: "duplicate" });
  assert.throws(() => validate(p));
});
test("角色正文不能引用不存在的事实", () => {
  const p = depthScenario();
  p.depth.briefings[0].known_fact_ids = ["missing"];
  assert.throws(() => validate(p));
});
test("声明的证据链支持多级前提", () => {
  const p = depthScenario();
  assert.equal(
    D.deductionView(p, "sender", ["seal", "letter", "register"]).available,
    true,
  );
});
test("缺证据不假装推导成立", () => {
  const v = D.deductionView(depthScenario(), "sender", ["seal"]);
  assert.equal(v.available, false);
  assert.deepEqual(v.missing_clue_ids, ["letter", "register"]);
});
test("推导循环拒绝", () => {
  const p = depthScenario();
  p.depth.deductions[0].premise_ids = ["early"];
  assert.throws(() => validate(p));
});
test("推导不能引用未来线索", () => {
  const p = depthScenario();
  p.depth.deductions[0].clue_ids = ["register"];
  assert.throws(() => validate(p));
});
test("推导不可引用不存在的线索", () => {
  const p = depthScenario();
  p.depth.deductions[0].clue_ids = ["unknown"];
  assert.throws(() => validate(p));
});
test("新角色正文不得伪造摘要", () => {
  const p = depthScenario(),
    old = clone(p);
  p.depth.briefings[0].body += "新段落";
  p.depth.briefings[0].basis_sha256 = zeros;
  assert.throws(() => validateTransition(p, old));
});
test("事实改变使对应正文及意见过期且保留原文", () => {
  const p = depthScenario(),
    old = clone(p);
  p.depth.facts[1].text = "修改后的事实";
  validate(p);
  validateTransition(p, old);
  const r = D.checkDepth(p);
  assert.ok(r.stale_briefing_ids.includes("lin-arrival"));
  assert.ok(r.stale_review_ids.includes("review"));
  assert.equal(p.depth.briefings[0].body, old.depth.briefings[0].body);
  assert.equal(p.depth.briefings[2].body, old.depth.briefings[2].body);
});
test("改线索后旧推导及下游前提待复核", () => {
  const p = depthScenario();
  p.clues[0].text = "新的邮戳内容";
  assert.equal(D.checkDepth(p).stale_deduction_ids.length, 2);
});
test("整案角色资料不输出主持解答和其他秘密", () => {
  const p = depthScenario(),
    s = JSON.stringify(D.playerView(p, "lin", "arrival"));
  assert.ok(!s.includes("主持专有"));
  assert.ok(!s.includes("守站人私密"));
  assert.ok(!s.includes("第二幕秘密"));
  assert.ok(!s.includes("test_runs"));
});
test("玩家只能读到截至当前幕的本人正文", () => {
  const v = D.playerView(depthScenario(), "lin", "arrival");
  assert.equal(v.briefings.length, 1);
  assert.ok(v.briefings[0].body.includes("你叫林溪"));
});
test("完整作者快照固定后不跟随新稿", () => {
  const p = depthScenario(),
    run = startRun(p),
    before = clone(run.snapshot);
  p.solution = "新版解答";
  assert.deepEqual(run.snapshot, before);
  validate(p);
});
test("正文缺失时不能开始完整测本", () => {
  const p = depthScenario();
  p.depth.briefings.pop();
  assert.throws(() => startRun(p));
});
test("缺线索规则时不能开始测本", () => {
  const p = depthScenario();
  p.depth.clue_rules.pop();
  assert.throws(() => startRun(p));
});
test("过期正文须先复核再测本", () => {
  const p = depthScenario();
  p.depth.facts[0].text = "改稿";
  assert.throws(() => startRun(p));
});
test("搜证成功按角色扣成本并发线索", () => {
  const p = depthScenario();
  startRun(p);
  const s = append(p, "search_test_clue", {
    role_id: "lin",
    clue_id: "letter",
  });
  assert.equal(s.spent["search-one:lin"], 1);
  assert.ok(s.visible.lin.includes("letter"));
  assert.ok(!s.visible.keeper.includes("letter"));
});
test("公开线索对全部角色可见", () => {
  const p = depthScenario();
  startRun(p);
  const s = append(p, "search_test_clue", { role_id: "lin", clue_id: "seal" });
  assert.ok(s.visible.keeper.includes("seal"));
});
test("预算不足不增加事件也不扣预算", () => {
  const p = depthScenario();
  p.depth.rounds[0].budget = 1;
  startRun(p);
  append(p, "search_test_clue", { role_id: "lin", clue_id: "seal" });
  const before = clone(p.depth.test_runs[0]);
  assert.throws(() =>
    append(p, "search_test_clue", { role_id: "lin", clue_id: "letter" }),
  );
  assert.deepEqual(p.depth.test_runs[0], before);
});
test("不能搜未来幕次线索", () => {
  const p = depthScenario();
  startRun(p);
  assert.throws(() =>
    append(p, "search_test_clue", { role_id: "keeper", clue_id: "register" }),
  );
});
test("不能抢取不属于本人的初始私有线索", () => {
  const p = depthScenario();
  startRun(p);
  assert.throws(() =>
    append(p, "search_test_clue", { role_id: "keeper", clue_id: "letter" }),
  );
});
test("未取得必备线索不能推进", () => {
  const p = depthScenario();
  startRun(p);
  assert.throws(() => append(p, "advance_test_round"));
});
test("跳过轮次记录原因及未满足项", () => {
  const p = depthScenario();
  startRun(p);
  const s = append(p, "skip_test_round", { reason: "专门测试缺少线索的情况" });
  assert.equal(s.current_round_id, "exchange");
  assert.equal(s.skipped[0].missing.clue_ids.length, 2);
});
test("空理由不能跳过轮次", () => {
  const p = depthScenario();
  startRun(p);
  assert.throws(() => append(p, "skip_test_round", { reason: "" }));
});
test("交换增加接收者而保留原持有人", () => {
  const p = throughSearch(depthScenario()),
    s = append(p, "share_test_clue", {
      role_id: "lin",
      target_role_id: "keeper",
      clue_id: "letter",
    });
  assert.ok(s.visible.lin.includes("letter"));
  assert.ok(s.visible.keeper.includes("letter"));
});
test("不能交换尚未持有线索", () => {
  const p = throughSearch(depthScenario());
  assert.throws(() =>
    append(p, "share_test_clue", {
      role_id: "keeper",
      target_role_id: "lin",
      clue_id: "register",
    }),
  );
});
test("不能交换不允许分享的线索", () => {
  const p = throughSearch(depthScenario());
  assert.throws(() =>
    append(p, "share_test_clue", {
      role_id: "lin",
      target_role_id: "keeper",
      clue_id: "seal",
    }),
  );
});
test("不能向自己或重复接收者交换", () => {
  const p = throughSearch(depthScenario());
  assert.throws(() =>
    append(p, "share_test_clue", {
      role_id: "lin",
      target_role_id: "lin",
      clue_id: "letter",
    }),
  );
  append(p, "share_test_clue", {
    role_id: "lin",
    target_role_id: "keeper",
    clue_id: "letter",
  });
  assert.throws(() =>
    append(p, "share_test_clue", {
      role_id: "lin",
      target_role_id: "keeper",
      clue_id: "letter",
    }),
  );
});
test("全员投票前不能结束必需轮次", () => {
  const p = throughVote(depthScenario());
  p.depth.test_runs[0].events.pop();
  assert.throws(() => append(p, "advance_test_round"));
});
test("重复投票拒绝且不改事件", () => {
  const p = throughVote(depthScenario()),
    before = clone(p.depth.test_runs[0]);
  assert.throws(() =>
    append(p, "vote_test", { role_id: "lin", option: "林溪" }),
  );
  assert.deepEqual(p.depth.test_runs[0], before);
});
test("不存在的投票选项拒绝", () => {
  const p = throughVote(depthScenario());
  p.depth.test_runs[0].events.pop();
  assert.throws(() =>
    append(p, "vote_test", { role_id: "keeper", option: "第三人" }),
  );
});
test("玩家投影只显示本人的票", () => {
  const p = throughVote(depthScenario()),
    v = D.testPlayerView(p.depth.test_runs[0], "lin");
  assert.equal(v.own_votes.length, 1);
  assert.ok(!("votes" in v));
  assert.ok(!JSON.stringify(v).includes("守站人私密"));
});
test("多数票产生匹配结局但不裁定案情", () => {
  const p = throughVote(depthScenario());
  assert.deepEqual(
    D.testState(p.depth.test_runs[0]).matching_endings.map((e: any) => e.id),
    ["keeper-ending"],
  );
});
test("平票不任意选择结局", () => {
  const p = throughVote(depthScenario(), true);
  assert.deepEqual(D.testState(p.depth.test_runs[0]).matching_endings, []);
});
test("揭示轮次之前不能揭示材料", () => {
  const p = depthScenario();
  startRun(p);
  assert.throws(() => append(p, "reveal_test_clue", { clue_id: "farewell" }));
});
test("末幕公开材料进入全部玩家投影", () => {
  const p = complete(depthScenario());
  for (const id of ["lin", "keeper"])
    assert.ok(
      D.testPlayerView(p.depth.test_runs[0], id).clues.some(
        (c: any) => c.title === "站台留言",
      ),
    );
});
test("完整模拟测本回放和关闭复盘有效", () => {
  const p = complete(depthScenario());
  validate(p);
  const s = D.testState(p.depth.test_runs[0]);
  assert.ok(s.closed);
  assert.ok(s.summary.includes("未进行真人"));
  assert.equal(s.rounds_completed, 5);
});
test("未完成所有轮次不能关闭", () => {
  const p = depthScenario();
  startRun(p);
  assert.throws(() => append(p, "close_test", { text: "提前结束" }));
});
test("关闭后不能追加事件", () => {
  const p = complete(depthScenario());
  assert.throws(() =>
    append(p, "vote_test", { role_id: "lin", option: "林溪" }),
  );
});
test("整本保存不能伪造新测本", () => {
  const old = depthScenario(),
    p = clone(old);
  startRun(p);
  assert.throws(() => validateTransition(p, old));
});
test("整本保存不能改写固定旧快照", () => {
  const old = complete(depthScenario()),
    p = clone(old);
  p.depth.test_runs[0].snapshot.solution = "篡改";
  assert.throws(() => validateTransition(p, old));
});
test("专业动作也不能改写历史事件", () => {
  const old = complete(depthScenario()),
    p = clone(old);
  p.depth.test_runs[0].events[0].clue_id = "register";
  assert.throws(() => validateTransition(p, old, "vote_test"));
});
test("跳序和错轮事件不能通过回放", () => {
  const p = throughSearch(depthScenario());
  p.depth.test_runs[0].events[0].sequence = 5;
  assert.throws(() => validate(p));
});
test("新机制不改写v0.1.0旧试玩内容", () => {
  const p = depthScenario();
  p.sessions = legacyScenario().sessions;
  const before = clone(p.sessions);
  complete(p);
  assert.deepEqual(p.sessions, before);
  assert.equal(replay(p.sessions[0]).event_count, 0);
});
test("完整阅读本包含各角色正文及机制而非只有摘要", () => {
  const s = D.reading(depthScenario());
  assert.ok(s.includes("你叫林溪"));
  assert.ok(s.includes("你是旧站的守站人"));
  assert.ok(s.includes("每人预算"));
  assert.ok(s.includes("主持解答"));
});
test("共享定义仍拒绝深度专业对象的未知字段", () => {
  const p = depthScenario();
  p.depth.facts[0].unregistered = "错误";
  assert.throws(() => validate(p));
  const q = complete(depthScenario());
  q.depth.test_runs[0].snapshot.depth.briefings[0].unregistered = "错误";
  assert.throws(() => validate(q));
});
