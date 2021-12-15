# ha-miraie-ac
Home Assistant integration with MirAIe air conditioners using NodeRed over MQTT

Since there is no official HA integration with Panasonic MirAIe air conditioners, this node will provide a bridge between the MirAIe MQTT broker and the local 
MQTT broker receieving updates from the device and updating the state on HA as well as accepting commands from HA to control the device.

## MirAIe Authentication
Authenticate over http using the registered mobile number and password

## Device Discovery
Once authenticated, the list of devices is pulled down exposed to HA using MQTT discovery.

---
## TODO
1. Show debug messages to help with troubleshooting
2. The MQTT discovery prefix is hard coded to "homeassisstant", this should be configurable on the node.
3. Follow coding standards and best practices
