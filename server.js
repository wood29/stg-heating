// Starts the right app for this container:
//   BRIDGE_URL or BRIDGE_PASSWORD set  -> Wien Wärme (Vienna, Intellihome bridge)  bridge.js
//   otherwise                          -> Seewärme (St. Gilgen, Home Assistant)    stg-server.js
// One image, one command (node server.js), so Container Station needs no "command:" line.
if (process.env.BRIDGE_URL || process.env.BRIDGE_PASSWORD || process.env.HOME_ID === "wien") await import("./bridge.js");
else await import("./stg-server.js");
