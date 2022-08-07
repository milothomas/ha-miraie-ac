let _callback;
let _debugMessage;
let _logLevel;

const LOG_LEVELS = {
  OFF: { name: "OFF", value: 0 },
  DEBUG: { name: "DEBUG", value: 10 },
  INFO: { name: "INFO", value: 20 },
  WARN: { name: "WARN", value: 30 },
  ERROR: { name: "ERROR", value: 40 },
  FATAL: { name: "FATAL", value: 99 },
};

module.exports = new Logger();
function Logger() {}

Logger.prototype.initialize = function (node, logLevel, callback) {
  _callback = callback;
  _logLevel = LOG_LEVELS[logLevel] || LOG_LEVELS.INFO;
  _debugMessage = {
    id: node.id,
    z: node.z,
    _alias: node._alias,
    path: node._flow.path,
    name: node.name,
    topic: "",
  };
};

const log = function (level, data) {
  if (
    !_callback ||
    _logLevel == LOG_LEVELS.OFF ||
    level.value < _logLevel.value
  )
    return;

  _debugMessage.msg = data;
  _callback({ ..._debugMessage, level });
};

Logger.prototype.logDebug = function (data) {
  log(LOG_LEVELS.DEBUG, data);
};

Logger.prototype.logInfo = function (data) {
  log(LOG_LEVELS.INFO, data);
};

Logger.prototype.logWarning = function (data) {
  log(LOG_LEVELS.WARN, data);
};

Logger.prototype.logError = function (data) {
  log(LOG_LEVELS.ERROR, data);
};

Logger.prototype.logFatal = function (data) {
  log(LOG_LEVELS.FATAL, data);
};
