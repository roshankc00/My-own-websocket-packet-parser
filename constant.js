module.exports = {
  OPC: {
    CONT: 0x0, // yo cont frame
    TEXT: 0x1, // yo text frame
    BIN: 0x2, // yo bin frame
    CLOSE: 0x8, // yo close frame
    PING: 0x9, // yo ping frame
    PONG: 0xa, // yo pong frame
  },
  // fixed rfc 6455 guid, same for every websocket server, never changes

  WS_GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
  PORT: 4000,
};
