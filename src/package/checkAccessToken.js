import jwt from "jsonwebtoken";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const PUBLIC_KEY = readFileSync(path.resolve("./src/keys/public.pem"), "utf8");

/**
 * ✅ Verify Access Token (Used by Microservices)
 */
export function checkAccessToken({ access_token, device_id }) {
  try {
    const decoded = jwt.verify(access_token, PUBLIC_KEY, {
      algorithms: ["RS256"],
    });

    if (decoded.device_id !== device_id) {
      return false;
    }

    return decoded;
  } catch (error) {
    if (
      error.name === "TokenExpiredError" ||
      error.name === "JsonWebTokenError"
    ) {
      return false;
    }
    console.error("Error in checkAccessToken.", error);
  }
}
