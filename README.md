# Firefly Ad Generator

A Node.js automation tool for generating creative assets for social media ad campaigns using Adobe Firefly's Text-to-Image API v2. The application processes campaign briefs, validates existing assets, and generates missing creative variations across multiple aspect ratios with intelligent prompt engineering.

## Architecture Overview

### Project Structure
```
firefly-ad-generator/
├── src/
│   ├── main.js                 # Entry point and orchestration logic
│   ├── config/
│   │   └── index.js            # Configuration and environment variable management
│   ├── services/
│   │   └── firefly.js          # Adobe Firefly API integration
│   ├── utils/
│   │   ├── fileHandler.js      # File system operations and data persistence
│   │   ├── logger.js           # Logging utilities
│   │   └── promptGenerator.js  # AI prompt engineering and generation
│   └── locales/
│       ├── en.json             # English translations
│       └── es.json             # Spanish translations
├── inputs/
│   ├── briefs/                 # Campaign brief definitions
│   └── assets/                 # Product reference images (organized by product name)
├── outputs/                    # Generated assets (organized by campaign/product/ratio)
└── package.json                # Dependencies and scripts
```

### Core Components

- **Main Orchestrator** (`main.js`): Command-line interface, validation, and workflow coordination
- **Firefly Service** (`firefly.js`): Adobe IMS authentication, image upload, and image generation API calls
- **File Handler** (`fileHandler.js`): Asset management, campaign brief parsing (JSON/YAML), product asset discovery
- **Prompt Generator** (`promptGenerator.js`): Sophisticated prompt engineering with audience targeting
- **Internationalization**: i18next-based localization for campaign messages

## Prerequisites

### System Requirements
- Node.js ≥ 14.x
- npm ≥ 6.x
- Internet connectivity for Adobe API calls

### Adobe Firefly API Access
- Valid Adobe Developer Console project with Firefly API access
- `ADOBE_API_KEY` (Client ID from Adobe Developer Console)
- `ADOBE_API_SECRET` (Client Secret from Adobe Developer Console)
- Active Adobe Creative Cloud subscription with Firefly API credits

## Installation & Setup

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd firefly-ad-generator
npm install
```

### 2. Environment Configuration
Create `.env` file in project root:
```bash
# Adobe Developer Console credentials
ADOBE_API_KEY=your_client_id_here
ADOBE_API_SECRET=your_client_secret_here
```

**Security Note**: Never commit `.env` files. The file is already included in `.gitignore`.

### 3. Verify Installation
```bash
# Check linting
npm run lint

# Format code
npm run format

# Test basic functionality (requires valid credentials)
npm start -- --brief=campaign.json --lang=en
```

## Usage

### Command Line Interface
```bash
npm start -- --brief=<brief_file_path> [--lang=<language>]
```

#### Parameters
- `--brief` (required): Path to campaign brief file (supports multiple formats)
- `--lang` (optional): Language code for campaign messages (default: `en`)

#### Brief File Path Options
1. **Filename only**: Looks in `inputs/briefs/` directory
2. **Relative path**: Resolved from current working directory
3. **Absolute path**: Used directly as specified

#### Examples
```bash
# Filename only (traditional usage)
npm start -- --brief=campaign.json

# Relative path from project root
npm start -- --brief=inputs/briefs/campaign.json

# Relative path from current directory
npm start -- --brief=../my-campaigns/summer.json

# Absolute path
npm start -- --brief=/home/user/campaigns/my-campaign.json

# Spanish localization with any path format
npm start -- --brief=summer_campaign.json --lang=es

