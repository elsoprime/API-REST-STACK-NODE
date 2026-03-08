import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';

import { loadEnvironmentVariables, resolveEnvironmentFilePath } from '@/config/load-env';

const LOADED_ENV_FILE_SENTINEL = '__APP_ENV_FILE_LOADED__';

describe('load environment configuration', () => {
  it('selects .env.dev by default for development', () => {
    const resolvedPath = resolveEnvironmentFilePath({
      cwd: 'H:/repo',
      nodeEnv: 'development',
      fileExists: () => true
    });

    expect(resolvedPath).toBe(path.resolve('H:/repo', '.env.dev'));
  });

  it('selects .env for production', () => {
    const resolvedPath = resolveEnvironmentFilePath({
      cwd: 'H:/repo',
      nodeEnv: 'production',
      fileExists: () => true
    });

    expect(resolvedPath).toBe(path.resolve('H:/repo', '.env'));
  });

  it('gives priority to DOTENV_CONFIG_PATH', () => {
    const resolvedPath = resolveEnvironmentFilePath({
      cwd: 'H:/repo',
      nodeEnv: 'development',
      explicitPath: '.env.custom',
      fileExists: () => true
    });

    expect(resolvedPath).toBe(path.resolve('H:/repo', '.env.custom'));
  });

  it('returns null when DOTENV_CONFIG_PATH points to a missing file', () => {
    const resolvedPath = resolveEnvironmentFilePath({
      cwd: 'H:/repo',
      explicitPath: '.env.missing',
      fileExists: () => false
    });

    expect(resolvedPath).toBeNull();
  });

  it('does not depend on env files in test mode', () => {
    const resolvedPath = resolveEnvironmentFilePath({
      cwd: 'H:/repo',
      nodeEnv: 'test',
      fileExists: () => true
    });

    expect(resolvedPath).toBeNull();
  });

  it('loads variables from the selected file only once', () => {
    const tempDirectory = mkdtempSync(path.join(os.tmpdir(), 'api-rest-stack-node-env-'));
    const envFilePath = path.join(tempDirectory, '.env.dev');

    writeFileSync(
      envFilePath,
      ['NODE_ENV=development', 'APP_NAME=Loaded From Env File', 'CUSTOM_RUNTIME_FLAG=enabled'].join(
        '\n'
      )
    );

    const originalAppName = process.env.APP_NAME;
    const originalCustomRuntimeFlag = process.env.CUSTOM_RUNTIME_FLAG;
    const originalSentinel = process.env[LOADED_ENV_FILE_SENTINEL];

    delete process.env.APP_NAME;
    delete process.env.CUSTOM_RUNTIME_FLAG;
    delete process.env[LOADED_ENV_FILE_SENTINEL];

    try {
      loadEnvironmentVariables({
        cwd: tempDirectory,
        nodeEnv: 'development'
      });
      loadEnvironmentVariables({
        cwd: tempDirectory,
        nodeEnv: 'development'
      });

      expect(process.env.APP_NAME).toBe('Loaded From Env File');
      expect(process.env.CUSTOM_RUNTIME_FLAG).toBe('enabled');
      expect(process.env[LOADED_ENV_FILE_SENTINEL]).toBe('true');
    } finally {
      if (originalAppName === undefined) {
        delete process.env.APP_NAME;
      } else {
        process.env.APP_NAME = originalAppName;
      }

      if (originalCustomRuntimeFlag === undefined) {
        delete process.env.CUSTOM_RUNTIME_FLAG;
      } else {
        process.env.CUSTOM_RUNTIME_FLAG = originalCustomRuntimeFlag;
      }

      if (originalSentinel === undefined) {
        delete process.env[LOADED_ENV_FILE_SENTINEL];
      } else {
        process.env[LOADED_ENV_FILE_SENTINEL] = originalSentinel;
      }

      rmSync(tempDirectory, { recursive: true, force: true });
    }
  });

  it('throws when DOTENV_CONFIG_PATH points to a missing file', () => {
    const originalSentinel = process.env[LOADED_ENV_FILE_SENTINEL];

    delete process.env[LOADED_ENV_FILE_SENTINEL];

    try {
      expect(() =>
        loadEnvironmentVariables({
          cwd: 'H:/repo',
          explicitPath: '.env.missing',
          fileExists: () => false
        })
      ).toThrow('Environment file not found');
    } finally {
      if (originalSentinel === undefined) {
        delete process.env[LOADED_ENV_FILE_SENTINEL];
      } else {
        process.env[LOADED_ENV_FILE_SENTINEL] = originalSentinel;
      }
    }
  });
});
