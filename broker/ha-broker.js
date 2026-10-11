const MqttClient = require('../mqtt/mqtt-client');
const MqttDiscovery = require('../mqtt/mqtt-discovery');
const Utils = require('../utilities/utils');
const Logger = require('../utilities/logger');

let mqttClient;
let mqttDisco;
let topics;
let discoveryPrefix;
let discoveredDevices;
let onCmdReceivedCallback;

const publishMessage = (topic, payload) => {
  mqttClient.publish(topic, payload, 0, false, onPublishCompleted);
};

const publishDisoveryMessages = () => {
  discoveredDevices.map(d => {
    const messages = mqttDisco.generateDiscoMessage(d, discoveryPrefix);
    
    messages.map(m => {
      publishMessage(m.topic, m.payload);
    });
  });
};

const getHAStatusTopic = () => `${discoveryPrefix}/status`;

// HA forgets non-retained discovery, state and availability when it restarts.
const republishAll = () => {
  publishDisoveryMessages();
  discoveredDevices
    .filter(d => d.status)
    .map(d => {
      generateStateMessages(d).map(m => publishMessage(m.topic, m.payload));
      generateAvailabilityMessage(d).map(m => publishMessage(m.topic, m.payload));
    });
};

const onConnected = () => {
  Logger.logInfo('HA broker connected.');
  publishDisoveryMessages();
  mqttClient.subscribe([...topics, getHAStatusTopic()], { qos: 2 });
};

const onMessageReceieved = (topic, payload) => {
  if (topic === getHAStatusTopic()) {
    if (payload.toString() === 'online') {
      Logger.logInfo('Home Assistant came online, republishing devices.');
      republishAll();
    }
    return;
  }

  if (onCmdReceivedCallback) {
    onCmdReceivedCallback(topic, payload);
  }
};

const onPublishCompleted = e => {
    e && Logger.logError(`Error publishing message to HA. ${e}`);
};

const getAction = state => {
  const mode = state.acmd;
  const power = state.ps;

  if (power === 'off') {
    return 'off';
  }

  switch (mode) {
    case 'cool':
      return 'cooling';
    case 'dry':
      return 'drying';
    case 'fan':
      return 'fan';
  }

  return 'idle';
};

const generateAvailabilityMessage = device => {
  const onlineStatus = device.status.onlineStatus || false;
  const availabilityMsg = {
    topic: device.haAvailabilityTopic,
    payload: onlineStatus.toString() == 'true' ? 'online' : 'offline'
  };

  Logger.logDebug(`Availability updated for ${device.friendlyName}: ${availabilityMsg.payload}`);
  return [availabilityMsg];
};

const generateStateMessages = device => {
  const actionMsg = {
    topic: device.haActionTopic,
    payload: getAction(device.status)
  };

  const statusMsg = {
    topic: device.haStatusTopic,
    payload: JSON.stringify(device.status)
  };

  const monthlyPowerConsMsg = {
    topic: device.haMonthlyPwrTopic,
    payload: device.consumption.monthly.toString()
  }

  const dailyPowerConsMsg = {
    topic: device.haDailyPwrTopic,
    payload: device.consumption.daily.toString()
  }

  return [actionMsg, statusMsg, monthlyPowerConsMsg, dailyPowerConsMsg];
};

module.exports = HABroker;

function HABroker(devices, onCmdReceieved) {
  mqttClient = new MqttClient();
  mqttDisco = new MqttDiscovery();

  discoveredDevices = devices;
  topics = devices.map(d => d.haCommandTopic);
  onCmdReceivedCallback = onCmdReceieved;
}

HABroker.prototype.connect = function (settings) {
  const clientId = 'node-red-ha-miraie-ac-node' + Utils.generateId(5);
  discoveryPrefix = settings.haDiscoveryPrefix;
  mqttClient.connect(
    settings.haBrokerHost,
    settings.haBrokerPort,
    clientId,
    settings.useSsl,
    settings.haBrokerUsername,
    settings.haBrokerPassword,
    settings.useCleanSession,
    onConnected,
    onMessageReceieved
  );
};

HABroker.prototype.publishState = function (device) {
  const messages = generateStateMessages(device);
  messages.map(m => publishMessage(m.topic, m.payload));
};

HABroker.prototype.publishConnectionStatus = function (device) {
  const messages = generateAvailabilityMessage(device);
  messages.map(m => publishMessage(m.topic, m.payload));
};

HABroker.prototype.disconnect = function () {
  mqttClient.disconnect();
};
