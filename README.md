# pi-superpowers-support

A pi extension that provides **TodoWrite**, **Task**, and **Skill** tools for official [superpowers](https://github.com/obra/superpowers) compatibility.

## Why This Extension Is Needed

pi 内置只有 4 个工具：`read`, `bash`, `edit`, `write`。

superpowers 需要以下工具：

| 工具 | pi 内置 | superpowers 需要 | 来源 |
|------|---------|-----------------|------|
| TodoWrite | ❌ | ✅ | 本扩展 |
| Task | ❌ | ✅ | 本扩展 (Agent 别名) |
| Skill | ❌ | ✅ | 本扩展 |
| Agent | ❌ | ✅ | `@tintinweb/pi-subagents` |

### 为什么需要 Skill 工具？

superpowers 的 `using-superpowers/SKILL.md` 明确要求：

1. **"Use the `Skill` tool"** - 必须使用 Skill 工具加载 skills
2. **"Never use the Read tool on skill files"** - 禁止用 read 工具

虽然 pi 原生支持 skill 发现（系统提示列出 skills），但 superpowers 的流程图和工作流设计依赖于调用 `Skill` 工具。

## Installation

```bash
# 1. Install superpowers (official)
pi install https://github.com/obra/superpowers

# 2. Install pi-subagents (for Task/Agent tool)
pi install npm:@tintinweb/pi-subagents

# 3. This extension is auto-loaded from ~/.pi/agent/extensions/
```

## Tools Provided

### TodoWrite

Track tasks with status:

```
TodoWrite({
  todos: [
    { id: "1", content: "Design API", status: "pending", priority: "high" },
    { id: "2", content: "Implement", status: "in_progress" },
    { id: "3", content: "Write tests", status: "completed" }
  ]
})
```

### Task

Dispatch subagents (alias for Agent):

```
Task({
  subagent_type: "Explore",
  prompt: "Find all auth-related files",
  description: "Find auth files",
  run_in_background: true
})
```

### Skill

Load skill content:

```
Skill({ skill: "brainstorming" })
Skill({ skill: "test-driven-development" })
```

## Commands

| Command | Description |
|---------|-------------|
| `/todos` | Show current todo list |
| `/todo-clear` | Clear all todos |

## Available Skills (from superpowers)

- brainstorming, test-driven-development, systematic-debugging
- writing-plans, executing-plans, subagent-driven-development
- dispatching-parallel-agents, using-git-worktrees
- finishing-a-development-branch, requesting-code-review
- receiving-code-review, verification-before-completion, writing-skills

## License

MIT
