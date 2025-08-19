const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const i18next = require('i18next');
const path = require('path');
const { loadBrief, checkAssetExists, saveAsset, findProductAssets } = require('./utils/fileHandler');
const { getAccessToken, generateImage, uploadImage } = require('./services/firefly');
const { log, error } = require('./utils/logger');
const config = require('./config');
const { generateDetailedPrompt } = require('./utils/promptGenerator');


const argv = yargs(hideBin(process.argv))
  .option('brief', {
    alias: 'b',
    description: 'Path to the campaign brief file (e.g., campaign.json or /path/to/my-brief.json)',
    type: 'string',
    demandOption: true,
  })
  .option('lang', {
    alias: 'l',
    description: 'Language for the campaign message (e.g., en, es)',
    type: 'string',
    default: 'en',
  })
  .help()
  .alias('help', 'h').argv;

i18next.init({
  lng: argv.lang, 
  fallbackLng: 'en',
  resources: {
    en: {
      translation: require('./locales/en.json').translation,
    },
    es: {
      translation: require('./locales/es.json').translation,
    },
  },
});

/**
 * Validates the campaign brief structure and required fields.
 * @param {object} brief - The loaded campaign brief.
 * @throws {Error} If validation fails.
 */
const validateBrief = (brief) => {
  if (!brief) {
    throw new Error('Campaign brief is empty or invalid.');
  }

  const requiredFields = ['campaignName', 'targetAudience', 'targetRegion', 'campaignMessage', 'products'];
  const missingFields = requiredFields.filter(field => !brief[field]);
  
  if (missingFields.length > 0) {
    throw new Error(`Campaign brief is missing required fields: ${missingFields.join(', ')}`);
  }

  if (!Array.isArray(brief.products) || brief.products.length === 0) {
    throw new Error('Campaign brief must contain at least one product.');
  }

  brief.products.forEach((product, index) => {
    if (!product.name || !product.description) {
      throw new Error(`Product at index ${index} is missing required fields (name, description).`);
    }
  });
};

/**
 * Resolves the campaign brief file path, supporting both relative and absolute paths.
 * @param {string} briefInput - The brief file path provided by the user.
 * @returns {string} The resolved absolute path to the brief file.
 */
const resolveBriefPath = (briefInput) => {
  if (path.isAbsolute(briefInput)) {
    return briefInput;
  }
  
  if (briefInput.includes('/') || briefInput.includes('\\')) {
    return path.resolve(briefInput);
  }
  
  return path.join(__dirname, '..', 'inputs', 'briefs', briefInput);
};

/**
 * Validates configuration and environment setup.
 * @throws {Error} If validation fails.
 */
const validateEnvironment = () => {
  if (!config.aspectRatios || !Array.isArray(config.aspectRatios) || config.aspectRatios.length === 0) {
    throw new Error('Configuration error: aspectRatios must be defined and contain at least one ratio.');
  }

  if (!config.adobe || !config.adobe.apiKey || !config.adobe.apiSecret) {
    throw new Error('Configuration error: Adobe API credentials are missing.');
  }
};

/**
 * Main function to orchestrate the ad generation process.
 */
