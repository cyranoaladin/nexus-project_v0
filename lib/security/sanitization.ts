/**
 * Input Sanitization Utilities
 *
 * Provides sanitization functions to prevent XSS, log injection, and other security issues.
 */

/**
 * Sanitize HTML content to prevent XSS attacks
 *
 * This is a basic sanitizer that strips dangerous tags and attributes.
 * For production use with rich HTML content, consider using DOMPurify or similar library.
 *
 * @param html - Raw HTML string
 * @returns Sanitized HTML string
 *
 * @example
 * ```ts
 * const safe = sanitizeHtml('<script>alert("xss")</script><p>Hello</p>');
 * // Returns: '<p>Hello</p>'
 * ```
 */
export function sanitizeHtml(html: string): string {
  if (!html || typeof html !== 'string') return '';

  return html
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove event handlers (onclick, onerror, etc.)
    .replace(/\s*on\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: protocol
    .replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href=""')
    // Remove data: protocol (potential XSS vector)
    .replace(/src\s*=\s*(['"])data:.*?\1/gi, 'src=""')
    // Remove iframe tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    // Remove object and embed tags
    .replace(/<(object|embed)\b[^<]*(?:(?!<\/\1>)<[^<]*)*<\/\1>/gi, '');
}

/**
 * Sanitize text for safe logging
 *
 * Removes control characters and limits length to prevent log injection and log flooding.
 *
 * @param text - Raw text
 * @param maxLength - Maximum length (default: 500)
 * @returns Sanitized text safe for logging
 *
 * @example
 * ```ts
 * const safe = sanitizeLog('User input:\nmalicious\rdata');
 * // Returns: 'User input: malicious data'
 * ```
 */
export function sanitizeLog(text: string, maxLength: number = 500): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // Replace control characters (except space and tab)
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, ' ')
    // Replace newlines and carriage returns with space
    .replace(/[\n\r]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    // Trim whitespace
    .trim()
    // Limit length
    .slice(0, maxLength);
}

/**
 * Sanitize email address
 *
 * Validates and normalizes email addresses.
 *
 * @param email - Raw email
 * @returns Sanitized email or empty string if invalid
 *
 * @example
 * ```ts
 * const safe = sanitizeEmail('  User@Example.COM  ');
 * // Returns: 'user@example.com'
 * ```
 */
export function sanitizeEmail(email: string): string {
  if (!email || typeof email !== 'string') return '';

  const normalized = email.trim().toLowerCase();
  
  // Basic email validation regex
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  
  return emailRegex.test(normalized) ? normalized : '';
}

/**
 * Sanitize file name to prevent path traversal
 *
 * Removes directory separators and dangerous characters from file names.
 *
 * @param filename - Raw filename
 * @returns Safe filename
 *
 * @example
 * ```ts
 * const safe = sanitizeFilename('../../etc/passwd');
 * // Returns: 'etc_passwd'
 * ```
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') return '';

  return filename
    // Remove path separators
    .replace(/[/\\]/g, '_')
    // Remove null bytes
    .replace(/\0/g, '')
    // Remove control characters
    .replace(/[\x00-\x1F\x7F]/g, '')
    // Remove dangerous characters
    .replace(/[<>:"|?*]/g, '_')
    // Trim dots and spaces
    .replace(/^\.+/, '')
    .trim()
    // Limit length
    .slice(0, 255);
}

/**
 * Sanitize URL to prevent open redirects
 *
 * Validates that URL is safe and points to allowed domains.
 *
 * @param url - Raw URL
 * @param allowedHosts - Array of allowed hostnames (default: current host only)
 * @returns Sanitized URL or empty string if invalid
 *
 * @example
 * ```ts
 * const safe = sanitizeUrl('https://evil.com', ['example.com']);
 * // Returns: ''
 * 
 * const safe2 = sanitizeUrl('https://example.com/path', ['example.com']);
 * // Returns: 'https://example.com/path'
 * ```
 */
export function sanitizeUrl(url: string, allowedHosts?: string[]): string {
  if (!url || typeof url !== 'string') return '';

  try {
    const parsed = new URL(url, 'https://placeholder.com');
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return '';
    }

    // If allowedHosts is provided, validate hostname
    if (allowedHosts && allowedHosts.length > 0) {
      const isAllowed = allowedHosts.some(host => 
        parsed.hostname === host || parsed.hostname.endsWith(`.${host}`)
      );
      
      if (!isAllowed) {
        return '';
      }
    }

    return parsed.toString();
  } catch {
    // Invalid URL
    return '';
  }
}

/**
 * Sanitize SQL LIKE pattern
 *
 * Escapes special characters in SQL LIKE patterns to prevent injection.
 *
 * @param pattern - Raw search pattern
 * @returns Escaped pattern safe for SQL LIKE
 *
 * @example
 * ```ts
 * const safe = sanitizeLikePattern('user%');
 * // Returns: 'user\\%'
 * ```
 */
export function sanitizeLikePattern(pattern: string): string {
  if (!pattern || typeof pattern !== 'string') return '';

  return pattern
    // Escape backslash first
    .replace(/\\/g, '\\\\')
    // Escape percent
    .replace(/%/g, '\\%')
    // Escape underscore
    .replace(/_/g, '\\_')
    // Limit length
    .slice(0, 255);
}

/**
 * Sanitize Telegram message for MarkdownV1
 *
 * Escapes special characters in Telegram MarkdownV1 format.
 *
 * @param text - Raw text
 * @returns Escaped text safe for Telegram
 *
 * @example
 * ```ts
 * const safe = sanitizeTelegram('User: John_Doe (admin)');
 * // Returns: 'User: John\\_Doe \\(admin\\)'
 * ```
 */
export function sanitizeTelegram(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}
