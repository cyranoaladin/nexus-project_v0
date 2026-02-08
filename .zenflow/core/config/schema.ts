import { z } from 'zod';

// Helper function to convert snake_case to camelCase
const toCamelCase = (str: string): string => {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

// Schema that accepts snake_case from JSON but outputs camelCase
export const SyncConfigSchema = z.object({
  enabled: z.boolean().default(true),
  auto_push: z.boolean().default(false),
  max_retries: z.number().int().min(0).max(10).default(3),
  timeout: z.number().int().min(0).default(300),
  conflict_strategy: z.enum(['abort', 'manual']).default('abort'),
  excluded_worktrees: z.array(z.string()).default([]),
  notification_channels: z.array(z.enum(['console', 'log', 'email', 'webhook'])).default(['console', 'log']),
  verification_commands: z.array(z.string()).default([]),
}).transform((data) => ({
  enabled: data.enabled,
  autoPush: data.auto_push,
  maxRetries: data.max_retries,
  timeout: data.timeout,
  conflictStrategy: data.conflict_strategy,
  excludedWorktrees: data.excluded_worktrees,
  notificationChannels: data.notification_channels,
  verificationCommands: data.verification_commands,
}));

export const RulesConfigSchema = z.object({
  directory: z.string().default('.zenflow/rules'),
  auto_load: z.boolean().default(true),
  validation_strict: z.boolean().default(true),
}).transform((data) => ({
  rulesDirectory: data.directory,
  autoLoad: data.auto_load,
  validationStrict: data.validation_strict,
}));

export const WorkflowsConfigSchema = z.object({
  directory: z.string().default('.zenflow/workflows'),
  state_directory: z.string().default('.zenflow/state/executions'),
  max_concurrent: z.number().int().min(1).default(1),
}).transform((data) => ({
  workflowsDirectory: data.directory,
  stateDirectory: data.state_directory,
  maxConcurrent: data.max_concurrent,
}));

export const LoggingConfigSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  directory: z.string().default('.zenflow/logs'),
  rotation: z.enum(['daily', 'weekly', 'size']).default('daily'),
  retention_days: z.number().int().min(1).default(30),
  max_size_mb: z.number().int().min(1).default(100),
  format: z.enum(['json', 'text']).default('text'),
}).transform((data) => ({
  level: data.level,
  directory: data.directory,
  rotation: data.rotation,
  retentionDays: data.retention_days,
  maxSizeMb: data.max_size_mb,
  format: data.format,
}));

export const GitConfigSchema = z.object({
  main_directory: z.string().default('.'),
  worktrees_directory: z.string().default('../'),
  remote: z.string().default('origin'),
  default_branch: z.string().default('main'),
}).transform((data) => ({
  mainDirectory: data.main_directory,
  worktreesDirectory: data.worktrees_directory,
  remote: data.remote,
  defaultBranch: data.default_branch,
}));

const ThemeColorsSchema = z.object({
  brand: z.object({
    primary: z.string(),
    secondary: z.string(),
    accent: z.string(),
    'accent-dark': z.string(),
  }).optional(),
  semantic: z.object({
    success: z.string(),
    warning: z.string(),
    error: z.string(),
    info: z.string(),
  }).optional(),
  neutral: z.record(z.string()).optional(),
  surface: z.record(z.string()).optional(),
});

const ThemeTypographySchema = z.object({
  fontFamily: z.record(z.string()).optional(),
  fontSize: z.record(z.union([z.string(), z.array(z.union([z.string(), z.record(z.string())]))])).optional(),
  fontWeight: z.record(z.string()).optional(),
  lineHeight: z.record(z.string()).optional(),
  letterSpacing: z.record(z.string()).optional(),
});

const ThemeSpacingSchema = z.object({
  base: z.string().optional(),
  scale: z.array(z.string()).optional(),
});

const ThemeRadiusSchema = z.object({
  micro: z.string().optional(),
  'card-sm': z.string().optional(),
  card: z.string().optional(),
  full: z.string().optional(),
});

const ThemeConfigSchema = z.object({
  colors: ThemeColorsSchema.optional(),
  typography: ThemeTypographySchema.optional(),
  spacing: ThemeSpacingSchema.optional(),
  radius: ThemeRadiusSchema.optional(),
});

const AccessibilityConfigSchema = z.object({
  wcag: z.enum(['A', 'AA', 'AAA']).optional(),
  contrastRatios: z.object({
    normal: z.string().optional(),
    large: z.string().optional(),
  }).optional(),
});

export const ZenflowSettingsSchema = z.object({
  setup_script: z.string().optional(),
  dev_server_script: z.string().optional(),
  verification_script: z.string().optional(),
  copy_files: z.array(z.string()).optional(),
  theme: ThemeConfigSchema.optional(),
  accessibility: AccessibilityConfigSchema.optional(),
  sync: SyncConfigSchema.default({}),
  rules: RulesConfigSchema.default({}),
  workflows: WorkflowsConfigSchema.default({}),
  logging: LoggingConfigSchema.default({}),
  git: GitConfigSchema.default({}),
}).transform((data) => ({
  setupScript: data.setup_script,
  devServerScript: data.dev_server_script,
  verificationScript: data.verification_script,
  copyFiles: data.copy_files,
  theme: data.theme,
  accessibility: data.accessibility,
  sync: data.sync,
  rules: data.rules,
  workflows: data.workflows,
  logging: data.logging,
  git: data.git,
}));

export type ZenflowSettings = z.infer<typeof ZenflowSettingsSchema>;
export type SyncConfig = z.infer<typeof SyncConfigSchema>;
export type RulesConfig = z.infer<typeof RulesConfigSchema>;
export type WorkflowsConfig = z.infer<typeof WorkflowsConfigSchema>;
export type LoggingConfig = z.infer<typeof LoggingConfigSchema>;
export type GitConfig = z.infer<typeof GitConfigSchema>;
export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;
export type AccessibilityConfig = z.infer<typeof AccessibilityConfigSchema>;
