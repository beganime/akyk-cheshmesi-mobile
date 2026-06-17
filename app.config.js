const appJson = require('./app.json');

const useLocalApiProxy = process.env.AKYL_USE_LOCAL_API_PROXY === '1';

module.exports = () => {
  const expo = appJson.expo;

  return {
    ...expo,
    extra: {
      ...expo.extra,
      apiBaseUrl: useLocalApiProxy
        ? 'http://localhost:8090/api/v1'
        : expo.extra.apiBaseUrl,
    },
  };
};
