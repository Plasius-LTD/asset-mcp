import { describe, expect, it } from "vitest";
import { ASSET_MCP_TOOL_NAMES, createAssetMcpRequestEnvelope, listAssetMcpToolDefinitions } from "../src/index.js";

describe("asset mcp", () => {
  it("lists governed MCP tools", () => {
    const tools = listAssetMcpToolDefinitions();
    expect(tools.map((tool) => tool.name)).toEqual(ASSET_MCP_TOOL_NAMES);
    expect(tools.find((tool) => tool.name === "asset.get_manifest")?.mutatesState).toBe(false);
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
