const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { error, log } = require('../utils/logger');

/**
 * Validates Adobe API configuration.
 * @throws {Error} If configuration is invalid or missing.
 */
const validateAdobeConfig = () => {
  if (!config || !config.adobe) {
    throw new Error('Adobe configuration is missing.');
  }

  if (!config.adobe.apiKey || typeof config.adobe.apiKey !== 'string') {
    throw new Error('Adobe API key is missing or invalid.');
  }

  if (!config.adobe.apiSecret || typeof config.adobe.apiSecret !== 'string') {
    throw new Error('Adobe API secret is missing or invalid.');
  }

  if (config.adobe.apiKey.length < 10) {
    throw new Error('Adobe API key appears to be invalid (too short).');
  }

  if (config.adobe.apiSecret.length < 10) {
    throw new Error('Adobe API secret appears to be invalid (too short).');
  }

  const placeholders = ['your_api_key', 'your_api_secret', 'placeholder', 'change_me'];
  if (placeholders.some(placeholder => 
    config.adobe.apiKey.toLowerCase().includes(placeholder) ||
    config.adobe.apiSecret.toLowerCase().includes(placeholder)
  )) {
    throw new Error('Adobe API credentials appear to be placeholder values.');
  }
};

/**
 * Retrieves an access token from Adobe's IMS.
 * @returns {Promise<string>} The access token.
 * @throws {Error} If authentication fails or configuration is invalid.
 */
const getAccessToken = async () => {
  try {
    validateAdobeConfig();

    const form = new FormData();
    form.append('client_id', config.adobe.apiKey);
    form.append('client_secret', config.adobe.apiSecret);
    form.append('scope', 'openid,AdobeID,firefly_api');
    form.append('grant_type', 'client_credentials');

    const requestConfig = {
      headers: form.getHeaders(),
      timeout: 30000,
    };

    log('Requesting access token from Adobe IMS...');
    const response = await axios.post('https://ims-na1.adobelogin.com/ims/token/v3', form, requestConfig);

    if (!response.data) {
      throw new Error('No response data received from Adobe IMS.');
    }

    if (!response.data.access_token || typeof response.data.access_token !== 'string') {
      throw new Error('Invalid access token received from Adobe IMS.');
    }

    if (response.data.access_token.length < 10) {
      throw new Error('Access token appears to be invalid (too short).');
    }

    log('Access token obtained successfully.');
    return response.data.access_token;

  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      error('Network error: Unable to connect to Adobe IMS. Check your internet connection.');
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    }

    if (err.code === 'ETIMEDOUT') {
      error('Request timeout: Adobe IMS request timed out.');
      throw new Error('Adobe authentication request timed out. Please try again.');
    }

    if (err.response) {
      const status = err.response.status;
      const errorData = err.response.data;

      if (status === 400) {
        error(`Bad Request (400): ${errorData?.error_description || 'Invalid request parameters'}`);
        throw new Error('Invalid API credentials or request format. Please check your Adobe API key and secret.');
      }

      if (status === 401) {
        error(`Unauthorized (401): ${errorData?.error_description || 'Authentication failed'}`);
        throw new Error('Adobe API credentials are invalid. Please verify your API key and secret.');
      }

      if (status === 403) {
        error(`Forbidden (403): ${errorData?.error_description || 'Access denied'}`);
        throw new Error('Access denied. Please check your Adobe API permissions and subscription status.');
      }

      if (status >= 500) {
        error(`Server Error (${status}): Adobe IMS service is experiencing issues.`);
        throw new Error('Adobe IMS service is temporarily unavailable. Please try again later.');
      }

      error(`HTTP Error (${status}): ${errorData?.error_description || err.message}`);
      throw new Error(`Adobe authentication failed with status ${status}. Please try again.`);
    }

    error(`Error getting access token: ${err.message}`);
    throw new Error(`Failed to authenticate with Adobe API: ${err.message}`);
  }
};

/**
 * Validates image generation parameters.
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} aspectRatio - The desired aspect ratio (e.g., '1:1').
 * @param {string} accessToken - The Adobe API access token.
 * @param {string} [styleImageId] - Optional uploaded image ID for style reference.
 * @throws {Error} If any parameter is invalid.
 */
const validateImageParams = (prompt, aspectRatio, accessToken, styleImageId) => {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('Prompt must be a non-empty string.');
  }

  if (prompt.trim().length < 10) {
    throw new Error('Prompt is too short (minimum 10 characters).');
  }

  if (prompt.length > 4000) {
    throw new Error('Prompt is too long (maximum 4000 characters).');
  }

  if (!aspectRatio || typeof aspectRatio !== 'string') {
    throw new Error('Aspect ratio must be a non-empty string.');
  }

  if (!accessToken || typeof accessToken !== 'string') {
    throw new Error('Access token must be a non-empty string.');
  }

  if (accessToken.length < 10) {
    throw new Error('Access token appears to be invalid (too short).');
  }

  if (styleImageId !== undefined && styleImageId !== null) {
    if (typeof styleImageId !== 'string' || styleImageId.trim().length === 0) {
      throw new Error('Style image ID must be a non-empty string if provided.');
    }
  }
};

