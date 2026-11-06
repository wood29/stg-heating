// Starts the right app for this container:
//   BRIDGE_URL or BRIDGE_PASSWORD set  -> Wien Wärme only (Vienna, Intellihome bridge)   bridge.js
//   otherwise                          -> Seewärme (St. Gilgen, Home Assistant)         stg-server.js
//                                         plus Wien Wärme inside the same container, at /wien/
//                                         (internal port 8081), so it needs no Container Station app.
// One image, one command (node server.js).
if (process.env.BRIDGE_URL || process.env.BRIDGE_PASSWORD || process.env.HOME_ID === "wien") await import("./bridge.js");
else {
  await import("./stg-server.js");
  if (process.env.WIEN_INSIDE !== "0") { process.env.WIEN_EMBEDDED = "1"; await import("./bridge.js"); }
}