# Alternative syntax
npm start -- -b /path/to/campaign.json -l es
```

### Campaign Brief Format

Campaign briefs support both JSON and YAML formats:

#### JSON Format (`inputs/briefs/campaign.json`)
```json
{
  "campaignName": "Summer Ad Campaign",
  "products": [
    {
      "name": "productA",
      "description": "A refreshing summer drink"
    },
    {
      "name": "productB", 
      "description": "Stylish sunglasses for the summer"
    }
  ],
  "targetRegion": "US",
  "targetAudience": "Gen Z",
  "campaignMessage": "get_ready_for_summer"
}
```

#### YAML Format (`inputs/briefs/campaign.yml`)
```yaml
campaignName: Summer Ad Campaign
products:
  - name: productA
    description: A refreshing summer drink
  - name: productB
    description: Stylish sunglasses for the summer
targetRegion: US
targetAudience: Gen Z
campaignMessage: get_ready_for_summer
```

#### Required Fields
- `campaignName`: Campaign identifier (used for output directory naming)
- `products`: Array of product objects with `name` and `description`
- `targetAudience`: Target demographic (affects visual style generation)
- `targetRegion`: Geographic target (currently informational)
- `campaignMessage`: Localization key for campaign messaging

### Product Assets (Style References)

The application supports using existing product images as style references for generation. When available, these images are automatically uploaded to Adobe Firefly and used to guide the visual style of generated ads.

#### Asset Organization
Place product reference images in the `inputs/assets/` directory, organized by product name:

```
inputs/assets/
├── productA/
│   ├── hero-image.jpg
│   ├── lifestyle-shot.png
│   └── product-variant.webp
└── productB/
    ├── main-product.jpeg
    └── alternate-view.jpg
```

#### Supported Image Formats
- **JPEG** (`.jpg`, `.jpeg`)
- **PNG** (`.png`) 
- **WebP** (`.webp`)

#### Asset Usage Logic
1. **Asset Discovery**: For each product, the system searches `inputs/assets/{productName}/` for image files
2. **Automatic Upload**: If assets are found, the first image is uploaded to Adobe Firefly API
3. **Style Reference**: The uploaded image ID is used as a style reference in the generation request
4. **Fallback**: If no assets exist or upload fails, generation continues with text-only prompts

#### Example Usage
```bash
# With assets - generates style-guided images
npm start -- --brief=campaign.json

# Output shows asset discovery and upload:
# [INFO] Found 1 asset(s) for productA: hero-image.jpg
# [INFO] Asset uploaded for style reference: hero-image.jpg
# [INFO] Generating image with style reference from asset...
```

**Benefits of Using Product Assets:**
- **Visual Consistency**: Generated ads maintain your product's visual style
- **Brand Alignment**: Automatic adherence to your product's aesthetic
- **Quality Improvement**: Style references typically produce more accurate and branded results
- **Effortless Setup**: Simply place images in the appropriate folders—no additional configuration needed

### Supported Audience Types
The prompt generator includes optimized styles for:
- `Gen Z`: Authentic, vibrant, UGC-style aesthetics
- `Affluent Professionals`: Sophisticated, minimalist, aspirational
- `Families`: Warm, inviting, relatable scenarios
- `Young Adults`: Trendy, dynamic, lifestyle-focused
- `Seniors`: Comfortable, trustworthy, classic sensibilities
- `Professionals`: Polished, confident, business-focused

## Technical Implementation

### Authentication Flow
1. **OAuth 2.0 Client Credentials Grant** with Adobe IMS
2. **API Endpoint**: `https://ims-na1.adobelogin.com/ims/token/v3`
3. **Required Scope**: `openid,AdobeID,firefly_api`
4. **Token Validation**: Automatic validation with retry logic

### Image Generation Pipeline
1. **Asset Discovery**: Scans `inputs/assets/{productName}/` for reference images
2. **Asset Upload**: Uploads found images to Adobe Firefly storage API (7-day validity)
3. **Asset Existence Check**: Prevents duplicate generation of final outputs
4. **Prompt Engineering**: Audience-specific visual style application
5. **API Request**: Adobe Firefly v2 Text-to-Image endpoint with optional style reference
6. **Response Handling**: Presigned URL download with validation
7. **File Persistence**: Organized output structure with atomic writes

