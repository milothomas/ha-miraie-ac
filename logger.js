let enableLogging = false;

module.exports = new Logger();

function Logger () {}

Logger.prototype.log = function(message) {
    enableLogging && console.log(`${(new Date()).toISOString()}: ${message}\n`);
}

Logger.prototype.enable = function(message) {
    enableLogging = true;
}

Logger.prototype.disable = function(message) {
    enableLogging = false;
}