/**
 * Generates an image using the Adobe Firefly Text-to-Image API.
 * @param {string} prompt - The text prompt for image generation.
 * @param {string} aspectRatio - The desired aspect ratio (e.g., '1:1').
 * @param {string} accessToken - The Adobe API access token.
 * @param {string} [styleImageId] - Optional uploaded image ID for style reference.
 * @returns {Promise<Buffer>} The image data as a Buffer.
 * @throws {Error} If image generation fails or parameters are invalid.
 */
const generateImage = async (prompt, aspectRatio, accessToken, styleImageId = null) => {
  try {
    validateImageParams(prompt, aspectRatio, accessToken, styleImageId);
    const sizeMap = {
      '1:1': { width: 1024, height: 1024 },
      '9:16': { width: 960, height: 1708 },
      '16:9': { width: 1708, height: 960 },
      '4:3': { width: 1152, height: 896 },
      '3:4': { width: 896, height: 1152 },
      '3:2': { width: 1216, height: 832 },
      '2:3': { width: 832, height: 1216 },
    };

    if (!sizeMap[aspectRatio]) {
      throw new Error(`Unsupported aspect ratio: ${aspectRatio}. Supported ratios: ${Object.keys(sizeMap).join(', ')}`);
    }

    const payload = {
      prompt: prompt.trim(),
      numVariations: 1,
      visualIntensity: 4,
      size: sizeMap[aspectRatio],
      styles: {
        presets: ['photo'],
      },
      contentClass: 'photo',
    };

    if (styleImageId) {
      payload.styles.imageReference = {
        source: {
          uploadId: styleImageId
        }
      };
      log(`Using style reference from uploaded image: ${styleImageId}`);
    }

    const requestConfig = {
      headers: {
        'X-Api-Key': config.adobe.apiKey,
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    };

    log(`Generating image with aspect ratio ${aspectRatio}...`);
    const response = await axios.post('https://firefly-api.adobe.io/v2/images/generate', payload, requestConfig);

    if (!response.data) {
      throw new Error('No response data received from Firefly API.');
    }

    if (!response.data.outputs || !Array.isArray(response.data.outputs) || response.data.outputs.length === 0) {
      throw new Error('No image outputs received from Firefly API.');
    }

    const imageOutput = response.data.outputs[0];
    if (!imageOutput.image || !imageOutput.image.presignedUrl) {
      throw new Error('Invalid image output format from Firefly API.');
    }

    log('Image generated successfully, downloading...');

    const downloadConfig = {
      responseType: 'arraybuffer',
      timeout: 60000,
    };

    const imageResponse = await axios.get(imageOutput.image.presignedUrl, downloadConfig);

    if (!imageResponse.data || imageResponse.data.byteLength === 0) {
      throw new Error('Downloaded image data is empty.');
    }

    const buffer = Buffer.from(imageResponse.data);
    
    const isPNG = buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
    const isJPEG = buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xFF, 0xD8, 0xFF]));
    const isWEBP = buffer.length >= 12 && buffer.subarray(0, 4).equals(Buffer.from('RIFF', 'ascii')) && buffer.subarray(8, 12).equals(Buffer.from('WEBP', 'ascii'));

    if (!isPNG && !isJPEG && !isWEBP) {
      error('Warning: Downloaded data does not appear to be a valid image format.');
    }

    log(`Image downloaded successfully (${buffer.length} bytes).`);
    return buffer;

  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      error('Network error: Unable to connect to Firefly API. Check your internet connection.');
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    }

    if (err.code === 'ETIMEDOUT') {
      error('Request timeout: Firefly API request timed out.');
      throw new Error('Image generation request timed out. Please try again.');
    }

    if (err.response) {
      const status = err.response.status;
      const errorData = err.response.data;

      if (status === 400) {
        error(`Bad Request (400): ${errorData?.message || 'Invalid request parameters'}`);
        throw new Error('Invalid image generation parameters. Please check your prompt and aspect ratio.');
      }

      if (status === 401) {
        error(`Unauthorized (401): ${errorData?.message || 'Invalid access token'}`);
        throw new Error('Authentication failed. Please refresh your access token and try again.');
      }

      if (status === 403) {
        error(`Forbidden (403): ${errorData?.message || 'Access denied'}`);
        throw new Error('Access denied. Please check your Adobe API permissions and subscription status.');
      }

      if (status === 429) {
        error(`Rate Limited (429): ${errorData?.message || 'Too many requests'}`);
        throw new Error('Rate limit exceeded. Please wait before making more requests.');
      }

      if (status >= 500) {
        error(`Server Error (${status}): Firefly API service is experiencing issues.`);
        throw new Error('Firefly API service is temporarily unavailable. Please try again later.');
      }

      error(`HTTP Error (${status}): ${errorData?.message || err.message}`);
      throw new Error(`Image generation failed with status ${status}. Please try again.`);
    }

    error(`Error generating image: ${err.message}`);
    throw new Error(`Failed to generate image: ${err.message}`);
  }
};

