// Google Analytics 4 - Utility functions for event tracking

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/**
 * Send a custom event to Google Analytics
 */
export const trackEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
};

/**
 * Track a purchase event
 */
export const trackPurchase = (planName: string, credits: number, value: number, purchaseType: 'new_account' | 'recharge') => {
  trackEvent('purchase', {
    currency: 'BRL',
    value,
    items: [{ 
      item_name: planName,
      item_category: purchaseType,
      quantity: 1,
      price: value
    }],
    credits_purchased: credits,
    purchase_type: purchaseType
  });
};

/**
 * Track user sign up
 */
export const trackSignUp = (method: string = 'email') => {
  trackEvent('sign_up', { method });
};

/**
 * Track user login
 */
export const trackLogin = (method: string = 'email') => {
  trackEvent('login', { method });
};

/**
 * Track plan view
 */
export const trackViewPlan = (planName: string, planType: 'new_account' | 'recharge', credits: number, price: number) => {
  trackEvent('view_item', { 
    currency: 'BRL',
    value: price,
    items: [{
      item_name: planName,
      item_category: planType,
      price,
      quantity: 1
    }],
    credits: credits
  });
};

/**
 * Track add to cart / begin checkout
 */
export const trackBeginCheckout = (planName: string, planType: 'new_account' | 'recharge', credits: number, price: number) => {
  trackEvent('begin_checkout', {
    currency: 'BRL',
    value: price,
    items: [{
      item_name: planName,
      item_category: planType,
      price,
      quantity: 1
    }],
    credits: credits
  });
};

/**
 * Track page view (for SPA navigation)
 */
export const trackPageView = (pagePath: string, pageTitle?: string) => {
  trackEvent('page_view', {
    page_path: pagePath,
    page_title: pageTitle || document.title
  });
};
