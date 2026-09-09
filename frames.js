const { OPC } = require("./constant");

// flow here
// parses raw bytes into ws frames, and builds frames to send back
// client sends bytes over tcp, could be one frame or many frames stuck together
// we read the header first, figure out how long the payload is
// if payload is masked (always true for client frames) we unmask it byte by byte
// once we have a full frame we hand it off to onFrame
// if the bytes we have are not a full frame yet we stop and return the leftover
// leftover gets glued to the next tcp chunk that arrives, until it becomes complete

// what it does nothing just : extracts complete WebSocket frames and returns any leftover partial frame bytes.
function parseFrames(buffer, onFrame) {
  let off = 0;

  while (buffer.length - off >= 2) {
    // first header byte: fin + opcode
    const b0 = buffer[off];
    // second header byte: mask bit + length
    const b1 = buffer[off + 1];
    // fin is this the last frame of the message
    const fin = (b0 & 0x80) !== 0;
    // opcode is the type of frame
    const opcode = b0 & 0x0f;
    // mask bit is set if the payload is masked
    const masked = (b1 & 0x80) !== 0;
    // length is the length of the payload
    let len = b1 & 0x7f;

    let pos = off + 2;

    if (len === 126) {
      // 126 means real length is the next 2 bytes
      if (buffer.length - pos < 2) break;
      len = buffer.readUInt16BE(pos);
      pos += 2;
    } else if (len === 127) {
      // 127 means real length is the next 8 bytes
      if (buffer.length - pos < 8) break;
      const hi = buffer.readUInt32BE(pos);
      const lo = buffer.readUInt32BE(pos + 4);
      pos += 8;
      if (hi !== 0) throw new Error("frame too large");
      len = lo >>> 0;
    }

    let maskKey;
    if (masked) {
      if (buffer.length - pos < 4) break;
      maskKey = buffer.subarray(pos, pos + 4); // get the mask key
      pos += 4;
    }

    if (buffer.length - pos < len) break; // payload aajai sakaa xaina
    let payload = buffer.subarray(pos, pos + len);

    // unmask the payload byte by byte (XOR with the 4-byte key, repeating)
    if (masked) {
      const out = Buffer.allocUnsafe(len);
      for (let i = 0; i < len; i++) out[i] = payload[i] ^ maskKey[i % 4];
      payload = out;
    }

    console.log(`frame opcode=${opcode} fin=${fin} len=${len}`);
    onFrame({ fin, opcode, payload });

    off = pos + len;
  }

  return buffer.subarray(off);
}

// builds a complete WebSocket frame from a given opcode and payload
function buildFrame({ opcode, payload = Buffer.alloc(0), fin = true }) {
  const first = (fin ? 0x80 : 0x00) | (opcode & 0x0f); // fin + opcode
  const len = payload.length;

  if (len < 126) {
    // if length is less than 126, just append the length and the payload
    return Buffer.concat([Buffer.from([first, len]), payload]);
  }
  if (len <= 0xffff) {
    // if length is less than 65536, append the length and the payload
    const h = Buffer.alloc(4);
    h[0] = first;
    h[1] = 126;
    h.writeUInt16BE(len, 2);
    return Buffer.concat([h, payload]);
  }
  // if length is greater than 65536, append the length and the payload
  const h = Buffer.alloc(10);
  h[0] = first;
  h[1] = 127;
  h.writeUInt32BE(0, 2);
  h.writeUInt32BE(len, 6);
  return Buffer.concat([h, payload]);
}

module.exports = { parseFrames, buildFrame, OPC };
