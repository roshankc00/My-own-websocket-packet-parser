const crypto = require("crypto");
const { WS_GUID } = require("./constant");

// flow here

// Client sends a random Sec-WebSocket-Key.
// Server appends the fixed GUID SHA-1 hashes it, base64-encodes it, and sends that back as Sec-WebSocket-Accept.
// Client independently does the exact same computation on its side with the key it sent.
// matches server one and client one accepted else rejected

// validates the handshake headers a WS client must send per RFC 6455
function checkHandshake(req) {
  const upgrade = (req.headers.upgrade || "").toLowerCase();
  const connection = (req.headers.connection || "").toLowerCase();
  const key = req.headers["sec-websocket-key"];
  const version = req.headers["sec-websocket-version"];

  const ok =
    upgrade === "websocket" &&
    connection.split(/,\s*/).includes("upgrade") &&
    key &&
    version === "13";

  console.log(`handshake dont  ok=${ok} key=${key} version=${version}`);
  return { ok, key };
}

// combines the client key with the fixed WS GUID, SHA-1 hashes it and base64-encodes the result this is the Sec-WebSocket-Accept value
function acceptKey(key) {
  return crypto
    .createHash("sha1")
    .update(key + WS_GUID)
    .digest("base64");
}

module.exports = { checkHandshake, acceptKey };
