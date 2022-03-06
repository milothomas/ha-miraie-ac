const MqttHelper = require('./mqtt-helper');
const Discovery = require('./discovery');
const Logger = require('./logger');

let mqttHelper;
let mqttDisco;
let topics;
let discoveredDevices;
let onCmdReceivedCallback;

const publishMessage = (topic, payload) => {
    mqttHelper.publish(topic, payload, 2, false, onPublishCompleted);
};

const publishDisoveryMessages = () => {
    discoveredDevices.map(d => {
        const msg = mqttDisco.generateDiscoMessage(d);
        publishMessage(msg.topic, msg.payload);
    });
};

const onConnected = () => {
    Logger.logInfo('HA broker connected.');
    publishDisoveryMessages();
    mqttHelper.subscribe(topics, { qos: 2 });
};

const onMessageReceieved = (topic, payload) => {
    if (onCmdReceivedCallback) {
        onCmdReceivedCallback(topic, payload);
    }
};

const onPublishCompleted = (e) => {
    if (e) {
        console.error('Error publishing message to HA. ' + e);
    }
}

const getAction = (state) => {
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

const generateAvailabilityMessage = (device, state) => {
    const availabilityMsg = {
        topic: device.haAvailabilityTopic,
        payload: state.onlineStatus === "true" ? "online" : "offline"
    };

    return [availabilityMsg];
}

const generateStateMessages = (device, state) => {
    const actionMsg = {
        topic: device.haActionTopic,
        payload: getAction(state)
    };

    const statusMsg = {
        topic: device.haStatusTopic,
        payload: JSON.stringify(state)
    };

    return [actionMsg, statusMsg];
}

module.exports = HABroker;

function HABroker(devices, onCmdReceieved) {
    mqttHelper = new MqttHelper();
    mqttDisco = new Discovery();

    discoveredDevices = devices;
    topics = devices.map(d => d.haCommandTopic);
    onCmdReceivedCallback = onCmdReceieved;
}

HABroker.prototype.connect = function (settings) {
    const clientId = 'node-red-ha-miraie-ac-node';
    mqttHelper.connect(settings.haBrokerHost, settings.haBrokerPort, clientId, settings.useSsl, settings.haBrokerUsername, settings.haBrokerPassword, settings.useCleanSession, onConnected, onMessageReceieved);
};

HABroker.prototype.publishState = function (device, state) {
    const stateObj = JSON.parse(state);
    const messages = generateStateMessages(device, stateObj);
    messages.map(m => publishMessage(m.topic, m.payload));
};

HABroker.prototype.publishConnectionStatus = function (device, state) {
    const stateObj = JSON.parse(state);
    const messages = generateAvailabilityMessage(device, stateObj);
    messages.map(m => publishMessage(m.topic, m.payload));
};

HABroker.prototype.disconnect = function() {
    mqttHelper.disconnect();
};
