const MqttClient = require('../mqtt/mqtt-client');
const Logger = require('../utilities/logger');

let mqttClient;
let topics;
let onStateChangedCallback;

const CMD_TYPES = {
  POWER: 'power',
  MODE: 'mode',
  TEMPERATURE: 'temp',
  FAN: 'fan',
  RAW: 'raw'
};

// HA command topic segment -> MirAIe key, for commands that only set that key.
const SIMPLE_COMMANDS = new Map([
  ['swing', 'acvs'],
  ['h-swing', 'achs'],
  ['converti', 'cnv'],
  ['display', 'acdc'],
  ['powerful', 'acpm'],
  ['eco', 'acem'],
  ['clean', 'acec'],
  ['buzzer', 'bzr']
]);

const NUMERIC_KEYS = ['acvs', 'achs', 'cnv'];

const brokerDetails = {
  host: 'mqtt.miraie.in',
  port: 8883,
  useSsl: 'true'
};

const generateRandomNumber = len => Math.floor(Math.random() * Math.pow(10, len));

const generateClientId = () => `an${generateRandomNumber(16)}${generateRandomNumber(5)}`;

const onConnected = () => {
  Logger.logInfo('MirAIe broker connected.');
  mqttClient.subscribe(topics, { qos: 0 });
};

const onMessageReceieved = (topic, payload) => {
  if (onStateChangedCallback) {
    onStateChangedCallback(topic, payload);
  }
};

const onPublishCompleted = e => {
  e && Logger.logError(`Error publishing message to MirAIe. ${e}`);
};

const buildBasePayload = () => {
  return { ki: 1, cnt: 'an', sid: '1' };
};

const getCommandType = topic => {
  if (topic.endsWith('/power/set')) {
    return CMD_TYPES.POWER;
  }

  if (topic.endsWith('/mode/set')) {
    return CMD_TYPES.MODE;
  }

  if (topic.endsWith('/temp/set')) {
    return CMD_TYPES.TEMPERATURE;
  }

  if (topic.endsWith('/fan/set')) {
    return CMD_TYPES.FAN;
  }

  if (topic.endsWith('/raw/set')) {
    return CMD_TYPES.RAW;
  }
};

const generatePowerMessage = (basePayload, command, topic) => {
  return [
    {
      topic,
      payload: {
        ...basePayload,
        ps: command
      }
    }
  ];
};

// One message per change so the AC beeps once; 'off' has no matching acmd value.
const generateModeMessages = (basePayload, command, topic) => {
  if (command == 'off') {
    return generatePowerMessage(basePayload, 'off', topic);
  }

  const acMode = command == 'fan_only' ? 'fan' : command;

  return [
    {
      topic,
      payload: {
        ...basePayload,
        ps: 'on',
        acmd: acMode
      }
    }
  ];
};

const generateTemperatureMessage = (basePayload, command, topic) => {
  return [
    {
      topic,
      payload: {
        ...basePayload,
        actmp: command
      }
    }
  ];
};

const generateFanMessage = (basePayload, command, topic) => {
  return [
    {
      topic,
      payload: {
        ...basePayload,
        acfs: command
      }
    }
  ];
};

const getSimpleCommandKey = topic => SIMPLE_COMMANDS.get(topic.split('/').slice(-2)[0]);

const generateSimpleMessage = (basePayload, key, command, topic) => {
  const value = NUMERIC_KEYS.includes(key) ? parseInt(command) : command.toLowerCase();
  if (Number.isNaN(value)) {
    Logger.logError(`Invalid value for ${key}: ${command}`);
    return [];
  }

  return [
    {
      topic,
      payload: {
        ...basePayload,
        [key]: value
      }
    }
  ];
};

// Sends an arbitrary JSON object of MirAIe keys, e.g. {"acdc":"off"}, for experimenting.
const generateRawMessage = (basePayload, command, topic) => {
  let fields;
  try {
    fields = JSON.parse(command);
  } catch (e) {
    Logger.logError(`Invalid JSON on raw command: ${command}`);
    return [];
  }

  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    Logger.logError(`Raw command must be a JSON object: ${command}`);
    return [];
  }

  return [
    {
      topic,
      payload: {
        ...basePayload,
        ...fields
      }
    }
  ];
};

const generateMessages = (topic, command, cmdType, basePayload) => {
  switch (cmdType) {
    case CMD_TYPES.POWER:
      return generatePowerMessage(basePayload, command.toLowerCase(), topic);
    case CMD_TYPES.MODE:
      return generateModeMessages(basePayload, command.toLowerCase(), topic);
    case CMD_TYPES.TEMPERATURE:
      return generateTemperatureMessage(basePayload, command.toLowerCase(), topic);
    case CMD_TYPES.FAN:
      return generateFanMessage(basePayload, command.toLowerCase(), topic);
    case CMD_TYPES.RAW:
      return generateRawMessage(basePayload, command, topic);
  }
  return [];
};

module.exports = MiraieBroker;

function MiraieBroker(commandTopics, onStateChanged) {
  mqttClient = new MqttClient();
  topics = commandTopics;
  onStateChangedCallback = onStateChanged;
}

MiraieBroker.prototype.connect = function (username, password) {
  const clientId = generateClientId();
  const useSsl = brokerDetails.useSsl;
  const host = brokerDetails.host;
  const port = brokerDetails.port;
  mqttClient.connect(host, port, clientId, useSsl, username, password, false, onConnected, onMessageReceieved);
};

MiraieBroker.prototype.publish = function (device, command, commandTopic) {
  const basePayload = buildBasePayload(device);
  const key = getSimpleCommandKey(commandTopic);
  const messages = key
    ? generateSimpleMessage(basePayload, key, command, device.controlTopic)
    : generateMessages(device.controlTopic, command, getCommandType(commandTopic), basePayload);
  messages.map(m => {
    mqttClient.publish(m.topic, m.payload, 0, false, onPublishCompleted);
  });
};

MiraieBroker.prototype.disconnect = function () {
  mqttClient.disconnect();
};
