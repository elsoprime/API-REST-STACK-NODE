import { existsSync } from 'node:fs';
import path from 'node:path';

import { config as loadDotenvConfig } from 'dotenv';

export type SupportedAppEnvironment = 'development' | 'test' | 'production';

interface EnvironmentFileSelectionOptions {
  cwd?: string;
  explicitPath?: string;
  nodeEnv?: string;
  fileExists?: (filePath: string) => boolean;
}

interface EnvironmentLoaderDependencies {
  cwd?: string;
  nodeEnv?: string;
  explicitPath?: string;
  fileExists?: (filePath: string) => boolean;
  dotenvConfig?: typeof loadDotenvConfig;
}

const APP_ENVIRONMENT_FILES = {
  development: '.env.dev',
  test: null,
  production: '.env'
} as const satisfies Record<SupportedAppEnvironment, string | null>;

const DEFAULT_DEVELOPMENT_ENVIRONMENT: SupportedAppEnvironment = 'development';
const LOADED_ENV_FILE_SENTINEL = '__APP_ENV_FILE_LOADED__';

function isSupportedAppEnvironment(nodeEnv: string): nodeEnv is SupportedAppEnvironment {
  return nodeEnv === 'development' || nodeEnv === 'test' || nodeEnv === 'production';
}

function normalizeNodeEnvironment(nodeEnv?: string): SupportedAppEnvironment {
  if (!nodeEnv) {
    return DEFAULT_DEVELOPMENT_ENVIRONMENT;
  }

  if (isSupportedAppEnvironment(nodeEnv)) {
    return nodeEnv;
  }

  return DEFAULT_DEVELOPMENT_ENVIRONMENT;
}

export function resolveEnvironmentFilePath(
  options: EnvironmentFileSelectionOptions = {}
): string | null {
  const cwd = options.cwd ?? process.cwd();
  const explicitPath = options.explicitPath ?? process.env.DOTENV_CONFIG_PATH;
  const fileExists = options.fileExists ?? existsSync;

  if (explicitPath) {
    const resolvedExplicitPath = path.resolve(cwd, explicitPath);
    return fileExists(resolvedExplicitPath) ? resolvedExplicitPath : null;
  }

  const normalizedNodeEnv = normalizeNodeEnvironment(options.nodeEnv ?? process.env.NODE_ENV);
  const environmentFileName = APP_ENVIRONMENT_FILES[normalizedNodeEnv];

  if (!environmentFileName) {
    return null;
  }

  const resolvedEnvironmentFilePath = path.resolve(cwd, environmentFileName);
  return fileExists(resolvedEnvironmentFilePath) ? resolvedEnvironmentFilePath : null;
}

export function loadEnvironmentVariables(dependencies: EnvironmentLoaderDependencies = {}): void {
  if (process.env[LOADED_ENV_FILE_SENTINEL] === 'true') {
    return;
  }

  const explicitPath = dependencies.explicitPath ?? process.env.DOTENV_CONFIG_PATH;
  const resolvedEnvironmentFilePath = resolveEnvironmentFilePath({
    cwd: dependencies.cwd,
    explicitPath,
    nodeEnv: dependencies.nodeEnv,
    fileExists: dependencies.fileExists
  });

  if (!resolvedEnvironmentFilePath) {
    if (explicitPath) {
      throw new Error(`Environment file not found: ${path.resolve(dependencies.cwd ?? process.cwd(), explicitPath)}`);
    }

    process.env[LOADED_ENV_FILE_SENTINEL] = 'true';
    return;
  }

  const dotenvConfig = dependencies.dotenvConfig ?? loadDotenvConfig;

  dotenvConfig({
    path: resolvedEnvironmentFilePath,
    override: false
  });

  process.env[LOADED_ENV_FILE_SENTINEL] = 'true';
}
