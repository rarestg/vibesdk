import { AgentActionKey, AgentConfig, AgentConstraintConfig, AIModels, AllModels } from './config.types';
import { env } from 'cloudflare:workers';

// Common configs - these are good defaults
const COMMON_AGENT_CONFIGS = {
  screenshotAnalysis: {
    name: AIModels.DISABLED,
    reasoning_effort: 'medium' as const,
    max_tokens: 8000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  realtimeCodeFixer: {
    name: AIModels.GROK_4_1_FAST_NON_REASONING,
    reasoning_effort: 'low' as const,
    max_tokens: 32000,
    temperature: 0.2,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  fastCodeFixer: {
    name: AIModels.DISABLED,
    reasoning_effort: undefined,
    max_tokens: 64000,
    temperature: 0.0,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  templateSelection: {
    name: AIModels.GEMINI_2_5_FLASH_LITE,
    max_tokens: 2000,
    fallbackModel: AIModels.GROK_4_1_FAST_NON_REASONING,
    temperature: 1,
  },
} as const;

const SHARED_IMPLEMENTATION_CONFIG = {
  reasoning_effort: 'low' as const,
  max_tokens: 48000,
  temperature: 1,
  fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
};

//======================================================================================
// ATTENTION! Platform config requires specific API keys and Cloudflare AI Gateway setup.
//======================================================================================
/*
These are the configs used at build.cloudflare.dev
You may need to provide API keys for these models in your environment or use
Cloudflare AI Gateway unified billing for seamless model access without managing multiple keys.
*/
const PLATFORM_AGENT_CONFIG: AgentConfig = {
  ...COMMON_AGENT_CONFIGS,
  blueprint: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 20000,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
    temperature: 1.0,
  },
  projectSetup: {
    name: AIModels.GROK_4_1_FAST,
    reasoning_effort: 'medium',
    max_tokens: 8000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  phaseGeneration: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'medium',
    max_tokens: 8000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  firstPhaseImplementation: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    ...SHARED_IMPLEMENTATION_CONFIG,
  },
  phaseImplementation: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    ...SHARED_IMPLEMENTATION_CONFIG,
  },
  conversationalResponse: {
    name: AIModels.GROK_4_1_FAST,
    reasoning_effort: 'low',
    max_tokens: 4000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  deepDebugger: {
    name: AIModels.GROK_4_1_FAST,
    reasoning_effort: 'high',
    max_tokens: 8000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  fileRegeneration: {
    name: AIModels.GROK_4_1_FAST_NON_REASONING,
    reasoning_effort: 'low',
    max_tokens: 16000,
    temperature: 0.0,
    fallbackModel: AIModels.GROK_CODE_FAST_1,
  },
  agenticProjectBuilder: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'medium',
    max_tokens: 8000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
};

//======================================================================================
// Default Gemini-only config (most likely used in your deployment)
//======================================================================================
/* These are the default out-of-the box gemini-only models used when PLATFORM_MODEL_PROVIDERS is not set */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  ...COMMON_AGENT_CONFIGS,
  templateSelection: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    max_tokens: 2000,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
    temperature: 1,
  },
  blueprint: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 64000,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
    temperature: 1,
  },
  projectSetup: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 48000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  phaseGeneration: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 48000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  firstPhaseImplementation: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 48000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  phaseImplementation: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 48000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  conversationalResponse: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 8000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  deepDebugger: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 16000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  fileRegeneration: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 32000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
  agenticProjectBuilder: {
    name: AIModels.GEMINI_3_PRO_PREVIEW,
    reasoning_effort: 'high',
    max_tokens: 16000,
    temperature: 1,
    fallbackModel: AIModels.GEMINI_3_FLASH_PREVIEW,
  },
};

export const AGENT_CONFIG: AgentConfig = env.PLATFORM_MODEL_PROVIDERS ? PLATFORM_AGENT_CONFIG : DEFAULT_AGENT_CONFIG;

export const AGENT_CONSTRAINTS: Map<AgentActionKey, AgentConstraintConfig> = new Map([
  [
    'fastCodeFixer',
    {
      allowedModels: new Set([AIModels.DISABLED]),
      enabled: true,
    },
  ],
  [
    'realtimeCodeFixer',
    {
      allowedModels: new Set([AIModels.DISABLED]),
      enabled: true,
    },
  ],
  [
    'fileRegeneration',
    {
      allowedModels: new Set(AllModels),
      enabled: true,
    },
  ],
  [
    'phaseGeneration',
    {
      allowedModels: new Set(AllModels),
      enabled: true,
    },
  ],
  [
    'projectSetup',
    {
      allowedModels: new Set(AllModels),
      enabled: true,
    },
  ],
  [
    'conversationalResponse',
    {
      allowedModels: new Set(AllModels),
      enabled: true,
    },
  ],
  [
    'templateSelection',
    {
      allowedModels: new Set(AllModels),
      enabled: true,
    },
  ],
]);
