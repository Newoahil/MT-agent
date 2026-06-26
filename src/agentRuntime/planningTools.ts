export const PRE_CONFIRMATION_PLANNING_TOOLS = new Set(['rental.priceChange', 'rental.specRemovePlan', 'rental.newLinkBatchPlan']);

export function isPreConfirmationPlanningTool(toolName: string): boolean {
  return PRE_CONFIRMATION_PLANNING_TOOLS.has(toolName);
}
