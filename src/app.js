import express from "express";
import http from "http";
import dotenv from "dotenv";
import { Server } from "socket.io";
import { setupSocketHandlers } from "./controllers/socket.controller.js";
import { ApiResponse } from "./utils/ApiResponse.js";
import roomRouter from "./routes/room.routes.js";

dotenv.config();

const allowedOrigins = ["flexiyo://fiyo", "https://flexiyo.web.app"];

/** Configurations */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || allowedOrigins,
    methods: ["GET", "POST"],
  },
});

/** Middlewares */
app.use(express.json({ limit: process.env.JSON_LIMIT || "16kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.JSON_LIMIT || "16kb",
  })
);

app.use((req, res, next) => {
  const origin = req.headers?.origin || req.headers?.app_origin;
  const isApiRoute = req.path.startsWith("/api/v1");

  if (isApiRoute && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, app_origin fiyoat, fiyort, fiyodid"
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
      .json(new ApiResponse(403, null, "Forbidden: Access Denied"));
  }
});

/** API Routes */
app.get("/", (req, res) => {
  res
    .status(200)
    .json(new ApiResponse(200, null, "Flexiyo Chat Server is live..."));
});

app.get("/api/v1", (req, res) => {
  res.status(200).json(new ApiResponse(200, null, "Allowed: Access approved"));
});

app.use("/api/v1/rooms", roomRouter);

/** Setup WebSocket Handlers */
setupSocketHandlers(io);

export { server };
