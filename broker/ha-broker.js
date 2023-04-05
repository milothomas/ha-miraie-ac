const MqttClient = require('../mqtt/mqtt-client');
const MqttDiscovery = require('../mqtt/mqtt-discovery');
const Utils = require('../utilities/utils');
const Logger = require('../utilities/logger');

let mqttClient;
let mqttDisco;
let topics;
let discoveredDevices;
let onCmdReceivedCallback;

const publishMessage = (topic, payload) => {
  mqttClient.publish(topic, payload, 0, false, onPublishCompleted);
};

const publishDisoveryMessages = () => {
  discoveredDevices.map(d => {
    const messages = mqttDisco.generateDiscoMessage(d);
    
    messages.map(m => {
      publishMessage(m.topic, m.payload);
    });
  });
};

const onConnected = () => {
  Logger.logInfo('HA broker connected.');
  publishDisoveryMessages();
  mqttClient.subscribe(topics, { qos: 2 });
};

const onMessageReceieved = (topic, payload) => {
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
  let mode = device.status.acmd;
  if(device.status.ps == 'off'){
      mode = 'off';
  }else if(device.status.acpm == "on"){
      mode = "heat";
  }else if(device.status.acmd == "fan"){
      mode = "fan_only";
  }
  device.modeStatus = mode;
  Logger.logDebug(`Power :${device.status.ps} , Mode: ${device.modeStatus}`);

  const modeMsg = {
    topic: device.haModeTopic,
    payload: mode
  };

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

  return [modeMsg, statusMsg, monthlyPowerConsMsg, dailyPowerConsMsg];  //actionmsg removed
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
