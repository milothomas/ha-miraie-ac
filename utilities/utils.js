module.exports.generateId = function (length) {
  length = length || 5;
  return (Math.random() + 1).toString(36).substring(2, length);
};
