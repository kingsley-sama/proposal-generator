import { useCallback } from 'react';

// Import service descriptions
const serviceDescriptions = require('@/lib/service_description.js');

/**
 * Hook for service-specific pricing calculations
 * Uses data from service_description.js as source of truth
 */
export function useServicePricing() {
  
  /**
   * Calculate price for a service based on quantity and parameters
   */
  const calculateServicePrice = useCallback((
    serviceId: string,
    quantity: number,
    options?: {
      buildingType?: string;
      apartmentSize?: string;
      projectType?: string;
      areaSize?: string;
      customPrice?: number;
    }
  ): number => {
    // Use custom price if provided
    if (options?.customPrice && options.customPrice > 0) {
      return options.customPrice * quantity;
    }

    // Get service info
    const serviceInfo = serviceDescriptions[serviceId];
    if (!serviceInfo) {
      console.warn(`Service ${serviceId} not found`);
      return 0;
    }

    // Service-specific pricing logic
    switch (serviceId) {
      case 'exterior-ground': {
        const buildingType = options?.buildingType;
        if (!buildingType) return 0;
        
        const priceMatrix: Record<string, number[]> = {
          'efh': [499, 399, 369, 349, 329],
          'dhh': [599, 499, 469, 449, 429],
          'mfh': [799, 699, 669, 649, 629],
          'gewerbe': [999, 899, 869, 849, 829]
        };

        const prices = priceMatrix[buildingType];
        if (!prices) return 0;

        const index = Math.min(quantity - 1, prices.length - 1);
        return prices[index] * quantity;
      }

      case 'exterior-bird': {
        // Bird view pricing based on ground visualizations
        if (quantity === 1) return 199;
        if (quantity === 2) return 149 * 2;
        if (quantity >= 3) return 99 * quantity;
        return 0;
      }

      case 'interior': {
        const priceTiers = [
          { quantity: 1, price: 399 },
          { quantity: 2, price: 299 },
          { quantity: 3, price: 289 },
          { quantity: 4, price: 269 },
          { quantity: 5, price: 259 },
          { quantity: 6, price: 249 },
          { quantity: 7, price: 239 },
          { quantity: 8, price: 229 },
          { quantity: 9, price: 219 },
          { quantity: 10, price: 199 }
        ];

        const tier = priceTiers.find(t => t.quantity === quantity) || 
                     priceTiers[priceTiers.length - 1];
        return tier.price * quantity;
      }

      case '3d-floorplan': {
        const projectType = options?.projectType;
        
        if (projectType === 'efh' || projectType === 'dhh') {
          if (quantity === 1) return 69;
          if (quantity === 2) return 49 * 2;
          if (quantity >= 3) return 39 * quantity;
        } else if (projectType === 'mfh') {
          if (quantity <= 2) return 69 * quantity;
          if (quantity <= 4) return 59 * quantity;
          if (quantity <= 9) return 49 * quantity;
          return 39 * quantity;
        }
        
        return serviceInfo.defaultPrice ? serviceInfo.defaultPrice * quantity : 0;
      }

      case '2d-floorplan': {
        const projectType = options?.projectType;
        
        if (projectType === 'efh' || projectType === 'dhh') {
          if (quantity === 1) return 49;
          if (quantity >= 2) return 39 * quantity;
        } else if (projectType === 'mfh') {
          if (quantity <= 4) return 49 * quantity;
          if (quantity <= 9) return 39 * quantity;
          return 29 * quantity;
        }
        
        return serviceInfo.defaultPrice ? serviceInfo.defaultPrice * quantity : 0;
      }

      case 'home-staging':
      case 'renovation': {
        if (quantity <= 2) {
          return (serviceInfo.defaultPrice || 0) * quantity;
        } else if (quantity <= 4) {
          return (serviceInfo.defaultPrice ? serviceInfo.defaultPrice - 10 : 0) * quantity;
        } else if (quantity <= 9) {
          return (serviceInfo.defaultPrice ? serviceInfo.defaultPrice - 20 : 0) * quantity;
        } else {
          return (serviceInfo.defaultPrice ? serviceInfo.defaultPrice - 30 : 0) * quantity;
        }
      }

      case '360-interior': {
        const apartmentSize = options?.apartmentSize;
        const basePrice = serviceInfo.defaultPrice || 599;
        
        if (!apartmentSize) return basePrice;
        
        const sizeNum = parseInt(apartmentSize);
        if (sizeNum <= 60) return basePrice;
        if (sizeNum <= 100) return basePrice + 100;
        if (sizeNum <= 150) return basePrice + 200;
        return basePrice + 300;
      }

      case '360-exterior': {
        const buildingType = options?.buildingType;
        
        if (buildingType === 'efh' || buildingType === 'dhh') {
          return 699;
        } else if (buildingType === 'mfh') {
          return 899;
        } else if (buildingType === 'gewerbe') {
          return 1199;
        }
        return 699;
      }

      case '3d-complete-floor': {
        return (serviceInfo.defaultPrice || 199) * quantity;
      }

      case 'site-plan': {
        const areaSize = options?.areaSize;
        const basePrice = serviceInfo.defaultPrice || 99;
        
        if (!areaSize) return basePrice;
        
        if (areaSize === 'small') return basePrice;
        if (areaSize === 'medium') return basePrice + 50;
        if (areaSize === 'large') return basePrice + 100;
        return basePrice;
      }

      default: {
        // Default: use defaultPrice from service description
        if (serviceInfo.defaultPrice) {
          return serviceInfo.defaultPrice * quantity;
        }
        return 0;
      }
    }
  }, []);

  /**
   * Get unit price for a service (price per single unit)
   */
  const getUnitPrice = useCallback((
    serviceId: string,
    quantity: number,
    options?: {
      buildingType?: string;
      apartmentSize?: string;
      projectType?: string;
      areaSize?: string;
      customPrice?: number;
    }
  ): number => {
    const totalPrice = calculateServicePrice(serviceId, quantity, options);
    return quantity > 0 ? totalPrice / quantity : 0;
  }, [calculateServicePrice]);

  /**
   * Get service description from service_description.js
   */
  const getServiceDescription = useCallback((serviceId: string): any[] => {
    const serviceInfo = serviceDescriptions[serviceId];
    if (!serviceInfo || !serviceInfo.description) {
      return [];
    }
    // Return a copy to avoid mutations
    return JSON.parse(JSON.stringify(serviceInfo.description));
  }, []);

  /**
   * Get service name
   */
  const getServiceName = useCallback((serviceId: string): string => {
    const serviceInfo = serviceDescriptions[serviceId];
    return serviceInfo?.name || serviceId;
  }, []);

  /**
   * Get service reference link
   */
  const getServiceLink = useCallback((serviceId: string): string | undefined => {
    const serviceInfo = serviceDescriptions[serviceId];
    return serviceInfo?.link;
  }, []);

  /**
   * Check if service has pricing tiers
   */
  const hasPricingTiers = useCallback((serviceId: string): boolean => {
    const serviceInfo = serviceDescriptions[serviceId];
    return !!(serviceInfo?.pricingTiers && serviceInfo.pricingTiers.length > 0);
  }, []);

  return {
    calculateServicePrice,
    getUnitPrice,
    getServiceDescription,
    getServiceName,
    getServiceLink,
    hasPricingTiers
  };
}
