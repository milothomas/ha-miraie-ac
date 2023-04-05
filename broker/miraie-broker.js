const MqttClient = require('../mqtt/mqtt-client');
const Logger = require('../utilities/logger');

let mqttClient;
let topics;
let onStateChangedCallback;

const CMD_TYPES = {
  MODE: 'mode',
  TEMPERATURE: 'temp',
  FAN: 'fan',
  SWING: 'swing'
};

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
  if (topic.endsWith('/mode/set')) {
    return CMD_TYPES.MODE;
  }

  if (topic.endsWith('/temp/set')) {
    return CMD_TYPES.TEMPERATURE;
  }

  if (topic.endsWith('/fan/set')) {
    return CMD_TYPES.FAN;
  }

  if (topic.endsWith('/swing/set')) {
    return CMD_TYPES.SWING;
  }
};

const generateModeMessages = (basePayload, command, topic, device) => {
  if(command == "fan_only"){
    command = "fan";
  }
  let powerMsg;
  if(command == "off"){
    powerMsg = {
        topic,
        payload: {
            ...basePayload,
            ps: "off"
        }
    };
    return [powerMsg];
  }else{
    powerMsg = {
      topic,
      payload: {
          ...basePayload,
          ps: "on"
      }
    };

    if(command == "heat"){
      const modeMessage = {
          topic,
          payload: {
              ...basePayload,
              acmd: "cool"
          }
      };
      const powerfulMessage = {
          topic,
          payload: {
              ...basePayload,
              acpm: "on"
          }
      };
      if(device.status.ps == "off"){
        return [powerMsg, modeMessage, powerfulMessage];
      }else{
        if(device.modeStatus == "cool"){
          return [powerfulMessage];
        }else{
          return [modeMessage, powerfulMessage];
        }
      }

    }else{
      const modeMessage = {
        topic,
        payload: {
            ...basePayload,
            acmd: command
        }
      };
      if(device.status.ps == "off"){
        return [powerMsg, modeMessage];
      }else{
        if(device.status.acpm == "on" && command == "cool"){
          const powerfulMessage = {
              topic,
              payload: {
                  ...basePayload,
                  acpm: "off"
              }
          };
          return [powerfulMessage];
        }else{
          return [modeMessage];
        }
      }

    }
  }
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

const generateSwingMessage = (basePayload, command, topic) => {
  return [{
      topic,
      payload: {
          ...basePayload,
          acvs: parseInt(command)
      }
  }];
};

const generateMessages = (device, command, cmdType, basePayload) => {
  let topic = device.controlTopic;
  switch (cmdType) {
    case CMD_TYPES.MODE:
      return generateModeMessages(basePayload, command.toLowerCase(), topic, device);
    case CMD_TYPES.TEMPERATURE:
      return generateTemperatureMessage(basePayload, command.toLowerCase(), topic);
    case CMD_TYPES.FAN:
      return generateFanMessage(basePayload, command.toLowerCase(), topic);
    case CMD_TYPES.SWING:
      return generateSwingMessage(basePayload, command.toLowerCase(), topic);
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
  const cmdType = getCommandType(commandTopic);
  const messages = generateMessages(device, command, cmdType, basePayload);
  messages.map(m => {
    mqttClient.publish(m.topic, m.payload, 0, false, onPublishCompleted);
  });
};

MiraieBroker.prototype.disconnect = function () {
  mqttClient.disconnect();
};
