# 剧本杀工坊功能清单

本包拥有专业能力；宿主拥有正文、来源与作者决定。

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

默认流程、边界及验收见 [docs](docs/README.md)。
