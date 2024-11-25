import express from "express";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import http from "http";
import { setupSocketHandlers } from "./controllers/socket.controller.js";
import roomRouter from "./routes/room.routes.js";

import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

/** Configurations */
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(",") || [
      "http://localhost:8000",
      "https://flexiyo.web.app",
    ],
    methods: ["GET", "POST"],
  },
});

app.use(cookieParser());
app.use(express.json({ limit: process.env.JSON_LIMIT || "16kb" }));
app.use(
  express.urlencoded({
    extended: true,
    limit: process.env.JSON_LIMIT || "16kb",
  })
);

const allowedOrigins = ["http://localhost:3000", "https://flexiyo.web.app"];

/** Middlewares */
app.use((req, res, next) => {
  const origin = req.get("Origin");
  const isApiRoute = req.path.startsWith("/api/v1");

  if (isApiRoute && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, fiyoat, fiyort"
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
    res.status(403).json({ message: "Forbidden: Access denied" });
  }
});

/** API Routes */
app.get("/", (req, res) => {
  res.status(200).json({ message: "Flexiyo Chat Service is live..." });
});

app.get("/api/v1", (req, res) => {
  res.status(200).json({ message: "Allowed: Access approved" });
});

app.use("/api/v1/room", roomRouter);

/** Setup WebSocket Handlers */
setupSocketHandlers(io);

export { server };
