import type { Server as IOServer } from "socket.io";

declare global {
  // eslint-disable-next-line no-var
  var ioServer: IOServer | undefined;
}

export {};
