require('dotenv').config();

module.exports = {
  adobe: {
    apiKey: process.env.ADOBE_API_KEY,
    apiSecret: process.env.ADOBE_API_SECRET,
  },
  aspectRatios: ['1:1', '9:16', '16:9'],
};
