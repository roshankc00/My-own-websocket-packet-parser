const http = require("http");
const { PORT } = require("./constant");
const { checkHandshake, acceptKey } = require("./handshake");
const { parseFrames, buildFrame, OPC } = require("./frames");

const server = http.createServer((req, res) => {
  console.log(`[http] ${req.method} ${req.url}`);
  res.writeHead(404);
  res.end("Use WebSocket upgrade");
});

// fires when a client sends a websocket upgrade request
server.on("upgrade", (req, socket, head) => {
  console.log("request received");

  //   client la key pathauxa
  const { ok, key } = checkHandshake(req);
  if (!ok) {
    console.log("rejected, bad headers");
    // write into the socket 400 bad request love this
    socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
    socket.destroy();
    return;
  }

  // respond client with switching protocol and the server computed accept key
  const accept = acceptKey(key);
  socket.write(
    [
      "HTTP/1.1 101 Switching Protocols",
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Accept: ${accept}`,
      "\r\n",
    ].join("\r\n"),
  );
  socket.setNoDelay(true);
  console.log("[upgrade] accepted, socket open");

  let leftover = head && head.length ? Buffer.from(head) : Buffer.alloc(0);
  let textBuf = null;

  const send = (opcode, payload) => {
    console.log(`opcode=${opcode} len=${payload.length}`);
    socket.write(buildFrame({ opcode, payload }));
  };

  const finishText = () => {
    const msg = textBuf.toString("utf8");
    console.log(`client msf: ${msg}`);
    send(OPC.TEXT, Buffer.from(msg, "utf8"));
    textBuf = null;
  };

  const onFrame = (wsframe) => {
    switch (wsframe.opcode) {
      case OPC.TEXT:
        textBuf = textBuf
          ? Buffer.concat([textBuf, wsframe.payload])
          : wsframe.payload;
        if (wsframe.fin) finishText();
        break;

      case OPC.CONT:
        if (!textBuf) textBuf = Buffer.alloc(0);
        textBuf = Buffer.concat([textBuf, wsframe.payload]);
        if (wsframe.fin) finishText();
        break;

      case OPC.BIN:
        console.log(`[client BIN] ${wsframe.payload.length} bytes`);
        send(OPC.BIN, wsframe.payload);
        break;

      case OPC.PING:
        console.log("[client PING]");
        send(OPC.PONG, wsframe.payload);
        break;

      case OPC.CLOSE:
        console.log("client close");
        socket.write(
          buildFrame({ opcode: OPC.CLOSE, payload: wsframe.payload }),
        );
        socket.end();
        break;

      default:
        console.log(`client unknown opcode ${wsframe.opcode}, ignored`);
        break;
    }
  };

  const onBytes = (chunk) => {
    leftover = Buffer.concat([leftover, chunk]);
    try {
      leftover = parseFrames(leftover, onFrame);
    } catch (e) {
      console.log(`protocol error: ${e.message}`);
      const code = Buffer.from([0x03, 0xea]);
      const reason = Buffer.from("protocol error");
      socket.write(
        buildFrame({
          opcode: OPC.CLOSE,
          payload: Buffer.concat([code, reason]),
        }),
      );
      socket.end();
    }
  };

  if (leftover.length) onBytes(Buffer.alloc(0));

  // listen for data on the socket and call onBytes
  socket.on("data", onBytes);
  // listens for end of the socket and call socket.end()
  socket.on("end", () => {
    console.log("socket end");
    socket.end();
  });
  // listen for error on the socket and call socket.destroy()
  socket.on("error", (e) => {
    console.log(`socket error: ${e.message}`);
    socket.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`yo server listening on ws://localhost:${PORT}`);
});
