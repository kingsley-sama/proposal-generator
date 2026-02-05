/**
 * Calculate delivery time based on selected services
 */

import { ServiceData } from '@/contexts/ProposalContext';

interface DeliveryTimeResult {
  deliveryTime: string;
  deliveryDaysMin: number;
  deliveryDaysMax: number;
}

export function calculateDeliveryTime(services: ServiceData[]): DeliveryTimeResult {
  if (services.length === 0) {
    return {
      deliveryTime: 'XXX Werktage',
      deliveryDaysMin: 0,
      deliveryDaysMax: 0
    };
  }

  let totalMin = 0;
  let totalMax = 0;

  services.forEach(service => {
    const quantity = service.quantity || 0;
    let serviceMin = 0;
    let serviceMax = 0;

    switch (service.id) {
      case 'exterior-ground':
      case 'exterior-bird':
        serviceMin = 7 * quantity;
        serviceMax = 10 * quantity;
        break;

      case 'interior':
        serviceMin = 5 * quantity;
        serviceMax = 7 * quantity;
        break;

      case 'terrace':
        serviceMin = 5;
        serviceMax = 7;
        break;

      case '3d-floorplan':
        serviceMin = 3 * quantity;
        serviceMax = 5 * quantity;
        break;

      case '3d-complete-floor':
        serviceMin = 5 * quantity;
        serviceMax = 7 * quantity;
        break;

      case '2d-floorplan':
        serviceMin = 2 * quantity;
        serviceMax = 3 * quantity;
        break;

      case 'home-staging':
      case 'renovation':
        serviceMin = 3 * quantity;
        serviceMax = 5 * quantity;
        break;

      case '360-interior':
        serviceMin = 10;
        serviceMax = 14;
        break;

      case '360-exterior':
        serviceMin = 7;
        serviceMax = 10;
        break;

      case 'slideshow':
        serviceMin = 5;
        serviceMax = 7;
        break;

      case 'site-plan':
        serviceMin = 5;
        serviceMax = 7;
        break;

      case 'social-media':
        serviceMin = 2;
        serviceMax = 3;
        break;

      case 'video-snippet':
        serviceMin = 3;
        serviceMax = 5;
        break;

      case 'expose-layout':
        serviceMin = 7;
        serviceMax = 10;
        break;

      case 'expose-creation':
        serviceMin = 5;
        serviceMax = 7;
        break;

      default:
        serviceMin = 5;
        serviceMax = 7;
    }

    // Add to total (services can overlap, so we don't simply add all)
    // Use a weighted approach where the longest service dominates
    totalMin = Math.max(totalMin, serviceMin);
    totalMax = Math.max(totalMax, serviceMax);
  });

  // Add base processing time
  totalMin += 2;
  totalMax += 3;

  const deliveryTime = totalMin === totalMax 
    ? `${totalMin} Werktage`
    : `${totalMin}-${totalMax} Werktage`;

  return {
    deliveryTime,
    deliveryDaysMin: totalMin,
    deliveryDaysMax: totalMax
  };
}

/**
 * Format delivery date based on working days
 */
export function calculateDeliveryDate(workingDays: number): string {
  const today = new Date();
  let daysAdded = 0;
  let currentDate = new Date(today);

  while (daysAdded < workingDays) {
    currentDate.setDate(currentDate.getDate() + 1);
    
    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return currentDate.toISOString().split('T')[0];
}
