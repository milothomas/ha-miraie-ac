const MqttHelper = require("./mqtt-helper");
const Discovery = require("./discovery");
const Utils = require("./utils");
const Logger = require("./logger");

let mqttHelper;
let mqttDisco;
let topics;
let discoveredDevices;
let onCmdReceivedCallback;

const publishMessage = (topic, payload) => {
  console.log(
    `HA Broker publish. Message: ${
      typeof payload == "object" ? JSON.stringify(payload) : payload
    }. Topic: ${topic}`
  );
  mqttHelper.publish(topic, payload, 2, false, onPublishCompleted);
};

const publishDisoveryMessages = () => {
  discoveredDevices.map((d) => {
    const msg = mqttDisco.generateDiscoMessage(d);
    publishMessage(msg.topic, msg.payload);
  });
};

const onConnected = () => {
  Logger.logInfo("HA broker connected.");
  publishDisoveryMessages();
  mqttHelper.subscribe(topics, { qos: 2 });
};

const onMessageReceieved = (topic, payload) => {

  console.log('HA Broker message recived')
  console.log('topic:' + topic);
  console.log('message: ' + payload);
  
  if (onCmdReceivedCallback) {
    onCmdReceivedCallback(topic, payload);
  }
};

const onPublishCompleted = (e) => {
  if (e) {
    console.error("Error publishing message to HA. " + e);
  }
};

const getAction = (state) => {
  const mode = state.acmd;
  const power = state.ps;

  if (power === "off") {
    return "off";
  }

  switch (mode) {
    case "cool":
      return "cooling";
    case "dry":
      return "drying";
    case "fan":
      return "fan";
  }

  return "idle";
};

const generateAvailabilityMessage = (device) => {
  const onlineStatus = device.status.onlineStatus || false;
  const availabilityMsg = {
    topic: device.haAvailabilityTopic,
    payload: onlineStatus.toString() == "true" ? "online" : "offline",
  };

  return [availabilityMsg];
};

const generateStateMessages = (device) => {
  const actionMsg = {
    topic: device.haActionTopic,
    payload: getAction(device.status),
  };

  const statusMsg = {
    topic: device.haStatusTopic,
    payload: JSON.stringify(device.status),
  };

  return [actionMsg, statusMsg];
};

module.exports = HABroker;

function HABroker(devices, onCmdReceieved) {
  mqttHelper = new MqttHelper();
  mqttDisco = new Discovery();

  discoveredDevices = devices;
  topics = devices.map((d) => d.haCommandTopic);
  onCmdReceivedCallback = onCmdReceieved;
}

HABroker.prototype.connect = function (settings) {
  const clientId = "node-red-ha-miraie-ac-node" + Utils.generateId(5);
  mqttHelper.connect(
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
  messages.map((m) => publishMessage(m.topic, m.payload));
};

HABroker.prototype.publishConnectionStatus = function (device) {
  const messages = generateAvailabilityMessage(device);
  messages.map((m) => publishMessage(m.topic, m.payload));
};

HABroker.prototype.disconnect = function () {
  mqttHelper.disconnect();
};
