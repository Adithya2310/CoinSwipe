/**
 * Validation Utilities for CoinSwipe Server
 * 
 * Provides validation functions for user inputs and API data
 * to ensure data integrity and security.
 */

/**
 * Validate Ethereum-style Address (Base Network)
 * 
 * Checks if a string is a valid Ethereum-style address
 * which is the format used by Base network.
 * 
 * @param address - Address string to validate
 * @returns boolean - true if valid address format
 */
export function validatePairAddress(address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  // Ethereum address format: 0x followed by 40 hexadecimal characters
  const addressRegex = /^0x[a-fA-F0-9]{40}$/;
  return addressRegex.test(address);
}

/**
 * Validate Numeric String
 * 
 * Checks if a string represents a valid number
 * 
 * @param value - String to validate
 * @returns boolean - true if valid number string
 */
export function validateNumericString(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }

  const number = parseFloat(value);
  return !isNaN(number) && isFinite(number);
}

/**
 * Sanitize String Input
 * 
 * Removes potentially dangerous characters from user input
 * 
 * @param input - Input string to sanitize
 * @param maxLength - Maximum allowed length
 * @returns string - Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 100): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>'"&]/g, ''); // Remove potentially dangerous characters
}

/**
 * Validate API Response Structure
 * 
 * Checks if an API response has the expected structure
 * 
 * @param response - Response object to validate
 * @param requiredFields - Array of required field names
 * @returns boolean - true if response is valid
 */
export function validateApiResponse(response: any, requiredFields: string[]): boolean {
  if (!response || typeof response !== 'object') {
    return false;
  }

  return requiredFields.every(field => {
    const keys = field.split('.');
    let current = response;
    
    for (const key of keys) {
      if (!current || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    
    return true;
  });
}
