import {
  addMessage,
  removeMessage,
  editMessage,
  seeMessage,
  replyToMessage,
  reactToMessage,
  unreactToMessage,
  getMessages,
  getLatestMessages,
} from "./mongodb.controller.js";
import { validatePayload } from "../utils/validatePayload.js";
import { emitToRoom, emitToUser } from "../utils/SocketEventEmitter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { SocketError } from "../utils/SocketError.js";
import { checkAccessToken } from "../package/checkAccessToken.js";
import { getChatRoomDetails } from "../utils/pgHandler.js";

export const setupSocketHandlers = asyncHandler(async (io) => {
  io.on("connection", async (socket) => {
    const access_token = socket.handshake.auth?.fiyoat;
    const device_id = socket.handshake.auth?.fiyodid;

    if (!access_token || !device_id) {
      socket.emit("error", { event: "connection", message: "HeadersMissing: 'fiyoat' or 'fiyodid'" });
      socket.disconnect();
      return;
    }

    try {
      const userData = await checkAccessToken({ access_token, device_id });
      if (!userData) {
        socket.emit("error", { event: "connection", message: "ATInvalidError" });
        socket.disconnect();
        return;
      }
      socket.user = userData;

      if (!Array.isArray(socket.user?.rooms)) {
        socket.emit("error", { event: "connection", message: "RoomsNotFoundError" });
        socket.disconnect();
        return;
      }

      let allRoomDetails = [];
      try {
        const roomDetailsPromises = (socket.user.rooms || []).map(async (roomId) => {
          socket.join(roomId);
          socket.broadcast.to(roomId).emit("user_joined", socket.user.id);
          const roomDetails = await getChatRoomDetails(roomId);
          const { messageStock } = await getLatestMessages({ roomId });
          return { roomDetails, messageStock };
        });
        allRoomDetails = await Promise.all(roomDetailsPromises);
        socket.emit("roomsListResponse", allRoomDetails);
      } catch (error) {
        SocketError(socket, error, "rooms_initialization");
      }

      socket.on("is_typing", (payload) => {
        try {
          const requiredFields = ["roomId", "senderId"];
          validatePayload(payload, requiredFields);
          const { roomId, senderId } = payload;
          emitToRoom(socket, "typing", roomId, { senderId, roomId });
        } catch (error) {
          return SocketError(socket, error, "is_typing");
        }
      });

      socket.on("send_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "content", "type", "id", "sentAt"];
          validatePayload(payload, requiredFields);
          const result = await addMessage(payload);
          if (result) {
            emitToRoom(socket, "message_received", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "send_message");
        }
      });

      socket.on("unsend_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id"];
          validatePayload(payload, requiredFields);
          const result = await removeMessage(payload);
          if (result) {
            emitToRoom(socket, "message_unsent", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "unsend_message");
        }
      });

      socket.on("edit_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "originalContent", "updatedContent", "id"];
          validatePayload(payload, requiredFields);
          const result = await editMessage(payload);
          if (result) {
            emitToRoom(socket, "message_edited", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "edit_message");
        }
      });

      socket.on("see_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id", "seenAt"];
          validatePayload(payload, requiredFields);
          const result = await seeMessage(payload);
          if (result) {
            emitToRoom(socket, "message_seen", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "see_message");
        }
      });

      socket.on("reply_to_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "parentMessageId", "replyContent", "replyMessageId", "sentAt"];
          validatePayload(payload, requiredFields);
          const result = await replyToMessage(payload);
          if (result) {
            emitToRoom(socket, "message_replied", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "reply_to_message");
        }
      });

      socket.on("react_to_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id", "reaction"];
          validatePayload(payload, requiredFields);
          const result = await reactToMessage(payload);
          if (result) {
            emitToRoom(socket, "message_reacted", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "react_to_message");
        }
      });

      socket.on("unreact_to_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id", "reaction"];
          validatePayload(payload, requiredFields);
          const result = await unreactToMessage(payload);
          if (result) {
            emitToRoom(socket, "message_unreacted", payload.roomId, payload);
          }
        } catch (error) {
          return SocketError(socket, error, "unreact_to_message");
        }
      });

      socket.on("get_messages", async (payload) => {
        try {
          const requiredFields = ["roomId", "socketId", "skipCount"];
          validatePayload(payload, requiredFields);
          const { messageStock } = await getMessages(payload);
          if (messageStock) {
            emitToUser(io, "messages_got", payload.socketId, {
              messageStock,
              roomId: payload.roomId,
              skipCount: payload.skipCount,
            });
          }
        } catch (error) {
          return SocketError(socket, error, "get_messages");
        }
      });

      socket.on("disconnect", () => {
        if (!socket.user?.rooms?.length) return;
        socket.user.rooms.forEach((roomId) => {
          socket.leave(roomId);
          socket.broadcast.to(roomId).emit("user_left", socket.user.id);
        });
      });
    } catch (error) {
      SocketError(socket, error, "connection");
      socket.disconnect();
    }
  });
});