### Supported Aspect Ratios
Configured in `src/config/index.js`:
- `1:1` (2048×2048) - Square/Instagram feed
- `9:7` (2304×1792) - Vertical/Instagram Stories
- `16:9` (2688×1512) - Horizontal/YouTube thumbnails
- Additional ratios: `4:3`, `3:4`, `3:2`, `2:3`

### Error Handling & Resilience
- **Comprehensive validation** at each pipeline stage
- **Detailed error categorization** (network, authentication, API limits)
- **Graceful degradation** with partial success reporting
- **File system safety** with atomic operations and rollback

### Prompt Engineering Strategy
Dynamic prompt generation with:
- **Structured templates** for consistent quality
- **Audience-specific styling** based on demographic research
- **Product-aware scene composition** with contextual environments
- **Campaign message integration** with sanitization
- **Technical specifications** (4K, photorealistic, commercial quality)

## Output Structure

Generated assets are organized hierarchically:
```
outputs/
└── <campaign_name>/
    └── <product_name>/
        ├── 1x1.png      # Square format
        ├── 9x16.png     # Vertical/Stories
        └── 16x9.png     # Horizontal/Landscape
```

Campaign names are sanitized for filesystem compatibility (special characters → underscores, lowercase).

## Configuration

### Aspect Ratio Mapping
```javascript
// src/config/index.js
const sizeMap = {
  '1:1': { width: 1024, height: 1024 },
  '9:16': { width: 960, height: 1708 },
  '16:9': { width: 1708, height: 960 }
  // Additional ratios available
};
```

### API Parameters
- **numVariations**: 1 (single image per request)
- **visualIntensity**: 4 (balanced creative interpretation)
- **contentClass**: 'photo' (photorealistic output)
- **styles.presets**: ['photo'] (commercial photography style)
- **styles.imageReference**: Optional uploaded image ID for style guidance

##  Code Quality
### Code Standards
- **ESLint**: ESLint recommended + Prettier integration
- **Prettier**: 2-space tabs, single quotes, trailing commas
- **Node.js**: ES2021, CommonJS modules
- **Error Handling**: Comprehensive try-catch with detailed messaging

### Dependencies
**Production:**
- `axios`: HTTP client for API requests
- `dotenv`: Environment variable management
- `form-data`: Multipart form data for authentication
- `i18next`: Internationalization framework
- `js-yaml`: YAML parsing support
- `yargs`: Command-line argument parsing

**Development:**
- `eslint`: Code linting and style enforcement
- `eslint-config-prettier`: ESLint-Prettier integration
- `prettier`: Code formatting

## Troubleshooting

### Common Issues

**Authentication Failures:**
```bash
# Verify credentials format
echo $ADOBE_API_KEY | wc -c  # Should be >20 characters
echo $ADOBE_API_SECRET | wc -c  # Should be >20 characters

# Test API connectivity
curl -X POST https://ims-na1.adobelogin.com/ims/token/v3 \
  -F client_id="$ADOBE_API_KEY" \
  -F client_secret="$ADOBE_API_SECRET" \
  -F grant_type="client_credentials" \
  -F scope="openid,AdobeID,firefly_api"
```

**Brief File Not Found:**
```bash
# Check if file exists at specified path
ls -la /path/to/your/campaign.json

# Verify current working directory
pwd

# Test relative path resolution
realpath inputs/briefs/campaign.json
```

**No Assets Found:**
- Ensure folder names match product names in campaign brief exactly
- Verify image files have supported extensions (.jpg, .jpeg, .png, .webp)
- Check file permissions are readable

### Debug Mode
Enable verbose logging by modifying `src/utils/logger.js` or set environment variables:
```bash
DEBUG=firefly:* npm start -- --brief=campaign.json
```

## Limitations

### Current Limitations
- **Single Reference Image**: Uses only the first found asset per product
- **Single Variation**: Generates one image per aspect ratio
- **No Brand Compliance**: Manual review required for brand guidelines
- **Static Prompts**: Limited dynamic prompt adaptation
- **Sequential Processing**: No parallel image generation
