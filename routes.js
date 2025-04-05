// Payment routes configuration
const routes = {
  // Main domain routes
  'mhcomputer.org': {
    '/payment-success': './payment-success.html',
    '/payment-cancel': './payment-cancel.html',
  },
  // Subdomain routes
  'pay.mhcomputer.org': {
    '/payment-success*': './payment-success.html',
    '/payment-cancel*': './payment-cancel.html',
  },
};

// Redirect handler
function handlePaymentRedirect(domain, path) {
  const domainRoutes = routes[domain];
  if (domainRoutes) {
    for (const [routePath, targetFile] of Object.entries(domainRoutes)) {
      if (path.startsWith(routePath.replace('*', ''))) {
        return targetFile;
      }
    }
  }
  return null;
}
