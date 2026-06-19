export const ASSET_MCP_PACKAGE = "@plasius/asset-mcp";
export const ASSET_MCP_CAPABILITY = "asset.pipeline.mcp.manage";

export const ASSET_MCP_TOOL_NAMES = Object.freeze([
  "asset.create_job",
  "asset.upload_source",
  "asset.generate_candidate",
  "asset.process",
  "asset.render_review",
  "asset.review",
  "asset.promote",
  "asset.rollback",
  "asset.get_manifest",
] as const);

export type AssetMcpToolName = typeof ASSET_MCP_TOOL_NAMES[number];

export interface AssetMcpToolDefinition {
  readonly name: AssetMcpToolName;
  readonly description: string;
  readonly mutatesState: boolean;
  readonly requiredCapability: string;
}

export interface AssetMcpRequestEnvelope<TPayload = unknown> {
  readonly toolName: AssetMcpToolName;
  readonly requestId: string;
  readonly payload: TPayload;
}

const TOOL_DESCRIPTIONS: Record<AssetMcpToolName, string> = {
  "asset.create_job": "Create a governed asset pipeline job.",
  "asset.upload_source": "Attach source files or source blob references to a job.",
  "asset.generate_candidate": "Generate an AI-owned asset candidate from a bounded spec.",
  "asset.process": "Run validation, cleanup, LOD, collision, texture, or packaging steps.",
  "asset.render_review": "Generate renderer screenshot and debug capture review artifacts.",
  "asset.review": "Run AI review and normalize review findings.",
  "asset.promote": "Promote an approved candidate to an immutable runtime asset version.",
  "asset.rollback": "Move a runtime channel back to a previously promoted version.",
  "asset.get_manifest": "Read a runtime or job manifest.",
};

export function listAssetMcpToolDefinitions(): readonly AssetMcpToolDefinition[] {
  return Object.freeze(
    ASSET_MCP_TOOL_NAMES.map((name) =>
      Object.freeze({
        name,
        description: TOOL_DESCRIPTIONS[name],
        mutatesState: name !== "asset.get_manifest",
        requiredCapability: ASSET_MCP_CAPABILITY,
      })
    )
  );
}

export function createAssetMcpRequestEnvelope<TPayload>(
  toolName: AssetMcpToolName,
  requestId: string,
  payload: TPayload
): AssetMcpRequestEnvelope<TPayload> {
  if (!ASSET_MCP_TOOL_NAMES.includes(toolName)) {
    throw new Error("Unsupported asset MCP tool name.");
  }
  if (!requestId.trim()) {
    throw new Error("Asset MCP requestId is required.");
  }
  return Object.freeze({ toolName, requestId, payload });
}
