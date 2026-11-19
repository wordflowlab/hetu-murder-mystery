export const depthFields = {
  fact: "facts",
  briefing: "briefings",
  deduction: "deductions",
  clue_rule: "clue_rules",
  round: "rounds",
  ending: "endings",
  review: "reviews",
} as const;
export const emptyDepth = () => ({
  version: 1,
  facts: [],
  briefings: [],
  deductions: [],
  clue_rules: [],
  rounds: [],
  endings: [],
  reviews: [],
  test_runs: [],
});
