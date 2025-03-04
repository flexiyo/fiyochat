import express from "express";
import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { ApiResponse } from "./utils/ApiResponse.js";
import roomRouter from "./routes/room.routes.js";
import { setupSocketHandlers } from "./controllers/socket.controller.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));

const allowedOrigins = process.env.ALLOWED_ORIGINS;

app.use((req, res, next) => {
  const origin = req.headers?.origin || req.headers?.app_origin;
  const isApiRoute = req.path.startsWith("/api/v1");

  if (isApiRoute && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, app_origin, fiyoat, fiyort, fiyodid"
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
    } else {
      next();
    }
  } else if (!isApiRoute) {
    next();
  } else {
    res
      .status(403)
      .json(new ApiResponse(403, null, "Forbidden: Access denied"));
  }
});

app.get("/api", (req, res) => {
  res.status(200).json(new ApiResponse(200, null, "Flexiyo Auth API is live"));
});

app.get("/api/v1", (req, res) => {
  res.status(200).json(new ApiResponse(200, null, "Allowed: Access approved"));
});

app.use("/api/v1/rooms", roomRouter);

setupSocketHandlers(io);

export { server };
