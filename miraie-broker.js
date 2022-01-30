const MqttHelper = require('./mqtt-helper');
const Logger = require('./logger');

let mqttHelper;
let topics;
let onStateChangedCallback;

const CMD_TYPES = {
    MODE: 'mode',
    TEMPERATURE: 'temp',
    FAN: 'fan'
};

const generateRandomNumber = (len) => Math.floor(Math.random() * Math.pow(10, len));

const generateClientId = () => `an${generateRandomNumber(16)}${generateRandomNumber(5)}`;

const onConnected = () => {
    Logger.logDebug('MirAIe broker connected.');
    mqttHelper.subscribe(topics, { qos: 0 });
}

const onMessageReceieved = (topic, payload) => {
    if (onStateChangedCallback) {
        onStateChangedCallback(topic, payload);
    }
};

const onPublishCompleted = (e) => {
    if (e) {
        console.error('Error publishing message to MirAIe. ' + e);
    }
}

const buildBasePayload = (device) => {
    return {
        "ki": 1,
        "cnt": "an",
        "sid": "1"
    };
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
};

const generateModeMessages = (basePayload, command, topic) => {
    const powerMode = command == "off" ? "off" : "on";
    const acMode = command == "fan_only" ? "fan" : command;

    const powerMessage = {
        topic,
        payload: {
            ...basePayload,
            ps: powerMode
        }
    };

    const modeMessage = {
        topic,
        payload: {
            ...basePayload,
            acmd: acMode
        }
    };

    return [powerMessage, modeMessage];
}

const generateTemperatureMessage = (basePayload, command, topic) => {
    return [{
        topic,
        payload: {
            ...basePayload,
            "actmp": command
        }
    }];
};

const generateFanMessage = (basePayload, command, topic) => {
    return [{
        topic,
        payload: {
            ...basePayload,
            acfs: command
        }
    }];
};

const generateMessages = (topic, command, cmdType, basePayload) => {
    switch (cmdType) {
        case CMD_TYPES.MODE:
            return generateModeMessages(basePayload, command.toLowerCase(), topic);
        case CMD_TYPES.TEMPERATURE:
            return generateTemperatureMessage(basePayload, command.toLowerCase(), topic);
        case CMD_TYPES.FAN:
            return generateFanMessage(basePayload, command.toLowerCase(), topic);
    }
    return [];
};

module.exports = MiraieBroker;

function MiraieBroker(commandTopics, onStateChanged) {
    mqttHelper = new MqttHelper();
    topics = commandTopics;
    onStateChangedCallback = onStateChanged;
}

MiraieBroker.prototype.connect = function (constants, username, password) {
    const clientId = generateClientId();
    const useSsl = 'true';
    mqttHelper.connect(constants.mirAIeBrokerHost, constants.mirAIeBrokerPort, clientId, useSsl, username, password, false, onConnected, onMessageReceieved);
};

MiraieBroker.prototype.publish = function (device, command, commandTopic) {
    const basePayload = buildBasePayload(device);
    const cmdType = getCommandType(commandTopic);
    const messages = generateMessages(device.controlTopic, command, cmdType, basePayload);
    messages.map(m => mqttHelper.publish(m.topic, m.payload, 0, false, onPublishCompleted));
};
