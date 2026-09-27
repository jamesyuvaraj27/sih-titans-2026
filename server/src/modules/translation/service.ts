export interface TranslationStatus {
  bhashiniConfigured: boolean;
  provider: 'bhashini' | 'local_dictionary';
  supportedLanguages: string[];
  pipelineDetails?: {
    inferenceEndpoint?: string;
  };
}

export function getTranslationStatus(): TranslationStatus {
  const userId = process.env.BHASHINI_USER_ID;
  const apiKey = process.env.BHASHINI_API_KEY;
  const pipelineId = process.env.BHASHINI_PIPELINE_ID;

  const isConfigured = Boolean(userId && apiKey && pipelineId);

  return {
    bhashiniConfigured: isConfigured,
    provider: isConfigured ? 'bhashini' : 'local_dictionary',
    supportedLanguages: ['en', 'hi', 'te'],
    pipelineDetails: isConfigured
      ? {
          inferenceEndpoint: process.env.BHASHINI_INFERENCE_URL || 'https://dhruva-api.bhashini.gov.in/services/inference/pipeline',
        }
      : undefined,
  };
}
