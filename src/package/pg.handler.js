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

    let payload;
    try {
      payload = jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return { status: 401, message: "Access token has expired" };
      }
      return { status: 401, message: "Invalid access token" };
    }

    const result = await sql`
      SELECT id, full_name, username, email, gender, dob, profession, bio, account_type, is_private, avatar, banner, created_at, rooms
      FROM users
      WHERE id = ${payload.userId} AND tokens->>'at' = ${accessToken}
    `;

    if (result.length === 0) {
      return {
        status: 401,
        message: "Access token mismatch or user not found",
      };
    }

    const user = result[0];

    return {
      status: 200,
      message: "ok",
      data: {
        userId: user.id,
        fullName: user.full_name,
        username: user.username,
        email: user.email,
        gender: user.gender,
        dob: user.dob,
        profession: user.profession,
        bio: user.bio,
        accountType: user.account_type,
        isPrivate: user.is_private,
        avatar: user.avatar,
        banner: user.banner,
        createdAt: user.created_at,
        rooms: user.rooms,
      },
    };
  } catch (error) {
    throw new Error(`Error in checkAccessToken: ${error}`);
  }
};

export const registerUserRooms = async (roomId, memberIds) => {
  try {
    await sql.unsafe(
      `
       UPDATE users
      SET rooms = COALESCE(rooms, '[]'::jsonb) || to_jsonb($1::text)
      WHERE id = ANY($2::uuid[])
      `,
      [roomId, memberIds]
    );
    return true;
  } catch (error) {
    throw new Error(`Error in registerUserRooms: ${error}`);
  }
};
