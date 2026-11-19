import { test } from "node:test";
import assert from "node:assert/strict";
import { readContext } from "./support/creative.ts";
import { sha } from "./support/import.ts";

test("完整专业资料沿UTF-8边界分块回读并核对原字节", async () => {
  const parts = ["旧站😀\n".repeat(700), "每幕完整角色正文。\n".repeat(800), "末幕。"];
  const body = parts.join(""), digest = sha(body); let offset = 0, n = 0;
  const c = { ok: async (_: string, input: any) => {
    assert.equal(input.range?.byte_start ?? 0, offset);
    const content = parts[n++], start = offset; offset += Buffer.byteLength(content);
    const complete = n === parts.length;
    return {content, sha256: digest, range: {byte_start:start,byte_end:offset}, size_bytes:Buffer.byteLength(body), complete,
      next_range: complete ? null : {byte_start:offset,byte_end:Buffer.byteLength(body)}};
  }};
  const result = await readContext(c, {}, {sha256:digest,context_ref:{}});
  assert.equal(result.content, body); assert.equal(result.pages, 3);
});

test("来源摘要相同但返回字节被篡改时拒绝", async () => {
  const c = {ok: async () => ({content:"假",sha256:sha("原"),range:{byte_start:0,byte_end:3},size_bytes:3,complete:true,next_range:null})};
  await assert.rejects(readContext(c, {}, {sha256:sha("原"),context_ref:{}}));
});
