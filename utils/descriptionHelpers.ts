/**
 * Helper functions for managing nested bullet points in service descriptions
 * Following docxtemplater best practices: hierarchy in data, styling in Word
 */

export interface BulletPoint {
  text: string;
  children: BulletPoint[];
}

/**
 * Parse service description - now expects proper nested structure from service_description.js
 */
export function parseServiceDescription(description: any[]): BulletPoint[] {
  if (!description) return [];

  return description.map(item => {
    // Handle both old flat format and new nested format
    if (typeof item === 'string') {
      // Legacy format - convert to nested
      return {
        text: item,
        children: []
      };
    }
    
    // New nested format - already correct
    return {
      text: item.text || '',
      children: item.children ? parseServiceDescription(item.children) : []
    };
  });
}

/**
 * Check if a bullet point text is a placeholder that needs user input
 */
export function isPlaceholder(text: string): boolean {
  const trimmed = text.trim();
  return trimmed === 'xxx' || 
         trimmed === 'XX' ||
         trimmed === 'XXX' ||
         trimmed === '…' ||
         /^(xxx|XX|XXX|…)$/i.test(trimmed);
}

/**
 * Check if text contains quantity/project placeholders
 */
export function hasPlaceholders(text: string): boolean {
  return text.includes('XXX') || 
         text.includes('XX') || 
         text.includes('„XXX"');
}

/**
 * Replace XXX placeholders with actual quantity
 */
export function replaceQuantityPlaceholders(text: string, quantity: number): string {
  return text
    .replace(/XXX/g, quantity.toString())
    .replace(/XX/g, quantity.toString());
}

/**
 * Replace "XXX" placeholders with project name
 */
export function replaceProjectPlaceholders(text: string, projectName: string): string {
  return text.replace(/„XXX"/g, `„${projectName}"`);
}

/**
 * Create a new empty bullet point for user to fill in
 */
export function createEmptyBulletPoint(): BulletPoint {
  return {
    text: '[Enter detail here]',
    children: []
  };
}

/**
 * Add a custom bullet point (can be child or sibling)
 */
export function addBulletPoint(
  description: BulletPoint[],
  parentIndex: number,
  asChild: boolean = false
): BulletPoint[] {
  const newPoint = createEmptyBulletPoint();
  const newDesc = JSON.parse(JSON.stringify(description)); // Deep clone
  
  if (asChild) {
    // Add as child to the specified parent
    if (!newDesc[parentIndex].children) {
      newDesc[parentIndex].children = [];
    }
    newDesc[parentIndex].children.push(newPoint);
  } else {
    // Add as sibling after the specified index
    newDesc.splice(parentIndex + 1, 0, newPoint);
  }
  
  return newDesc;
}

/**
 * Update bullet point text at any level
 */
export function updateBulletPointText(
  description: BulletPoint[],
  path: number[],
  newText: string
): BulletPoint[] {
  const newDesc = JSON.parse(JSON.stringify(description)); // Deep clone
  
  let current: any = newDesc;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]].children;
  }
  current[path[path.length - 1]].text = newText;
  
  return newDesc;
}

/**
 * Remove bullet point at any level
 */
export function removeBulletPointAt(
  description: BulletPoint[],
  path: number[]
): BulletPoint[] {
  const newDesc = JSON.parse(JSON.stringify(description)); // Deep clone
  
  let current: any = newDesc;
  for (let i = 0; i < path.length - 1; i++) {
    current = current[path[i]].children;
  }
  current.splice(path[path.length - 1], 1);
  
  return newDesc;
}

/**
 * Convert bullet points to format expected by docxtemplater
 * This maintains the nested structure for proper Word rendering
 */
export function formatForTemplate(
  bulletPoints: BulletPoint[],
  serviceData?: {
    quantity?: number;
    projectName?: string;
  }
): BulletPoint[] {
  return bulletPoints.map(bullet => {
    let text = bullet.text;

    // Replace placeholders with actual data
    if (serviceData) {
      if (serviceData.quantity) {
        text = replaceQuantityPlaceholders(text, serviceData.quantity);
      }
      if (serviceData.projectName) {
        text = replaceProjectPlaceholders(text, serviceData.projectName);
      }
    }

    return {
      text,
      children: bullet.children && bullet.children.length > 0
        ? formatForTemplate(bullet.children, serviceData)
        : []
    };
  });
}

/**
 * Get all placeholder texts that need user input (recursive)
 */
export function getPlaceholders(description: BulletPoint[], path: number[] = []): Array<{
  path: number[];
  text: string;
}> {
  const placeholders: Array<{ path: number[]; text: string }> = [];
  
  description.forEach((bullet, index) => {
    const currentPath = [...path, index];
    
    if (isPlaceholder(bullet.text)) {
      placeholders.push({
        path: currentPath,
        text: bullet.text
      });
    }
    
    if (bullet.children && bullet.children.length > 0) {
      placeholders.push(...getPlaceholders(bullet.children, currentPath));
    }
  });
  
  return placeholders;
}

/**
 * Validate service description - ensure no empty required fields (recursive)
 */
export function validateServiceDescription(description: BulletPoint[]): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const placeholders = getPlaceholders(description);

  placeholders.forEach(({ path, text }) => {
    if (isPlaceholder(text)) {
      errors.push(`Bullet point at path [${path.join(' → ')}] needs to be filled in: "${text}"`);
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Flatten nested structure for simple display (converts to array of strings)
 * Useful for preview pages
 */
export function flattenDescription(description: BulletPoint[], level: number = 0): string[] {
  const result: string[] = [];
  
  description.forEach(bullet => {
    const indent = '  '.repeat(level);
    const bulletChar = level === 0 ? '•' : level === 1 ? '○' : '▪';
    result.push(`${indent}${bulletChar} ${bullet.text}`);
    
    if (bullet.children && bullet.children.length > 0) {
      result.push(...flattenDescription(bullet.children, level + 1));
    }
  });
  
  return result;
}
