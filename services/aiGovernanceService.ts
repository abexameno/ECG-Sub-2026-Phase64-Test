export interface AIModelConfig {
  modelId: string;
  purpose: 'generation' | 'validation' | 'quick_classification';
  maxOutputTokens: number;
  temperature: number;
}

const APPROVED_MODELS: Record<string, AIModelConfig> = {
  'primary_generator': {
    modelId: 'gemini-3.8-flash',
    purpose: 'generation',
    maxOutputTokens: 4096,
    temperature: 0.7,
  },
  'fast_validator': {
    modelId: 'gemini-2.5-flash',
    purpose: 'validation',
    maxOutputTokens: 1024,
    temperature: 0.2,
  }
};

export const AIGovernanceService = {
  getApprovedModel(role: 'primary_generator' | 'fast_validator'): AIModelConfig {
    const config = APPROVED_MODELS[role];
    if (!config) {
      throw new Error(`AI Governance Error: Unauthorized or unknown model role requested: ${role}`);
    }
    return config;
  },

  validateGenerationRequest(modelId: string): boolean {
    const valid = Object.values(APPROVED_MODELS).some(m => m.modelId === modelId);
    if (!valid) {
      throw new Error(`AI Governance Security Violation: Model ${modelId} is not approved for production use.`);
    }
    return true;
  }
};