const main = async () => {
  let accessToken = null;
  let brief = null;
  let successCount = 0;
  let failureCount = 0;

  try {
    log('Validating environment and configuration...');
    validateEnvironment();
    log('Environment validation passed.');

    log('Authenticating with Adobe...');
    try {
      accessToken = await getAccessToken();
      log('Authentication successful.');
    } catch (authError) {
      error('Failed to authenticate with Adobe API. Please check your credentials.');
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    log('Loading campaign brief...');
    try {
      const briefPath = resolveBriefPath(argv.brief);
      log(`Resolved brief path: ${briefPath}`);
      brief = loadBrief(briefPath);
      validateBrief(brief);
      log('Campaign brief loaded and validated successfully.');
    } catch (briefError) {
      error(`Failed to load or validate campaign brief: ${briefError.message}`);
      throw new Error(`Brief loading failed: ${briefError.message}`);
    }

    log(`Starting campaign: "${brief.campaignName}"`);
    log(`Target Audience: ${brief.targetAudience}, Region: ${brief.targetRegion}`);

    let campaignMessage;
    try {
      campaignMessage = i18next.t(brief.campaignMessage);
      if (campaignMessage === brief.campaignMessage) {
        log(`Warning: No translation found for key "${brief.campaignMessage}". Using key as fallback.`);
      }
      log(`Using campaign message: "${campaignMessage}"`);
    } catch (i18nError) {
      error(`Translation error: ${i18nError.message}`);
      campaignMessage = brief.campaignMessage;
      log(`Using fallback campaign message: "${campaignMessage}"`);
    }

    for (const product of brief.products) {
      log(`Processing product: ${product.name}`);

      let productAssets = [];
      let uploadedAssetId = null;
      
      try {
        productAssets = findProductAssets(product.name);
        if (productAssets.length > 0) {
          log(`Found ${productAssets.length} asset(s) for ${product.name}: ${productAssets.map(f => path.basename(f)).join(', ')}`);
          
          try {
            uploadedAssetId = await uploadImage(productAssets[0], accessToken);
            log(`Asset uploaded for style reference: ${path.basename(productAssets[0])}`);
          } catch (uploadError) {
            error(`Failed to upload asset for ${product.name}: ${uploadError.message}`);
            log('Continuing with text-only generation...');
          }
        } else {
          log(`No assets found for ${product.name}, using text-only generation.`);
        }
      } catch (assetError) {
        error(`Error checking assets for ${product.name}: ${assetError.message}`);
        log('Continuing with text-only generation...');
      }

      for (const aspectRatio of config.aspectRatios) {
        try {
          const assetExists = checkAssetExists(product.name, aspectRatio);
          if (assetExists) {
            log(`Asset for ${product.name} (${aspectRatio}) already exists. Skipping.`);
            continue;
          }

          log(`Generating asset for ${product.name} (${aspectRatio})...`);

          let prompt;
          try {
            prompt = generateDetailedPrompt(product, brief, campaignMessage);
            log(`Using prompt: "${prompt.substring(0, 100)}..."`);
          } catch (promptError) {
            error(`Failed to generate prompt for ${product.name}: ${promptError.message}`);
            failureCount++;
            continue;
          }

          let imageData;
          try {
            if (uploadedAssetId) {
              log(`Generating image with style reference from asset...`);
              imageData = await generateImage(prompt, aspectRatio, accessToken, uploadedAssetId);
            } else {
              log(`Generating image with text-only prompt...`);
              imageData = await generateImage(prompt, aspectRatio, accessToken);
            }
          } catch (imageError) {
            error(`Failed to generate image for ${product.name} (${aspectRatio}): ${imageError.message}`);
            failureCount++;
            continue;
          }

          if (imageData) {
            try {
              saveAsset(brief.campaignName, product.name, aspectRatio, imageData);
              log(`Asset for ${product.name} (${aspectRatio}) generated and saved successfully.`);
              successCount++;
            } catch (saveError) {
              error(`Failed to save asset for ${product.name} (${aspectRatio}): ${saveError.message}`);
              failureCount++;
            }
          } else {
            error(`Failed to generate asset for ${product.name} (${aspectRatio}): No image data returned.`);
            failureCount++;
          }
        } catch (productError) {
          error(`Unexpected error processing ${product.name} (${aspectRatio}): ${productError.message}`);
          failureCount++;
          continue;
        }
      }
    }

    log('Campaign processing complete.');
    log(`Summary: ${successCount} assets generated successfully, ${failureCount} failures.`);
    
    if (failureCount > 0 && successCount === 0) {
      throw new Error('All asset generation attempts failed.');
    } else if (failureCount > 0) {
      log(`Warning: ${failureCount} assets failed to generate. Check logs for details.`);
    }

  } catch (err) {
    error(`A critical error occurred: ${err.message}`);
    
    if (brief) {
      error(`Campaign: ${brief.campaignName || 'Unknown'}`);
    }
    if (argv.brief) {
      error(`Brief file: ${argv.brief}`);
    }
    
    process.exit(1);
  }
};

main();
