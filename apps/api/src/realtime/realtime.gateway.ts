import {
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "socket.io";

@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000", credentials: true },
  namespace: "/live",
})
export class RealtimeGateway {
  @WebSocketServer()
  server!: Server;

  emitOrg(organizationId: string, event: string, payload: unknown) {
    this.server?.to(`org:${organizationId}`).emit(event, payload);
  }

  emitCall(callId: string, event: string, payload: unknown) {
    this.server?.to(`call:${callId}`).emit(event, payload);
  }
}
