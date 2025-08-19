const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { error } = require('./logger');

/**
 * Loads and parses a campaign brief from a JSON or YAML file.
 * @param {string} briefPath - Path to the brief file.
 * @returns {object} Parsed brief object.
 * @throws {Error} If file doesn't exist, can't be read, or has invalid format.
 */
const loadBrief = (briefPath) => {
  if (!briefPath || typeof briefPath !== 'string') {
    throw new Error('Brief path must be a non-empty string.');
  }

  if (!fs.existsSync(briefPath)) {
    throw new Error(`Brief file not found at: ${briefPath}`);
  }

  let fileContents;
  try {
    fs.accessSync(briefPath, fs.constants.R_OK);
    fileContents = fs.readFileSync(briefPath, 'utf8');
  } catch (readError) {
    throw new Error(`Unable to read brief file at ${briefPath}: ${readError.message}`);
  }

  if (!fileContents.trim()) {
    throw new Error(`Brief file at ${briefPath} is empty.`);
  }

  const ext = path.extname(briefPath).toLowerCase();
  
  try {
    if (ext === '.json') {
      return JSON.parse(fileContents);
    } else if (ext === '.yaml' || ext === '.yml') {
      const yamlData = yaml.load(fileContents);
      if (yamlData === null || yamlData === undefined) {
        throw new Error('YAML file contains no valid data.');
      }
      return yamlData;
    } else {
      throw new Error(`Unsupported brief format: ${ext}. Supported formats are .json, .yaml, .yml`);
    }
  } catch (parseError) {
    throw new Error(`Failed to parse brief file: ${parseError.message}`);
  }
};

/**
 * Checks if an asset file already exists for the given product and aspect ratio.
 * @param {string} productName - Name of the product.
 * @param {string} aspectRatio - Aspect ratio (e.g., "1:1").
 * @returns {boolean} True if asset exists, false otherwise.
 * @throws {Error} If parameters are invalid.
 */
const checkAssetExists = (productName, aspectRatio) => {
  if (!productName || typeof productName !== 'string') {
    throw new Error('Product name must be a non-empty string.');
  }
  
  if (!aspectRatio || typeof aspectRatio !== 'string') {
    throw new Error('Aspect ratio must be a non-empty string.');
  }

  if (!aspectRatio.includes(':')) {
    throw new Error('Aspect ratio must be in format "width:height" (e.g., "1:1").');
  }

  try {
    const formattedRatio = aspectRatio.replace(':', 'x');
    const assetPath = path.join(
      __dirname,
      '..',
      '..',
      'inputs',
      'assets',
      productName,
      `${formattedRatio}.png`
    );
    
    return fs.existsSync(assetPath);
  } catch (fsError) {
    error(`Error checking asset existence for ${productName} (${aspectRatio}): ${fsError.message}`);
    return false;
  }
};

/**
 * Saves asset data to the filesystem in the outputs directory.
 * @param {string} campaignName - Name of the campaign.
 * @param {string} productName - Name of the product.
 * @param {string} aspectRatio - Aspect ratio (e.g., "1:1").
 * @param {Buffer} data - Image data buffer.
 * @throws {Error} If parameters are invalid or file operations fail.
 */
const saveAsset = (campaignName, productName, aspectRatio, data) => {
  if (!campaignName || typeof campaignName !== 'string') {
    throw new Error('Campaign name must be a non-empty string.');
  }
  
  if (!productName || typeof productName !== 'string') {
    throw new Error('Product name must be a non-empty string.');
  }
  
  if (!aspectRatio || typeof aspectRatio !== 'string') {
    throw new Error('Aspect ratio must be a non-empty string.');
  }

  if (!aspectRatio.includes(':')) {
    throw new Error('Aspect ratio must be in format "width:height" (e.g., "1:1").');
  }
  
  if (!data || !Buffer.isBuffer(data)) {
    throw new Error('Data must be a valid Buffer.');
  }

  if (data.length === 0) {
    throw new Error('Image data buffer is empty.');
  }

  try {
    const safeCampaignName = campaignName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const dir = path.join(__dirname, '..', '..', 'outputs', safeCampaignName, productName);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    try {
      fs.accessSync(dir, fs.constants.W_OK);
    } catch (accessError) {
      throw new Error(`Output directory ${dir} is not writable: ${accessError.message}`);
    }

    const formattedRatio = aspectRatio.replace(':', 'x');
    const assetPath = path.join(dir, `${formattedRatio}.png`);
    
    fs.writeFileSync(assetPath, data);
    
    const stats = fs.statSync(assetPath);
    if (stats.size === 0) {
      throw new Error('Saved file is empty.');
    }
    
    if (stats.size !== data.length) {
      throw new Error(`File size mismatch. Expected ${data.length} bytes, got ${stats.size} bytes.`);
    }

  } catch (fsError) {
    throw new Error(`Failed to save asset: ${fsError.message}`);
  }
};

/**
 * Finds asset files in the product's assets folder.
 * @param {string} productName - Name of the product.
 * @returns {string[]} Array of absolute paths to asset files found.
 * @throws {Error} If parameters are invalid.
 */
const findProductAssets = (productName) => {
  if (!productName || typeof productName !== 'string') {
    throw new Error('Product name must be a non-empty string.');
  }

  try {
    const assetsDir = path.join(__dirname, '..', '..', 'inputs', 'assets', productName);
    
    if (!fs.existsSync(assetsDir)) {
      return [];
    }

    const files = fs.readdirSync(assetsDir);
    
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const assetFiles = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .map(file => path.join(assetsDir, file));

    return assetFiles;
  } catch (fsError) {
    error(`Error finding assets for ${productName}: ${fsError.message}`);
    return [];
  }
};

module.exports = { loadBrief, checkAssetExists, saveAsset, findProductAssets };
