export async function onRequest(context) {
  const { request, next, env } = context;
  const startTime = Date.now();

  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${method} ${path} - UA: ${userAgent}`);

  try {
    const response = await next();

    const newResponse = new Response(response.body, response);

    newResponse.headers.set('X-Content-Type-Options', 'nosniff');
    newResponse.headers.set('X-Frame-Options', 'SAMEORIGIN');
    newResponse.headers.set('X-XSS-Protection', '1; mode=block');
    newResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    newResponse.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net",
      "worker-src 'self' blob: https://unpkg.com",
      "child-src 'self' blob: https://unpkg.com",
      "connect-src 'self' https://unpkg.com https://cdn.jsdelivr.net blob: data:",
      "font-src 'self' https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob:",
      "object-src 'none'"
    ].join('; ');

    newResponse.headers.set('Content-Security-Policy', csp);

    const permissionsPolicy = [
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=()',
      'battery=()',
      'camera=()',
      'display-capture=()',
      'document-domain=()',
      'encrypted-media=()',
      'execution-while-not-rendered=()',
      'execution-while-out-of-viewport=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'navigation-override=()',
      'payment=()',
      'picture-in-picture=(self)',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      'web-share=()',
      'xr-spatial-tracking=()'
    ].join(', ');

    newResponse.headers.set('Permissions-Policy', permissionsPolicy);

    newResponse.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    newResponse.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

    if (path.startsWith('/api/')) {
      const origin = request.headers.get('origin');
      const allowedOrigins = env?.ALLOWED_ORIGINS?.split(',') || ['*'];

      if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
        newResponse.headers.set('Access-Control-Allow-Origin', allowedOrigins.includes('*') ? '*' : origin);
        newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        newResponse.headers.set('Access-Control-Max-Age', '86400');
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[${timestamp}] ${method} ${path} - ${newResponse.status} - ${duration}ms`);

    return newResponse;
  } catch (error) {
    console.error(`[${timestamp}] ${method} ${path} - ERROR: ${error.message}`);

    const errorResponse = new Response(JSON.stringify({
      error: 'Internal Server Error',
      message: env?.ENVIRONMENT === 'development' ? error.message : 'An unexpected error occurred',
      timestamp
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'SAMEORIGIN',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'Cross-Origin-Opener-Policy': 'same-origin',
        'Cross-Origin-Embedder-Policy': 'require-corp'
      }
    });

    return errorResponse;
  }
}

export async function onRequestOptions(context) {
  const { request, env } = context;
  const origin = request.headers.get('origin');
  const allowedOrigins = env?.ALLOWED_ORIGINS?.split(',') || ['*'];

  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.includes('*') ? '*' : (origin || '*'),
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    }
  });
}