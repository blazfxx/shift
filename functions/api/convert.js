const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp',
  'video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/mkv',
  'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac',
  'application/pdf'
];

const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp',
  'mp4', 'webm', 'avi', 'mov', 'mkv',
  'mp3', 'wav', 'ogg', 'flac', 'aac',
  'pdf'
];

const SUPPORTED_TARGET_FORMATS = [
  'jpg', 'png', 'gif', 'webp',
  'mp4', 'webm', 'gif',
  'mp3', 'wav', 'ogg', 'flac', 'aac',
  'pdf'
];

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
  'Access-Control-Max-Age': '86400'
};

function jsonResponse(data, status = 200, additionalHeaders = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...SECURITY_HEADERS,
    ...CORS_HEADERS,
    ...additionalHeaders
  };
  return new Response(JSON.stringify(data), { status, headers });
}

function errorResponse(message, code, status = 400) {
  return jsonResponse({ success: false, error: message, code }, status);
}

function getFileExtension(filename) {
  const parts = filename.toLowerCase().split('.');
  return parts.length > 1 ? parts.pop() : '';
}

function validateRateLimit(request) {
  const limit = request.headers.get('X-RateLimit-Limit');
  const remaining = request.headers.get('X-RateLimit-Remaining');
  const reset = request.headers.get('X-RateLimit-Reset');
  
  if (remaining !== null && parseInt(remaining) <= 0) {
    return {
      valid: false,
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      headers: {
        'X-RateLimit-Limit': limit || '100',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': reset || String(Math.floor(Date.now() / 1000) + 3600),
        'Retry-After': reset || '3600'
      }
    };
  }
  
  return {
    valid: true,
    headers: {
      'X-RateLimit-Limit': limit || '100',
      'X-RateLimit-Remaining': remaining ? String(parseInt(remaining) - 1) : '99',
      'X-RateLimit-Reset': reset || String(Math.floor(Date.now() / 1000) + 3600)
    }
  };
}

function validateApiKey(request, env) {
  const apiKey = request.headers.get('X-API-Key');
  
  if (!env || !env.API_KEYS) {
    return { valid: true, optional: true };
  }
  
  if (!apiKey) {
    return { valid: true, optional: true };
  }
  
  const validKeys = env.API_KEYS.split(',').map(k => k.trim());
  if (!validKeys.includes(apiKey)) {
    return { valid: false, error: 'Invalid API key', code: 'INVALID_API_KEY' };
  }
  
  return { valid: true, userId: apiKey };
}

async function parseFormData(request) {
  const contentType = request.headers.get('Content-Type') || '';
  
  if (!contentType.includes('multipart/form-data')) {
    return { error: 'Content-Type must be multipart/form-data', code: 'INVALID_CONTENT_TYPE' };
  }
  
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const targetFormat = formData.get('target_format');
    const quality = formData.get('quality') || 'medium';
    
    return { file, targetFormat, quality };
  } catch (err) {
    return { error: 'Failed to parse form data', code: 'PARSE_ERROR' };
  }
}

function validateFile(file) {
  if (!file) {
    return { error: 'No file provided', code: 'NO_FILE' };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { error: `File size exceeds limit of ${MAX_FILE_SIZE / (1024 * 1024)}MB`, code: 'FILE_TOO_LARGE' };
  }
  
  if (file.size === 0) {
    return { error: 'File is empty', code: 'EMPTY_FILE' };
  }
  
  const extension = getFileExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return { error: `File type '.${extension}' is not allowed`, code: 'INVALID_FILE_TYPE' };
  }
  
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    console.log(`Warning: File type '${file.type}' not in allowed list but extension '${extension}' is valid`);
  }
  
  return { valid: true, extension, type: file.type };
}

function validateTargetFormat(targetFormat) {
  if (!targetFormat) {
    return { error: 'Target format is required', code: 'NO_TARGET_FORMAT' };
  }
  
  const format = targetFormat.toLowerCase().trim();
  if (!SUPPORTED_TARGET_FORMATS.includes(format)) {
    return { error: `Target format '${format}' is not supported`, code: 'UNSUPPORTED_TARGET_FORMAT' };
  }
  
  return { valid: true, format };
}

function validateQuality(quality) {
  const validQualities = ['low', 'medium', 'high', 'lossless'];
  const q = (quality || 'medium').toLowerCase().trim();
  
  if (!validQualities.includes(q)) {
    return { valid: false, error: `Invalid quality '${q}'. Must be one of: ${validQualities.join(', ')}`, code: 'INVALID_QUALITY' };
  }
  
  return { valid: true, quality: q };
}

