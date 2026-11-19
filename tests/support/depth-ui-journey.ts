import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { base, selection, sha } from "./scenario.ts";
export async function professionalJourney({
  c,
  page,
  tab,
  record,
  exports,
  app,
}: any) {
  const click = async (name: string) => {
    await page.getByRole("button", { name, exact: true }).click();
    await expect(page.locator('.shell>p[role="status"]')).toContainText(
      "已保存",
    );
  };
  await tab(0);
  await expect(page.locator(".reading")).toContainText("第一幕");
  await tab(1);
  await expect(
    page.getByRole("heading", { name: "证据与推导", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "核对这条推导", exact: true })
    .last()
    .click();
  await expect(page.getByLabel("固定依据")).toContainText("名册");
  await page.getByRole("button", { name: "关闭依据" }).click();
  await tab(2);
  await page.getByLabel("玩家角色").selectOption("lin");
  await page.getByLabel("阅读幕次").selectOption("arrival");
  await page
    .getByRole("button", { name: "阅读完整角色本", exact: true })
    .click();
  const frame = page.frameLocator('iframe[title="固定角色资料"]');
  await expect(frame.locator("body")).toContainText("你叫林溪");
  await expect(frame.locator("body")).not.toContainText("守站人私密");
  await expect(frame.locator("body")).not.toContainText("第二幕秘密");
  await expect(frame.locator("body")).not.toContainText("主持专有");
  await page
    .getByRole("button", { name: "导出完整角色本", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("文件已按固定修订导出");
  await tab(3);
  await click("开始完整模拟测本");
  await expect(page.getByText("第一轮搜证", { exact: true })).toBeVisible();
  await page.getByLabel("行动角色").selectOption("lin");
  await page.getByLabel("行动线索").selectOption("seal");
  await click("记录本次搜证");
  await page.getByLabel("行动线索").selectOption("letter");
  await click("记录本次搜证");
  await click("完成当前轮次");
  await expect(page.getByText("线索交换", { exact: true })).toBeVisible();
  await page.getByLabel("行动线索").selectOption("letter");
  await page.getByLabel("交换给谁").selectOption("keeper");
  await click("记录线索交换");
  await click("完成当前轮次");
  await expect(page.getByText("开门后的搜证", { exact: true })).toBeVisible();
  await page.getByLabel("行动角色").selectOption("keeper");
  await page.getByLabel("行动线索").selectOption("register");
  await click("记录本次搜证");
  await click("完成当前轮次");
  await expect(page.getByText("证据与投票", { exact: true })).toBeVisible();
  await page.getByLabel("投票选项").selectOption("守站人");
  await click("记录本轮投票");
  await page.getByLabel("行动角色").selectOption("lin");
  await click("记录本轮投票");
  await click("完成当前轮次");
  await expect(page.getByText("末幕留言", { exact: true })).toBeVisible();
  await page.getByLabel("行动线索").selectOption("farewell");
  await click("记录本次揭示");
  await click("完成当前轮次");
  await page
    .getByLabel("测本记录")
    .fill("原创模拟复盘，角色知情范围保持；真人体验仍待实际测本。");
  await click("结束并保存完整复盘");
  await expect(page.getByText("测本已关闭", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "核对测本角色资料", exact: true })
    .click();
  await expect(
    page.frameLocator('iframe[title="固定测本角色资料"]').locator("body"),
  ).not.toContainText("守站人私密");
  await tab(4);
  await page.getByText("为具体目标留意见", { exact: true }).click();
  await page.getByLabel("意见目标").selectOption("briefing:lin-arrival");
  await page
    .getByLabel("专业意见")
    .fill("第一幕保留林溪本人知情范围，后续按明确线索推进。");
  await click("保存固定意见");
  await page
    .getByRole("button", { name: "导出完整主持本", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("文件已按固定修订导出");
  const r = await c.invoke("get_project", {
      object_id: record.object.object_id,
    }),
    expected = await c.invoke("export_depth_gm", {
      ...selection(r),
      max_bytes: 65536,
    });
  expect(expected.next_offset).toBeNull();
  expect(sha(await readFile(path.join(exports, expected.filename)))).toBe(
    expected.sha256,
  );
  await page
    .getByRole("button", { name: "准备固定创作交接", exact: true })
    .click();
  await expect(page.getByLabel("固定依据")).toContainText("目标");
  await page.getByRole("button", { name: "关闭依据" }).click();
  await page.getByRole("button", { name: "让AI处理", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已复制");
  expect(
    await app.evaluate(({ clipboard }: any) => clipboard.readText()),
  ).toContain("org.wordflowlab.murder-mystery");
}
export async function finishJourney({ c, page, record }: any) {
  let r = await c.invoke("get_project", { object_id: record.object.object_id });
  const fact = r.object.content.depth.facts.find((x: any) => x.id === "key");
  r = await c.invoke("put_fact", {
    ...base(r, "ui-fact-rework"),
    fact: { ...fact, text: fact.text + " 复盘后明确了发生先后。" },
  });
  const frozen = JSON.stringify(r.object.content.depth.test_runs);
  await page.getByRole("button", { name: "刷新", exact: true }).click();
  await page.getByRole("button", { name: "玩家预览", exact: true }).click();
  await page.getByLabel("玩家角色").selectOption("lin");
  await expect(
    page.getByText("知情依据变化，需复核", { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "重新固定该角色正文", exact: true })
    .first()
    .click();
  await expect(page.getByRole("status")).toContainText("已保存");
  const next = await c.invoke("get_project", { object_id: r.object.object_id });
  expect(JSON.stringify(next.object.content.depth.test_runs)).toBe(frozen);
  expect(
    (await c.invoke("check_depth", selection(next))).stale_briefing_ids,
  ).not.toContain("lin-arrival");
}
