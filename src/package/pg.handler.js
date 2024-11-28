import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: "../../.env" });

/**
 * Verifies the given access token.
 *
 * @param {string} accessToken - The access token to be verified.
 *
 * @returns {Promise<{status: number, message: string, userId: string}>} -
 *   A promise that resolves to an object containing the status of the
 *   verification, the message, and the user id associated with the token.
 */

const sql = postgres({
  connectionString: process.env.AUTH_DB_URI,
  max: 20,
  idle_timeout: 5,
  connect_timeout: 5,
});

export const checkAccessToken = async (accessToken) => {
  try {
    if (!accessToken) {
      return { status: 401, message: "Access token is required" };
    }

    const payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);

    const result = await sql`
      SELECT id, username, email, avatar
      FROM users
      WHERE id = ${payload.userId} AND tokens->>'at' = ${accessToken}
    `;

    if (result.length === 0) {
      return { status: 401, message: "Access token mismatch or user not found" };
    }

    return {
      status: 200,
      message: "ok",
      data: result[0],
    };
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return { status: 401, message: "Access token has expired" };
    }
    console.error("Token verification failed:", error);
    return { status: 500, message: "Internal server error" };
  }
};

export const registerUserRooms = async (roomId, memberIds) => {
  try {
    await sql`
      UPDATE users
      SET rooms = COALESCE(rooms, '[]'::jsonb) || to_jsonb(${roomId}::text)
      WHERE id = ANY(${sql.array(memberIds, 'uuid')})
    `;
    return { status: 200, message: "Rooms updated successfully" };
  } catch (error) {
    console.error("Error updating user rooms:", error);
    return { status: 500, message: `Database operation failed: ${error.message}` };
  }
};
