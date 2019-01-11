import { RedisClient } from "redis"

declare global {
  namespace Express {
    interface Request {
      argv: any
      cache: RedisClient
    }
  }
}
