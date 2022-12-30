module.exports.getSecureObject = (object) => {
  const skipKeys = ['password'],
        doc = object._doc,
        result = {};
  Object.entries(doc).forEach(([key, value]) => {
    if (!skipKeys.includes(key)) result[key] = value;
  });
  return result;
}