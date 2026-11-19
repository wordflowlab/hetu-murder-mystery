# 操作地图

由正式清单生成，执行前发现当前安装版Schema。

| 动作 | 用途 | 必填参数 | 效果 |
| --- | --- | --- | --- |
| list_projects | 查找专业工程 |  | read |
| get_project | 读取固定专业工程 | object_id | read |
| save_project | 保存专业工程 | expected_revision, expected_sha256, operation_key, content | managed_write |
| put_role | 维护角色资料 | object_id, expected_revision, expected_sha256, operation_key, role | managed_write |
| remove_role | 移除角色资料 | object_id, expected_revision, expected_sha256, operation_key, role_id | managed_write |
| put_act | 维护分幕 | object_id, expected_revision, expected_sha256, operation_key, act | managed_write |
| remove_act | 移除分幕 | object_id, expected_revision, expected_sha256, operation_key, act_id | managed_write |
| put_clue | 维护线索 | object_id, expected_revision, expected_sha256, operation_key, clue | managed_write |
| remove_clue | 移除线索 | object_id, expected_revision, expected_sha256, operation_key, clue_id | managed_write |
| check_scenario | 检查角色、幕次与发放结构 | object_id | read |
| player_view | 读取指定角色阶段资料 | object_id, role_id, act_id | read |
| export_player | 导出指定角色静态资料 | object_id, role_id, act_id | read |
| export_gm | 导出完整主持手册 | object_id | read |
| start_session | 固定当前工程开始试玩 | object_id, expected_revision, expected_sha256, operation_key, session_id, label, mode, assignments | managed_write |
| release_clue | 记录当前幕线索发放 | object_id, expected_revision, expected_sha256, operation_key, session_id, clue_id | managed_write |
| skip_clue | 说明跳过当前幕线索 | object_id, expected_revision, expected_sha256, operation_key, session_id, clue_id, reason | managed_write |
| advance_act | 核对必发线索后推进一幕 | object_id, expected_revision, expected_sha256, operation_key, session_id | managed_write |
| record_guess | 记录指定角色推测 | object_id, expected_revision, expected_sha256, operation_key, session_id, role_id, text | managed_write |
| close_session | 记录最终复盘 | object_id, expected_revision, expected_sha256, operation_key, session_id, text | managed_write |
| session_view | 回放固定试玩 | object_id, session_id | read |
| session_player_view | 回读试玩角色已获资料 | object_id, session_id, role_id | read |
| export_session_player | 导出试玩角色已获资料 | object_id, session_id, role_id | read |
| get_source | 读取固定来源 | object_id, source_index | read |
| get_basis | 读取固定专业依据 | object_id, basis_index | read |
| compare_versions | 比较固定修订 | object_id, from_revision, to_revision | read |
| export_project | 导出固定专业报告 | object_id, format | read |
| build_context | 准备有界创作上下文 | object_id, goal, max_chars | read |
| create_handoff | 准备精确AI交接 | object_id, goal | read |
| get_operation | 回读原操作 | operation_key | read |
| enable_depth | 明确启用完整创作结构 | object_id, expected_revision, expected_sha256, operation_key | managed_write |
| put_fact | 维护案件事实 | object_id, expected_revision, expected_sha256, operation_key, fact | managed_write |
| remove_fact | 移除案件事实 | object_id, expected_revision, expected_sha256, operation_key, fact_id | managed_write |
| put_briefing | 维护角色分幕正文 | object_id, expected_revision, expected_sha256, operation_key, briefing | managed_write |
| remove_briefing | 移除角色分幕正文 | object_id, expected_revision, expected_sha256, operation_key, briefing_id | managed_write |
| put_deduction | 维护证据推导 | object_id, expected_revision, expected_sha256, operation_key, deduction | managed_write |
| remove_deduction | 移除证据推导 | object_id, expected_revision, expected_sha256, operation_key, deduction_id | managed_write |
| put_clue_rule | 维护搜证交换规则 | object_id, expected_revision, expected_sha256, operation_key, clue_rule | managed_write |
| remove_clue_rule | 移除搜证交换规则 | object_id, expected_revision, expected_sha256, operation_key, clue_rule_id | managed_write |
| put_round | 维护机制轮次 | object_id, expected_revision, expected_sha256, operation_key, round | managed_write |
| remove_round | 移除机制轮次 | object_id, expected_revision, expected_sha256, operation_key, round_id | managed_write |
| put_ending | 维护候选结局 | object_id, expected_revision, expected_sha256, operation_key, ending | managed_write |
| remove_ending | 移除候选结局 | object_id, expected_revision, expected_sha256, operation_key, ending_id | managed_write |
| put_review | 维护固定测本意见 | object_id, expected_revision, expected_sha256, operation_key, review | managed_write |
| remove_review | 移除固定测本意见 | object_id, expected_revision, expected_sha256, operation_key, review_id | managed_write |
| briefing_basis | 读取角色正文依据 | object_id, role_id, act_id, known_fact_ids | read |
| deduction_basis | 读取证据推导依据 | object_id, deduction | read |
| depth_target_digest | 读取完整创作意见摘要 | object_id, target_kind, target_id | read |
| check_depth | 核对完整创作覆盖与过期依据 | object_id | read |
| deduction_view | 按可见证据核对推导前提 | object_id, deduction_id, clue_ids | read |
| start_test | 固定完整作者版本开始机制测本 | object_id, expected_revision, expected_sha256, operation_key, test_id, label, mode, assignments | managed_write |
| search_test_clue | 按角色搜证并原子扣预算 | object_id, expected_revision, expected_sha256, operation_key, test_id, role_id, clue_id | managed_write |
| share_test_clue | 交换实际持有线索 | object_id, expected_revision, expected_sha256, operation_key, test_id, role_id, target_role_id, clue_id | managed_write |
| reveal_test_clue | 按揭示轮次记录线索发放 | object_id, expected_revision, expected_sha256, operation_key, test_id, clue_id | managed_write |
| vote_test | 记录本轮角色一票 | object_id, expected_revision, expected_sha256, operation_key, test_id, role_id, option | managed_write |
| advance_test_round | 完成当前轮次 | object_id, expected_revision, expected_sha256, operation_key, test_id | managed_write |
| skip_test_round | 明确记录跳过轮次 | object_id, expected_revision, expected_sha256, operation_key, test_id, reason | managed_write |
| close_test | 结束完整测本并复盘 | object_id, expected_revision, expected_sha256, operation_key, test_id, text | managed_write |
| test_view | 回放固定版本机制测本 | object_id, test_id | read |
| test_player_view | 读取固定测本角色资料 | object_id, test_id, role_id | read |
| export_depth_player | 导出完整分幕角色本 | object_id, role_id, act_id | read |
| export_depth_gm | 导出完整主持与机制本 | object_id | read |
| export_test_player | 导出固定测本玩家资料 | object_id, test_id, role_id | read |
