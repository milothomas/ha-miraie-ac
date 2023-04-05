const HABroker = require('./ha-broker');
const MiraieBroker = require('./miraie-broker');
const Logger = require('../utilities/logger');

let _haBroker;
let _miraieBroker;
let _devices;

const onMiraieStateChanged = function (topic, payload) {
  const device = _devices.find(d => d.statusTopic === topic || d.connectionStatusTopic === topic);
  if (!device) return;

  device.status = JSON.parse(payload.toString());
  Logger.logDebug(`Received update from MirAIe for ${device.friendlyName}.`);

  if (device.statusTopic == topic) {    
    _haBroker.publishState(device);
  } else {
    _haBroker.publishConnectionStatus(device);
  }
};

const onHACommandReceieved = function (topic, payload) {
  const device = _devices.find(d => topic.startsWith(`/ac/${d.name}/`));
  if (device) {
    Logger.logDebug(`Received update from HA for ${device.friendlyName}.`);
    _miraieBroker.publish(device, payload.toString(), topic);
  }
};

module.exports = BrokerBridge;

function BrokerBridge() {}

BrokerBridge.prototype.initialize = function (home, settings) {
  _devices = home.devices;
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
