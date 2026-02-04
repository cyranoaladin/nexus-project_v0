import * as fs from 'fs';
import * as path from 'path';
import { ZenflowError } from '../../core/utils/errors';

export class ValidationError extends ZenflowError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateRequired(value: any, name: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${name} is required`);
  }
}

export function validateString(value: any, name: string): void {
  validateRequired(value, name);
  if (typeof value !== 'string') {
    throw new ValidationError(`${name} must be a string`);
  }
}

export function validateNumber(value: any, name: string): void {
  validateRequired(value, name);
  const num = Number(value);
  if (isNaN(num)) {
    throw new ValidationError(`${name} must be a number`);
  }
}

export function validateBoolean(value: any, name: string): void {
  if (typeof value !== 'boolean') {
    throw new ValidationError(`${name} must be a boolean`);
  }
}

export function validateEnum(value: any, name: string, allowedValues: string[]): void {
  validateRequired(value, name);
  if (!allowedValues.includes(value)) {
    throw new ValidationError(
      `${name} must be one of: ${allowedValues.join(', ')}`
    );
  }
}

export function validatePath(value: string, name: string, mustExist: boolean = false): void {
  validateString(value, name);
  
  if (path.isAbsolute(value)) {
    throw new ValidationError(`${name} must be a relative path, not absolute`);
  }

  if (value.includes('..')) {
    throw new ValidationError(`${name} must not contain '..' (path traversal)`);
  }

  if (mustExist && !fs.existsSync(value)) {
    throw new ValidationError(`${name} does not exist: ${value}`);
  }
}

export function validateFilePath(value: string, name: string, mustExist: boolean = false): void {
  validatePath(value, name, mustExist);
  
  if (mustExist) {
    const stats = fs.statSync(value);
    if (!stats.isFile()) {
      throw new ValidationError(`${name} is not a file: ${value}`);
    }
  }
}

export function validateDirectoryPath(value: string, name: string, mustExist: boolean = false): void {
  validatePath(value, name, mustExist);
  
  if (mustExist) {
    const stats = fs.statSync(value);
    if (!stats.isDirectory()) {
      throw new ValidationError(`${name} is not a directory: ${value}`);
    }
  }
}

export function validateBranchName(value: string, name: string = 'Branch name'): void {
  validateString(value, name);
  
  if (value.includes(' ')) {
    throw new ValidationError(`${name} must not contain spaces`);
  }
  
  if (value.startsWith('-') || value.startsWith('.')) {
    throw new ValidationError(`${name} must not start with '-' or '.'`);
  }
  
  const invalidChars = /[~^:?*\[\]\\]/;
  if (invalidChars.test(value)) {
    throw new ValidationError(`${name} contains invalid characters`);
  }
}

export function validatePattern(value: string, name: string, pattern: RegExp): void {
  validateString(value, name);
  
  if (!pattern.test(value)) {
    throw new ValidationError(`${name} does not match required pattern: ${pattern}`);
  }
}

export function validateDate(value: string, name: string): void {
  validateString(value, name);
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`${name} is not a valid date: ${value}`);
  }
}

export function validateUrl(value: string, name: string): void {
  validateString(value, name);
  
  try {
    new URL(value);
  } catch {
    throw new ValidationError(`${name} is not a valid URL: ${value}`);
  }
}

export function validateKeyValue(value: string, name: string = 'Key-value pair'): { key: string; value: string } {
  validateString(value, name);
  
  const parts = value.split('=');
  if (parts.length !== 2) {
    throw new ValidationError(`${name} must be in format key=value`);
  }
  
  const [key, val] = parts;
  if (!key || !val) {
    throw new ValidationError(`${name} must have both key and value`);
  }
  
  return { key: key.trim(), value: val.trim() };
}

export function parseKeyValuePairs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  
  values.forEach((value, index) => {
    const { key, value: val } = validateKeyValue(value, `Input #${index + 1}`);
    result[key] = val;
  });
  
  return result;
}

export function validatePositiveInteger(value: number, name: string): void {
  validateNumber(value, name);
  
  if (!Number.isInteger(value)) {
    throw new ValidationError(`${name} must be an integer`);
  }
  
  if (value <= 0) {
    throw new ValidationError(`${name} must be positive`);
  }
}

export function validateRange(value: number, name: string, min: number, max: number): void {
  validateNumber(value, name);
  
  if (value < min || value > max) {
    throw new ValidationError(`${name} must be between ${min} and ${max}`);
  }
}
