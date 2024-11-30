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

export const registerUserRoom = async (roomId, roomDetails) => {
  const sql = postgres(process.env.AUTH_DB_URI);

  const {
    roomType,
    memberIds,
    name = null,
    theme = "default",
    avatar = null,
  } = roomDetails;

  try {
    await sql.begin(async (tx) => {
      await tx`
        INSERT INTO chat_rooms (id, name, type, theme, avatar, members)
        VALUES (
          ${roomId}::text,
          ${name},
          ${roomType}::text,
          ${theme},
          ${avatar},
          ${tx.json(
            memberIds.map((id) => id.toString())
          )}
        )
      `;

      await tx`
  UPDATE users
  SET rooms = (
    SELECT jsonb_agg(DISTINCT elem)
    FROM jsonb_array_elements_text(COALESCE(rooms, '[]'::jsonb) || to_jsonb(${roomId}::text)) AS elem
  )
  WHERE id = ANY(${memberIds})
`;
    });

    return true;
  } catch (error) {
    throw new Error(`Error in registerUserRoom: ${error}`);
  }
};

export const deleteUserRoom = async (roomId) => {
  const sql = postgres(process.env.AUTH_DB_URI);

  try {
    await sql.begin(async (tx) => {
      await tx`
        DELETE FROM chat_rooms
        WHERE id = ${roomId}::text
      `;

      await tx`
        UPDATE users
        SET rooms = jsonb_array_remove(rooms, jsonb_array_position(rooms, ${roomId}::text))
        WHERE id = ANY((SELECT members FROM chat_rooms WHERE id = ${roomId}::text)::jsonb->>'members')
      `;
    });

    return true;
  } catch (error) {
    throw new Error(`Error in deleteUserRoom: ${error}`);
  }
};

export const getChatRoomDetails = async (roomId) => {
  const sql = postgres(process.env.AUTH_DB_URI);

  try {
    const result = await sql`
      SELECT id, name, type, theme, avatar, members
      FROM chat_rooms
      WHERE id = ${roomId}::text
    `;

    if (result.length === 0) {
      return {
        message: "Chat room not found",
      };
    }

    const room = result[0];

    return {
      id: room.id,
      name: room.name,
      type: room.type,
      theme: room.theme,
      avatar: room.avatar,
      members: room.members,
    };
  } catch (error) {
    throw new Error(`Error in getChatRoomDetails: ${error}`);
  }
};