function logRequest(request, file, targetFormat, quality) {
  const timestamp = new Date().toISOString();
  const userAgent = request.headers.get('User-Agent') || 'Unknown';
  const clientIP = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'Unknown';
  const apiKey = request.headers.get('X-API-Key') ? '[REDACTED]' : 'None';
  
  console.log(JSON.stringify({
    timestamp,
    event: 'conversion_request',
    clientIP,
    userAgent,
    apiKey,
    fileName: file ? file.name : null,
    fileSize: file ? file.size : null,
    fileType: file ? file.type : null,
    targetFormat,
    quality
  }));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const rateLimitResult = validateRateLimit(request);
  if (!rateLimitResult.valid) {
    logRequest(request, null, null, null);
    return errorResponse(rateLimitResult.error, rateLimitResult.code, 429)
      .then(r => {
        Object.entries(rateLimitResult.headers).forEach(([k, v]) => r.headers.set(k, v));
        return r;
      });
  }
  
  const authResult = validateApiKey(request, env);
  if (!authResult.valid) {
    logRequest(request, null, null, null);
    return errorResponse(authResult.error, authResult.code, 401);
  }
  
  const formData = await parseFormData(request);
  if (formData.error) {
    logRequest(request, null, null, null);
    return errorResponse(formData.error, formData.code);
  }
  
  const { file, targetFormat, quality } = formData;
  
  const fileValidation = validateFile(file);
  if (fileValidation.error) {
    logRequest(request, file, targetFormat, quality);
    return errorResponse(fileValidation.error, fileValidation.code);
  }
  
  const formatValidation = validateTargetFormat(targetFormat);
  if (formatValidation.error) {
    logRequest(request, file, targetFormat, quality);
    return errorResponse(formatValidation.error, formatValidation.code);
  }
  
  const qualityValidation = validateQuality(quality);
  if (qualityValidation.error) {
    logRequest(request, file, targetFormat, quality);
    return errorResponse(qualityValidation.error, qualityValidation.code);
  }
  
  logRequest(request, file, formatValidation.format, qualityValidation.quality);
  
  const sourceExtension = fileValidation.extension;
  const targetFormatClean = formatValidation.format;
  
  if (sourceExtension === targetFormatClean) {
    return errorResponse('Source and target formats are the same', 'SAME_FORMAT');
  }
  
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    event: 'conversion_placeholder',
    message: 'FFmpeg conversion not yet implemented in Cloudflare Workers',
    sourceFormat: sourceExtension,
    targetFormat: targetFormatClean,
    quality: qualityValidation.quality,
    note: 'Requires Cloudflare Workers with FFmpeg WASM or external service integration'
  }));
  
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const downloadId = crypto.randomUUID();
  
  return jsonResponse({
    success: true,
    message: 'API is in development - FFmpeg conversion not yet implemented',
    development: true,
    request_id: downloadId,
    file: {
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      source_format: sourceExtension
    },
    conversion: {
      target_format: targetFormatClean,
      quality: qualityValidation.quality,
      status: 'pending_implementation'
    },
    download_url: `https://placeholder.example.com/downloads/${downloadId}.${targetFormatClean}`,
    expires_at: expiresAt,
    note: 'This is a placeholder response. Implement FFmpeg WASM or integrate with external conversion service for production use.'
  }, 200, rateLimitResult.headers);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      ...CORS_HEADERS,
      'Content-Type': 'application/json'
    }
  });
}

export async function onRequestGet() {
  return jsonResponse({
    endpoint: '/api/convert',
    method: 'POST',
    content_type: 'multipart/form-data',
    parameters: {
      file: { type: 'File', required: true, description: 'File to convert' },
      target_format: { type: 'string', required: true, description: 'Target format (e.g., mp4, mp3, jpg)' },
      quality: { type: 'string', required: false, default: 'medium', options: ['low', 'medium', 'high', 'lossless'] }
    },
    headers: {
      'X-API-Key': { required: false, description: 'API key for authentication (if configured)' }
    },
    allowed_file_types: ALLOWED_EXTENSIONS,
    supported_target_formats: SUPPORTED_TARGET_FORMATS,
    max_file_size: `${MAX_FILE_SIZE / (1024 * 1024)}MB`,
    status: 'development',
    note: 'FFmpeg conversion pending implementation'
  });
}