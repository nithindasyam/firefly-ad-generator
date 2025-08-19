/**
 * Translates high-level audience descriptions into specific visual styles.
 * @param {string} audience - The target audience from the brief (e.g., 'Gen Z').
 * @returns {string} A descriptive string for the prompt.
 * @throws {Error} If audience parameter is invalid.
 */
const getAudienceStyle = (audience) => {
  if (!audience || typeof audience !== 'string') {
    throw new Error('Audience must be a non-empty string.');
  }

  const audienceMap = {
    'gen z': 'authentic and candid, with a vibrant, energetic feel like user-generated content',
    'affluent professionals': 'aspirational, elegant, and clean with a sophisticated and minimalist aesthetic',
    'families': 'warm, inviting, and relatable, showing a happy, candid moment',
    'young adults': 'trendy, dynamic, and lifestyle-focused with contemporary appeal',
    'seniors': 'comfortable, trustworthy, and approachable with classic sensibilities',
    'professionals': 'polished, confident, and business-focused with clean lines'
  };

  const normalizedAudience = audience.toLowerCase().trim();
  return audienceMap[normalizedAudience] || 'modern and appealing'; // Safe default
};

/**
 * Generates scene-specific details based on product characteristics.
 * @param {object} product - The product object from the brief.
 * @returns {object} Scene details including setting, lighting, and mood.
 * @throws {Error} If product is invalid.
 */
const getSceneDetails = (product) => {
  if (!product || typeof product !== 'object') {
    throw new Error('Product must be a valid object.');
  }

  if (!product.name || typeof product.name !== 'string') {
    throw new Error('Product must have a valid name property.');
  }

  // Default scene details
  const defaultDetails = {
    scene: 'elegantly positioned on a clean, modern surface',
    environment: 'neutral, professionally lit studio setting',
    lighting: 'soft, even lighting that highlights the product features',
    mood: 'clean and professional'
  };

  // Product-specific customizations
  const productDetails = {
    'productA': {
      scene: 'on the edge of a vibrant, colorful poolside table',
      environment: 'bright, sunny backyard with a pool softly blurred in the background',
      lighting: 'bright, direct afternoon sun creating crisp, playful shadows',
      mood: 'energetic summer fun'
    },
    'productB': {
      scene: 'resting elegantly on a modern wooden table next to a laptop',
      environment: 'stylish, minimalist home office with soft, out-of-focus decor',
      lighting: 'soft, diffused morning light from a large window',
      mood: 'calm productivity and sophistication'
    }
  };

  return productDetails[product.name] || defaultDetails;
};

/**
 * Generates a detailed, structured prompt for the Firefly API.
 * @param {object} product - The product object from the brief.
 * @param {object} brief - The entire campaign brief object.
 * @param {string} campaignMessage - The localized campaign message.
 * @returns {string} The complete, detailed prompt.
 * @throws {Error} If any parameter is invalid or missing required properties.
 */
const generateDetailedPrompt = (product, brief, campaignMessage) => {
  // Validate input parameters
  if (!product || typeof product !== 'object') {
    throw new Error('Product must be a valid object.');
  }

  if (!product.name || typeof product.name !== 'string') {
    throw new Error('Product must have a valid name property.');
  }

  if (!product.description || typeof product.description !== 'string') {
    throw new Error('Product must have a valid description property.');
  }

  if (!brief || typeof brief !== 'object') {
    throw new Error('Brief must be a valid object.');
  }

  if (!brief.targetAudience || typeof brief.targetAudience !== 'string') {
    throw new Error('Brief must have a valid targetAudience property.');
  }

  if (!campaignMessage || typeof campaignMessage !== 'string') {
    throw new Error('Campaign message must be a non-empty string.');
  }

  try {
    const audienceStyle = getAudienceStyle(brief.targetAudience);
    const sceneDetails = getSceneDetails(product);

    // Sanitize campaign message to prevent injection issues
    const sanitizedMessage = campaignMessage.replace(/[<>{}]/g, '');

    const template = `(Core Subject & Action): An advertising photo of a ${product.description}. The product is ${sceneDetails.scene}.

(Environment & Background): The setting is a ${sceneDetails.environment}.

(Composition & Framing): Medium shot focusing on the product. The composition uses the rule of thirds, leaving some negative space.

(Lighting & Mood): The lighting is ${sceneDetails.lighting}. This should evoke a feeling of ${sceneDetails.mood}.

(Style & Quality): Photorealistic, professional commercial product photography. The image must be ultra-detailed, sharp focus, 4K, high resolution, with a shallow depth of field.

(Audience & Campaign Cues): The overall aesthetic must appeal to ${brief.targetAudience} by feeling ${audienceStyle}. The visual story must subtly convey the message: '${sanitizedMessage}'.`;

    // Validate the generated prompt
    if (!template || template.trim().length < 50) {
      throw new Error('Generated prompt is too short or empty.');
    }

    if (template.length > 4000) {
      throw new Error('Generated prompt is too long for the API.');
    }

    return template;
  } catch (error) {
    throw new Error(`Failed to generate prompt: ${error.message}`);
  }
};
  
  module.exports = { generateDetailedPrompt };