import { RedisClient } from "redis"
import SocketIO = require("socket.io")

declare global {
  namespace Express {
    interface Request {
      argv: any
      cache: RedisClient
      io: SocketIO.Server
    }
  }
}
