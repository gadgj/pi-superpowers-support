/**
 * pi-superpowers-support — A pi extension providing TodoWrite, Task, and Skill tools
 * for official superpowers (obra/superpowers) compatibility.
 *
 * Tools:
 *   TodoWrite  — Task tracking with status (pending, in_progress, completed)
 *   Task       — Subagent dispatch (alias for Agent tool if pi-subagents is installed)
 *   Skill      — Load skill content by name (superpowers requires this, not read tool)
 *
 * Commands:
 *   /todos     — Show current todos
 *   /todo-clear — Clear all todos
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, basename } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type, type Static } from "@sinclair/typebox";

// ============================================================================
// Types
// ============================================================================

type TodoStatus = "pending" | "in_progress" | "completed";

interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
  priority?: "high" | "medium" | "low";
}

interface SkillMeta {
  name: string;
  description?: string;
  path: string;
}

// ============================================================================
// TodoWrite Tool
// ============================================================================

const TodoWriteSchema = Type.Object({
  todos: Type.Array(Type.Object({
    id: Type.String({ description: "Unique identifier for the todo item" }),
    content: Type.String({ description: "The content/description of the todo item" }),
    status: Type.Union([
      Type.Literal("pending"),
      Type.Literal("in_progress"),
      Type.Literal("completed"),
    ], { description: "Status of the todo item" }),
    priority: Type.Optional(Type.Union([
      Type.Literal("high"),
      Type.Literal("medium"),
      Type.Literal("low"),
    ], { description: "Priority level (optional)" })),
  })),
});

type TodoWriteInput = Static<typeof TodoWriteSchema>;

let todos: TodoItem[] = [];

function formatTodos(): string {
  if (todos.length === 0) return "No todos. Use TodoWrite to create tasks.";

  const statusIcon = (s: TodoStatus) => {
    switch (s) {
      case "completed": return "✅";
      case "in_progress": return "🔄";
      case "pending": return "⬜";
    }
  };

  const priorityLabel = (p?: "high" | "medium" | "low") => p ? `[${p.toUpperCase()}] ` : "";

  const lines = todos.map((t, i) => `${i + 1}. ${statusIcon(t.status)} ${priorityLabel(t.priority)}${t.content}`);
  const completed = todos.filter(t => t.status === "completed").length;

  return `Todos (${completed}/${todos.length} completed):\n${lines.join("\n")}`;
}

function registerTodoWriteTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "TodoWrite",
    label: "TodoWrite",
    description: "Create, update, or replace the todo list for tracking task progress. Use this to track implementation tasks from plans.",
    promptSnippet: "Track tasks with status (pending, in_progress, completed)",
    promptGuidelines: [
      "Use TodoWrite when starting a multi-step task to track progress.",
      "Update todo status as you work through tasks: mark in_progress when starting, completed when done.",
    ],
    parameters: TodoWriteSchema,
    async execute(_toolCallId, params: TodoWriteInput) {
      todos = params.todos.map(t => ({
        id: t.id,
        content: t.content,
        status: t.status,
        priority: t.priority,
      }));
      return {
        content: [{ type: "text", text: formatTodos() }],
        details: { todoCount: todos.length },
      };
    },
  });
}

// ============================================================================
// Task Tool (Subagent Dispatch)
// ============================================================================

const TaskSchema = Type.Object({
  subagent_type: Type.String({ description: "Type of subagent to dispatch (e.g., 'general-purpose', 'Explore', 'Plan')" }),
  prompt: Type.String({ description: "The task prompt for the subagent" }),
  description: Type.String({ description: "Short 3-5 word summary of the task" }),
  model: Type.Optional(Type.String({ description: "Model to use (provider/modelId or fuzzy name)" })),
  thinking: Type.Optional(Type.String({ description: "Thinking level: off, minimal, low, medium, high, xhigh" })),
  max_turns: Type.Optional(Type.Number({ description: "Maximum agentic turns" })),
  run_in_background: Type.Optional(Type.Boolean({ description: "Run without blocking" })),
  resume: Type.Optional(Type.String({ description: "Agent ID to resume a previous session" })),
  isolated: Type.Optional(Type.Boolean({ description: "No extension/MCP tools" })),
  inherit_context: Type.Optional(Type.Boolean({ description: "Fork parent conversation into agent" })),
});

type TaskInput = Static<typeof TaskSchema>;

function registerTaskTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "Task",
    label: "Task",
    description: "Dispatch a subagent to handle a specific task. Alias for Agent tool from pi-subagents. Requires @tintinweb/pi-subagents.",
    promptSnippet: "Dispatch specialized subagent for isolated task execution",
    promptGuidelines: [
      "Use Task when you need to delegate work to a specialized agent with isolated context.",
      "Task tool requires @tintinweb/pi-subagents extension to be installed.",
    ],
    parameters: TaskSchema,
    async execute(_toolCallId, params: TaskInput, signal, onUpdate, ctx) {
      const allTools = pi.getAllTools();
      const agentTool = allTools.find(t => t.name === "Agent");

      if (!agentTool) {
        return {
          content: [{
            type: "text",
            text: "Error: Task tool requires @tintinweb/pi-subagents extension.\n\nInstall with: pi install npm:@tintinweb/pi-subagents\n\nAlternatively, use executing-plans skill for inline execution.",
          }],
          isError: true,
          details: { error: "pi-subagents not installed" },
        };
      }

      const agentParams = {
        subagent_type: params.subagent_type,
        prompt: params.prompt,
        description: params.description,
        model: params.model,
        thinking: params.thinking,
        max_turns: params.max_turns,
        run_in_background: params.run_in_background,
        resume: params.resume,
        isolated: params.isolated,
        inherit_context: params.inherit_context,
      };

      onUpdate?.({ content: [{ type: "text", text: `Dispatching ${params.subagent_type} agent: ${params.description}...` }], details: {} });

      // Note: Task tool is an alias for Agent tool from pi-subagents
      // The LLM should use Agent tool directly if available
      return {
        content: [{
          type: "text",
          text: `Task tool is an alias for Agent tool. Use Agent tool directly with:\n\nAgent({ subagent_type: "${params.subagent_type}", prompt: "...", description: "${params.description}" })\n\nRequires @tintinweb/pi-subagents extension.`,
        }],
        details: { subagent_type: params.subagent_type, description: params.description },
      };
    },
  });
}

// ============================================================================
// Skill Tool
// ============================================================================

const SkillSchema = Type.Object({
  skill: Type.String({ description: "Name of the skill to load (e.g., 'brainstorming', 'test-driven-development')" }),
});

type SkillInput = Static<typeof SkillSchema>;

let skillCache: Map<string, SkillMeta> | null = null;

function discoverSkills(cwd: string): Map<string, SkillMeta> {
  if (skillCache) return skillCache;

  const skills = new Map<string, SkillMeta>();
  const home = homedir();

  const skillPaths = [
    join(home, ".pi", "agent", "skills"),
    join(home, ".pi", "agent", "git"),
    join(cwd, ".pi", "skills"),
    join(cwd, ".agents", "skills"),
  ];

  const gitPackagesDir = join(home, ".pi", "agent", "git");
  if (existsSync(gitPackagesDir)) {
    try {
      const packages = readdirSync(gitPackagesDir, { withFileTypes: true });
      for (const pkg of packages) {
        if (pkg.isDirectory()) {
          const skillsDir = join(gitPackagesDir, pkg.name, "skills");
          if (existsSync(skillsDir)) skillPaths.push(skillsDir);
        }
      }
    } catch {}
  }

  for (const basePath of skillPaths) {
    if (!existsSync(basePath)) continue;
    try {
      const skillDirs = readdirSync(basePath, { withFileTypes: true });
      for (const skillDir of skillDirs) {
        if (!skillDir.isDirectory()) continue;
        const skillFile = join(basePath, skillDir.name, "SKILL.md");
        if (!existsSync(skillFile)) continue;
        try {
          const content = readFileSync(skillFile, "utf-8");
          const meta = parseSkillFrontmatter(content, skillFile);
          if (meta?.name && !skills.has(meta.name)) {
            skills.set(meta.name, meta);
          }
        } catch {}
      }
    } catch {}
  }

  skillCache = skills;
  return skills;
}

function parseSkillFrontmatter(content: string, path: string): SkillMeta | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const meta: SkillMeta = { name: basename(path.replace("/SKILL.md", "")), path };

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "");
      if (key === "name") meta.name = value;
      if (key === "description") meta.description = value;
    }
  }

  return meta;
}

function registerSkillTool(pi: ExtensionAPI) {
  pi.registerTool({
    name: "Skill",
    label: "Skill",
    description: "Load and invoke a skill by name. Skills provide specialized instructions for specific tasks like TDD, debugging, or brainstorming. IMPORTANT: Use this tool instead of read for skill files.",
    promptSnippet: "Load specialized skill instructions for specific workflows",
    promptGuidelines: [
      "Use Skill tool to load skill instructions before starting a task that matches the skill's description.",
      "Common skills: brainstorming, test-driven-development, systematic-debugging, writing-plans.",
      "IMPORTANT: Always use Skill tool to load skills, never use read tool on skill files.",
    ],
    parameters: SkillSchema,
    async execute(_toolCallId, params: SkillInput, _signal, _onUpdate, ctx) {
      const skills = discoverSkills(ctx.cwd);
      const skill = skills.get(params.skill);

      if (!skill) {
        const availableSkills = Array.from(skills.keys()).sort();
        return {
          content: [{
            type: "text",
            text: `Skill "${params.skill}" not found.\n\nAvailable skills:\n${availableSkills.map(s => `  - ${s}`).join("\n")}\n\nInstall superpowers: pi install https://github.com/obra/superpowers`,
          }],
          isError: true,
          details: { requestedSkill: params.skill, availableSkills },
        };
      }

      try {
        const content = readFileSync(skill.path, "utf-8");
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        const skillContent = match ? match[1].trim() : content;

        return {
          content: [{
            type: "text",
            text: `Loaded skill: ${skill.name}\n${skill.description ? `\nDescription: ${skill.description}\n` : ""}\n---\n\n${skillContent}`,
          }],
          details: { skillName: skill.name, skillPath: skill.path },
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Error loading skill "${params.skill}": ${error instanceof Error ? error.message : String(error)}`,
          }],
          isError: true,
          details: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    },
  });
}

// ============================================================================
// Commands
// ============================================================================

function registerCommands(pi: ExtensionAPI) {
  pi.registerCommand("todos", {
    description: "Show current todo list",
    handler: async (_args, ctx) => ctx.ui.notify(formatTodos(), "info"),
  });

  pi.registerCommand("todo-clear", {
    description: "Clear all todos",
    handler: async (_args, ctx) => {
      todos = [];
      ctx.ui.notify("All todos cleared.", "info");
    },
  });
}

// ============================================================================
// Main Extension
// ============================================================================

export default function (pi: ExtensionAPI) {
  registerTodoWriteTool(pi);
  registerTaskTool(pi);
  registerSkillTool(pi);
  registerCommands(pi);

  pi.on("session_start", async () => {
    todos = [];
    skillCache = null;
  });

  pi.on("resources_discover", async () => {
    skillCache = null;
  });
}
