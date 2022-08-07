const HABroker = require('./ha-broker');
const MiraieBroker = require('./miraie-broker');
const Logger = require('../utilities/logger');

let _haBroker;
let _miraieBroker;
let _devices;

const onMiraieStateChanged = function (topic, payload) {
  console.log(`broker bridge: MirAIe msg received on topic: ${topic}`);
  console.log(`broker bridge: payload: ${payload}`);

  const device = _devices.find(d => d.statusTopic === topic || d.connectionStatusTopic === topic);
  if (!device) return;

  device.status = JSON.parse(payload.toString());

  if (device.statusTopic == topic) {
    Logger.logDebug({
      message: 'Status updated.',
      device: device.friendlyName
    });
    _haBroker.publishState(device);
  } else {
    Logger.logDebug({
      message: 'Availability updated.',
      device: device.friendlyName
    });
    _haBroker.publishConnectionStatus(device);
  }
};

const onHACommandReceieved = function (topic, payload) {
  console.log(`broker bridge: HA msg received on topic: ${topic}`);
  console.log(`broker bridge: payload: ${payload}`);

  console.log(`device count: ${_devices.length}`);
  const device = _devices.find(d => topic.startsWith(`miraie-ac/${d.name}/`));
  if (device) {
    Logger.logDebug({
      message: 'Command received.',
      device: device.friendlyName
    });

    console.log('publishing to miraie');
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
    console.log(`publishing status for ${device.friendlyName}: ${device.status}`);

    _haBroker.publishState(device);
    _haBroker.publishConnectionStatus(device);
  });
};

BrokerBridge.prototype.disconnectBrokers = function () {
  if (_haBroker) {
    _haBroker.disconnect();
    Logger.logInfo('HA Broker disconnected');
  }

  if (_miraieBroker) {
    _miraieBroker.disconnect();
    Logger.logInfo('MirAIe Broker disconnected');
  }
};
