import {
  ValidationError,
  validateRequired,
  validateString,
  validateNumber,
  validateBoolean,
  validateEnum,
  validatePath,
  validateFilePath,
  validateDirectoryPath,
  validateBranchName,
  validatePattern,
  validateDate,
  validateUrl,
  validateKeyValue,
  parseKeyValuePairs,
  validatePositiveInteger,
  validateRange,
} from './validation';
import * as fs from 'fs';
import * as path from 'path';

describe('Validation', () => {
  describe('ValidationError', () => {
    it('should create error with message', () => {
      const error = new ValidationError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('ValidationError');
    });
  });

  describe('validateRequired', () => {
    it('should not throw for valid value', () => {
      expect(() => validateRequired('value', 'field')).not.toThrow();
      expect(() => validateRequired(0, 'field')).not.toThrow();
      expect(() => validateRequired(false, 'field')).not.toThrow();
    });

    it('should throw for null or undefined', () => {
      expect(() => validateRequired(null, 'field')).toThrow('field is required');
      expect(() => validateRequired(undefined, 'field')).toThrow('field is required');
      expect(() => validateRequired('', 'field')).toThrow('field is required');
    });
  });

  describe('validateString', () => {
    it('should not throw for string', () => {
      expect(() => validateString('value', 'field')).not.toThrow();
    });

    it('should throw for non-string', () => {
      expect(() => validateString(123, 'field')).toThrow('field must be a string');
      expect(() => validateString(null, 'field')).toThrow('field is required');
    });
  });

  describe('validateNumber', () => {
    it('should not throw for number', () => {
      expect(() => validateNumber(123, 'field')).not.toThrow();
      expect(() => validateNumber('456', 'field')).not.toThrow();
    });

    it('should throw for non-number', () => {
      expect(() => validateNumber('abc', 'field')).toThrow('field must be a number');
      expect(() => validateNumber(null, 'field')).toThrow('field is required');
    });
  });

  describe('validateBoolean', () => {
    it('should not throw for boolean', () => {
      expect(() => validateBoolean(true, 'field')).not.toThrow();
      expect(() => validateBoolean(false, 'field')).not.toThrow();
    });

    it('should throw for non-boolean', () => {
      expect(() => validateBoolean('true', 'field')).toThrow('field must be a boolean');
      expect(() => validateBoolean(1, 'field')).toThrow('field must be a boolean');
    });
  });

  describe('validateEnum', () => {
    it('should not throw for valid value', () => {
      expect(() => validateEnum('red', 'color', ['red', 'green', 'blue'])).not.toThrow();
    });

    it('should throw for invalid value', () => {
      expect(() => validateEnum('yellow', 'color', ['red', 'green', 'blue']))
        .toThrow('color must be one of: red, green, blue');
    });
  });

  describe('validatePath', () => {
    it('should not throw for relative path', () => {
      expect(() => validatePath('path/to/file', 'path')).not.toThrow();
    });

    it('should throw for absolute path', () => {
      expect(() => validatePath('/absolute/path', 'path'))
        .toThrow('path must be a relative path, not absolute');
    });

    it('should throw for path traversal', () => {
      expect(() => validatePath('../../etc/passwd', 'path'))
        .toThrow('path must not contain \'..\' (path traversal)');
    });

    it('should throw if path does not exist when mustExist is true', () => {
      expect(() => validatePath('nonexistent/path', 'path', true))
        .toThrow('path does not exist');
    });
  });

  describe('validateBranchName', () => {
    it('should not throw for valid branch name', () => {
      expect(() => validateBranchName('feature/new-feature')).not.toThrow();
      expect(() => validateBranchName('bugfix-123')).not.toThrow();
    });

    it('should throw for invalid branch name', () => {
      expect(() => validateBranchName('branch name'))
        .toThrow('Branch name must not contain spaces');
      expect(() => validateBranchName('-invalid'))
        .toThrow('Branch name must not start with \'-\' or \'.\'');
      expect(() => validateBranchName('branch:name'))
        .toThrow('Branch name contains invalid characters');
    });
  });

  describe('validatePattern', () => {
    it('should not throw for matching pattern', () => {
      expect(() => validatePattern('abc123', 'field', /^[a-z0-9]+$/)).not.toThrow();
    });

    it('should throw for non-matching pattern', () => {
      expect(() => validatePattern('ABC', 'field', /^[a-z]+$/))
        .toThrow('field does not match required pattern');
    });
  });

  describe('validateDate', () => {
    it('should not throw for valid date', () => {
      expect(() => validateDate('2024-01-01', 'date')).not.toThrow();
      expect(() => validateDate('2024-01-01T10:00:00Z', 'date')).not.toThrow();
    });

    it('should throw for invalid date', () => {
      expect(() => validateDate('not-a-date', 'date'))
        .toThrow('date is not a valid date');
    });
  });

  describe('validateUrl', () => {
    it('should not throw for valid URL', () => {
      expect(() => validateUrl('https://example.com', 'url')).not.toThrow();
      expect(() => validateUrl('http://localhost:3000', 'url')).not.toThrow();
    });

    it('should throw for invalid URL', () => {
      expect(() => validateUrl('not-a-url', 'url'))
        .toThrow('url is not a valid URL');
    });
  });

  describe('validateKeyValue', () => {
    it('should parse valid key-value pair', () => {
      const result = validateKeyValue('key=value');
      expect(result).toEqual({ key: 'key', value: 'value' });
    });

    it('should trim whitespace', () => {
      const result = validateKeyValue(' key = value ');
      expect(result).toEqual({ key: 'key', value: 'value' });
    });

    it('should throw for invalid format', () => {
      expect(() => validateKeyValue('invalid'))
        .toThrow('Key-value pair must be in format key=value');
      expect(() => validateKeyValue('key='))
        .toThrow('Key-value pair must have both key and value');
    });
  });

  describe('parseKeyValuePairs', () => {
    it('should parse multiple key-value pairs', () => {
      const result = parseKeyValuePairs(['key1=value1', 'key2=value2']);
      expect(result).toEqual({ key1: 'value1', key2: 'value2' });
    });

    it('should throw for invalid pair', () => {
      expect(() => parseKeyValuePairs(['key1=value1', 'invalid']))
        .toThrow('Input #2 must be in format key=value');
    });
  });

  describe('validatePositiveInteger', () => {
    it('should not throw for positive integer', () => {
      expect(() => validatePositiveInteger(1, 'field')).not.toThrow();
      expect(() => validatePositiveInteger(100, 'field')).not.toThrow();
    });

    it('should throw for non-integer', () => {
      expect(() => validatePositiveInteger(1.5, 'field'))
        .toThrow('field must be an integer');
    });

    it('should throw for non-positive', () => {
      expect(() => validatePositiveInteger(0, 'field'))
        .toThrow('field must be positive');
      expect(() => validatePositiveInteger(-1, 'field'))
        .toThrow('field must be positive');
    });
  });

  describe('validateRange', () => {
    it('should not throw for value in range', () => {
      expect(() => validateRange(50, 'field', 0, 100)).not.toThrow();
      expect(() => validateRange(0, 'field', 0, 100)).not.toThrow();
      expect(() => validateRange(100, 'field', 0, 100)).not.toThrow();
    });

    it('should throw for value out of range', () => {
      expect(() => validateRange(-1, 'field', 0, 100))
        .toThrow('field must be between 0 and 100');
      expect(() => validateRange(101, 'field', 0, 100))
        .toThrow('field must be between 0 and 100');
    });
  });
});
