export interface DifferentialPricingDraft {
  activityName?: string;
  productIds: string[];
  pricingRuleDescription?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface DifferentialPricingAutomationInput {
  draft: DifferentialPricingDraft;
  confirmSubmit: false;
}

export function createEmptyDifferentialPricingDraft(): DifferentialPricingDraft {
  return { productIds: [] };
}
