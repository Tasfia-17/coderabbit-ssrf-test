// Utility functions
const utils = {
  formatDate: (date) => {
    return new Date(date).toISOString();
  },

  parseJSON: (str) => {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  },

  // Intentional lint issue
  sleep: async function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

module.exports = utils;