/**
 * Uploads an image to Adobe Firefly API and returns the image ID.
 * @param {string} filePath - Path to the image file to upload.
 * @param {string} accessToken - The Adobe API access token.
 * @returns {Promise<string>} The image ID that can be used in subsequent API calls.
 * @throws {Error} If upload fails or parameters are invalid.
 */
const uploadImage = async (filePath, accessToken) => {
  try {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('File path must be a non-empty string.');
    }

    if (!accessToken || typeof accessToken !== 'string') {
      throw new Error('Access token must be a non-empty string.');
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found at: ${filePath}`);
    }

    try {
      fs.accessSync(filePath, fs.constants.R_OK);
    } catch (accessError) {
      throw new Error(`Cannot read image file at ${filePath}: ${accessError.message}`);
    }

    const stats = fs.statSync(filePath);
    const fileSizeInBytes = stats.size;
    
    if (fileSizeInBytes === 0) {
      throw new Error('Image file is empty.');
    }

    const ext = path.extname(filePath).toLowerCase();
    let contentType;
    switch (ext) {
      case '.jpg':
      case '.jpeg':
        contentType = 'image/jpeg';
        break;
      case '.png':
        contentType = 'image/png';
        break;
      case '.webp':
        contentType = 'image/webp';
        break;
      default:
        throw new Error(`Unsupported image format: ${ext}. Supported formats: .jpg, .jpeg, .png, .webp`);
    }

    const stream = fs.createReadStream(filePath);

    const requestConfig = {
      method: 'post',
      url: 'https://firefly-api.adobe.io/v2/storage/image',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'X-API-Key': config.adobe.apiKey,
        'Content-Type': contentType,
        'Content-Length': fileSizeInBytes,
      },
      data: stream,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000,
    };

    log(`Uploading image: ${path.basename(filePath)} (${fileSizeInBytes} bytes)...`);
    const response = await axios(requestConfig);

    if (!response.data) {
      throw new Error('No response data received from upload API.');
    }

    if (!response.data.images || !Array.isArray(response.data.images) || response.data.images.length === 0) {
      throw new Error('No image data received from upload API.');
    }

    const imageData = response.data.images[0];
    if (!imageData.id || typeof imageData.id !== 'string') {
      throw new Error('Invalid image ID received from upload API.');
    }

    log(`Image uploaded successfully. ID: ${imageData.id}`);
    return imageData.id;

  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      error('Network error: Unable to connect to Firefly upload API. Check your internet connection.');
      throw new Error('Network connection failed. Please check your internet connection and try again.');
    }

    if (err.code === 'ETIMEDOUT') {
      error('Request timeout: Image upload request timed out.');
      throw new Error('Image upload request timed out. Please try again.');
    }

    if (err.response) {
      const status = err.response.status;
      const errorData = err.response.data;

      if (status === 400) {
        error(`Bad Request (400): ${errorData?.message || 'Invalid upload parameters'}`);
        throw new Error('Invalid image upload parameters. Please check your image file and format.');
      }

      if (status === 401) {
        error(`Unauthorized (401): ${errorData?.message || 'Invalid access token'}`);
        throw new Error('Authentication failed. Please refresh your access token and try again.');
      }

      if (status === 403) {
        error(`Forbidden (403): ${errorData?.message || 'Access denied'}`);
        throw new Error('Access denied. Please check your Adobe API permissions and subscription status.');
      }

      if (status === 413) {
        error(`Payload Too Large (413): ${errorData?.message || 'Image file too large'}`);
        throw new Error('Image file is too large. Please use a smaller image.');
      }

      if (status === 429) {
        error(`Rate Limited (429): ${errorData?.message || 'Too many requests'}`);
        throw new Error('Rate limit exceeded. Please wait before making more requests.');
      }

      if (status >= 500) {
        error(`Server Error (${status}): Firefly upload API service is experiencing issues.`);
        throw new Error('Firefly upload API service is temporarily unavailable. Please try again later.');
      }

      error(`HTTP Error (${status}): ${errorData?.message || err.message}`);
      throw new Error(`Image upload failed with status ${status}. Please try again.`);
    }

    error(`Error uploading image: ${err.message}`);
    throw new Error(`Failed to upload image: ${err.message}`);
  }
};

module.exports = { getAccessToken, generateImage, uploadImage };
