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
export const checkAccessToken = async (accessToken) => {
  const sql = postgres(process.env.AUTH_DB_URI);

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

export const registerUserRooms = async (roomId, members) => {
  const sql = postgres(process.env.AUTH_DB_URI);

  try {
    await sql`
            UPDATE users
                SET rooms = CASE
                WHEN rooms IS NULL THEN to_jsonb(ARRAY[${roomId}::text])
                WHEN NOT (${roomId}::text = ANY (SELECT jsonb_array_elements_text(rooms))) THEN rooms || to_jsonb(${roomId}::text)
              ELSE rooms
              END
            WHERE id = ANY(${sql.array(members)}::uuid[])
`;

    return true;
  } catch (error) {
    throw new Error(`Error in registerUserRooms: ${error}`);
  }
};
