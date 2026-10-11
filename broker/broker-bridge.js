const HABroker = require('./ha-broker');
const MiraieBroker = require('./miraie-broker');
const Logger = require('../utilities/logger');

let _haBroker;
let _miraieBroker;
let _devices;
let _homeId;

const onMiraieStateChanged = function (topic, payload) {
  const device = _devices.find(d => d.statusTopic === topic || d.connectionStatusTopic === topic);
  if (!device) return;

  // Merge so state (statusTopic) and onlineStatus (connectionStatusTopic) don't overwrite each other.
  device.status = { ...device.status, ...JSON.parse(payload.toString()) };
  Logger.logDebug(`Received update from MirAIe for ${device.friendlyName}.`);

  if (device.statusTopic == topic) {    
    _haBroker.publishState(device);
  } else {
    _haBroker.publishConnectionStatus(device);
  }
};

const onHACommandReceieved = function (topic, payload) {
  const device = _devices.find(d => topic.startsWith(`miraie-ac/${d.name}/`));
  if (device) {
    Logger.logDebug(`Received update from HA for ${device.friendlyName}.`);
    _miraieBroker.publish(device, payload.toString(), topic);
  }
};

module.exports = BrokerBridge;

function BrokerBridge() {}

BrokerBridge.prototype.initialize = function (home, settings) {
  _devices = home.devices;
  _homeId = home.homeId;
  const deviceTopics = home.devices.map(d => [d.statusTopic, d.connectionStatusTopic]);
  const miraieTopics = [].concat(...deviceTopics);

  _haBroker = new HABroker(home.devices, this.onHACommandReceieved);
  _miraieBroker = new MiraieBroker(miraieTopics, this.onMiraieStateChanged);

  _haBroker.connect(settings);
  _miraieBroker.connect(home.homeId, home.accessToken);
};

BrokerBridge.prototype.onHACommandReceieved = function (topic, payload) {
  onHACommandReceieved(topic, payload);
};

BrokerBridge.prototype.onMiraieStateChanged = function (topic, payload) {
  onMiraieStateChanged(topic, payload);
};

BrokerBridge.prototype.publishDeviceStatus = function (devices) {
  devices.map(device => {
    Logger.logDebug(`Publishing status to HA for ${device.friendlyName}.`);

    _haBroker.publishState(device);
    _haBroker.publishConnectionStatus(device);
  });
};

BrokerBridge.prototype.reconnectMiraie = function (accessToken) {
  _miraieBroker.disconnect();
  _miraieBroker.connect(_homeId, accessToken);
  Logger.logDebug('MirAIe Broker reconnected with a new access token.');
};

BrokerBridge.prototype.disconnectBrokers = function () {
  if (_haBroker) {
    _haBroker.disconnect();
    Logger.logDebug('HA Broker disconnected.');
  }

  if (_miraieBroker) {
    _miraieBroker.disconnect();
    Logger.logDebug('MirAIe Broker disconnected.');
  }
};
