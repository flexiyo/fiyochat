import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config();

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
            ${tx.json(memberIds.map((id) => id.toString()))}
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
