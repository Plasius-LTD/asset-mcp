import { describe, expect, it } from "vitest";
import { ASSET_MCP_TOOL_NAMES, createAssetMcpRequestEnvelope, listAssetMcpToolDefinitions } from "../src/index.js";

const LEGACY_TOOL_NAMES = [
  "asset.create_job",
  "asset.upload_source",
  "asset.generate_candidate",
  "asset.process",
  "asset.render_review",
  "asset.review",
  "asset.promote",
  "asset.rollback",
  "asset.get_manifest",
] as const;

const LEGACY_DEFINITIONS_JSON = JSON.stringify([
  {
    name: "asset.create_job",
    description: "Create a governed asset pipeline job.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.upload_source",
    description: "Attach source files or source blob references to a job.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.generate_candidate",
    description: "Generate an AI-owned asset candidate from a bounded spec.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.process",
    description: "Run validation, cleanup, LOD, collision, texture, or packaging steps.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.render_review",
    description: "Generate renderer screenshot and debug capture review artifacts.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.review",
    description: "Run AI review and normalize review findings.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.promote",
    description: "Promote an approved candidate to an immutable runtime asset version.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.rollback",
    description: "Move a runtime channel back to a previously promoted version.",
    mutatesState: true,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
  {
    name: "asset.get_manifest",
    description: "Read a runtime or job manifest.",
    mutatesState: false,
    requiredCapability: "asset.pipeline.mcp.manage",
  },
]);

describe("asset mcp", () => {
  it("lists governed MCP tools", () => {
    const tools = listAssetMcpToolDefinitions();
    expect(tools.map((tool) => tool.name)).toEqual(ASSET_MCP_TOOL_NAMES);
    expect(tools.find((tool) => tool.name === "asset.get_manifest")?.mutatesState).toBe(false);
  });

  it("preserves every legacy dotted tool name and definition byte-for-byte", () => {
    expect(ASSET_MCP_TOOL_NAMES).toEqual(LEGACY_TOOL_NAMES);
    expect(JSON.stringify(listAssetMcpToolDefinitions())).toBe(LEGACY_DEFINITIONS_JSON);
  });

  it("creates request envelopes", () => {
    const envelope = createAssetMcpRequestEnvelope("asset.process", "req-1", { jobId: "job-1" });
    expect(envelope.toolName).toBe("asset.process");
    expect(Object.isFrozen(envelope)).toBe(true);
  });

  it("rejects invalid MCP request envelopes", () => {
    expect(() => createAssetMcpRequestEnvelope("asset.delete" as "asset.process", "req-1", {})).toThrow(/Unsupported/);
    expect(() => createAssetMcpRequestEnvelope("asset.process", " ", {})).toThrow(/requestId/);
  });
});
