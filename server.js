// Starts the right app for this container:
//   BRIDGE_URL or BRIDGE_PASSWORD set  -> Wien Wärme only (Vienna, Intellihome bridge)   bridge.js
//   otherwise                          -> Seewärme (St. Gilgen, Home Assistant)         stg-server.js
//                                         (WIEN_INSIDE=1 also runs Wien Wärme inside it, at /wien/;
//                                         normally Wien Wärme is its own app on port 8796)
// One image, one command (node server.js).
if (process.env.BRIDGE_URL || process.env.BRIDGE_PASSWORD || process.env.HOME_ID === "wien") await import("./bridge.js");
else {
  await import("./stg-server.js");
  if (process.env.WIEN_INSIDE === "1") { process.env.WIEN_EMBEDDED = "1"; await import("./bridge.js"); }
}
