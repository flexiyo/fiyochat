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
import { emitToRoom } from "../utils/SocketEventEmitter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkAccessToken, getChatRoomDetails } from "../package/pg.handler.js";

export const setupSocketHandlers = asyncHandler(async (io) => {
  io.on("connection", async (socket) => {
    const accessToken = socket.handshake.auth.fiyoat;

    if (!accessToken) {
      socket.emit("error", {
        event: "connection",
        error: { name: "ATInvalidError", message: "Tokens missing" },
      });
      socket.disconnect();
      return;
    }

    try {
      const { message, data } = await checkAccessToken(accessToken);

      if (message !== "ok") {
        socket.emit("error", {
          event: "connection",
          error: { name: "ATInvalidError", message },
        });
        socket.disconnect();
        return;
      }

      socket.user = data;

      if (!socket.user?.rooms) {
        socket.emit("error", {
          event: "connection",
          error: { name: "RoomsNotFoundError", message: "No rooms found" },
        });
        socket.disconnect();
        return;
      }

      let allRoomDetails = [];

      (async () => {
        const roomDetailsPromises = socket.user?.rooms?.map(async (roomId) => {
          socket.join(roomId);
          socket.broadcast.to(roomId).emit("user_joined", socket.user.id);

          const roomDetails = await getChatRoomDetails(roomId);
          const { messageStock } = await getLatestMessages({ roomId });
          return { roomDetails, messageStock };
        });

        allRoomDetails = await Promise.all(roomDetailsPromises || []);
        socket.emit("roomsListResponse", allRoomDetails);
      })();

      socket.on("is_typing", (payload) => {
        try {
          const requiredFields = ["roomId", "senderId"];
          validatePayload(payload, requiredFields);

          const { roomId, senderId } = payload;
          emitToRoom(socket, "typing", roomId, { senderId, roomId });
        } catch (error) {
          socket.emit("error", { event: "is_typing", error });
          throw new Error(`Error in is_typing: ${error}`);
        }
      });

      socket.on("send_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "content",
            "type",
            "id",
            "sentAt",
          ];
          validatePayload(payload, requiredFields);

          const result = await addMessage(payload);
          const { roomId, senderId, content, type, id, sentAt } = payload;

          if (result) {
            emitToRoom(socket, "message_received", roomId, {
              senderId,
              content,
              type,
              id,
              roomId,
              sentAt,
            });
          }
        } catch (error) {
          socket.emit("error", { event: "send_message", error });
          throw new Error(`Error in send_message: ${error}`);
        }
      });

      socket.on("unsend_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id"];
          validatePayload(payload, requiredFields);

          const result = await removeMessage(payload);
          const { roomId, senderId, id } = payload;

          if (result) {
            emitToRoom(socket, "message_unsent", roomId, {
              senderId,
              id,
              roomId,
            });
          }
        } catch (error) {
          socket.emit("error", {
            event: "unsend_message",
            error,
          });
          throw new Error(`Error in unsend_message: ${error}`);
        }
      });

      socket.on("edit_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "originalContent",
            "updatedContent",
            "id",
          ];
          validatePayload(payload, requiredFields);

          const result = await editMessage(payload);
          const { roomId, senderId, originalContent, updatedContent, id } =
            payload;

          if (result) {
            emitToRoom(socket, "message_edited", roomId, {
              senderId,
              originalContent,
              updatedContent,
              id,
              roomId,
            });
          }
        } catch (error) {
          socket.emit("error", { event: "edit_message", error });
          throw new Error(`Error in edit_message: ${error}`);
        }
      });

      socket.on("see_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id", "seenAt"];
          validatePayload(payload, requiredFields);

          const result = await seeMessage(payload);
          const { roomId, senderId, id, seenAt } = payload;

          if (result) {
            emitToRoom(socket, "message_seen", roomId, {
              senderId,
              id,
              roomId,
              seenAt,
            });
          }
        } catch (error) {
          socket.emit("error", { event: "see_message", error });
          throw new Error(`Error in see_message: ${error}`);
        }
      });

      socket.on("reply_to_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "parentMessageId",
            "replyContent",
            "replyMessageId",
            "sentAt",
          ];
          validatePayload(payload, requiredFields);

          const result = await replyToMessage(payload);
          const {
            roomId,
            senderId,
            parentMessageId,
            replyContent,
            replyMessageId,
            sentAt,
          } = payload;

          if (result) {
            emitToRoom(socket, "message_replied", roomId, {
              senderId,
              parentMessageId,
              replyContent,
              replyMessageId,
              roomId,
              sentAt,
            });
          }
        } catch (error) {
          socket.emit("error", {
            event: "reply_to_message",
            error,
          });
          throw new Error(`Error in reply_to_message: ${error}`);
        }
      });

      socket.on("react_to_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id", "reaction"];
          validatePayload(payload, requiredFields);

          const result = await reactToMessage(payload);
          const { roomId, senderId, id, reaction } = payload;

          if (result) {
            emitToRoom(socket, "message_reacted", roomId, {
              senderId,
              id,
              reaction,
              roomId,
            });
          }
        } catch (error) {
          socket.emit("error", {
            event: "react_to_message",
            error,
          });
          throw new Error(`Error in react_to_message: ${error}`);
        }
      });

      socket.on("unreact_to_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "id", "reaction"];
          validatePayload(payload, requiredFields);

          const result = await unreactToMessage(payload);
          const { roomId, senderId, id, reaction } = payload;

          if (result) {
            emitToRoom(socket, "message_unreacted", roomId, {
              senderId,
              id,
              reaction,
              roomId,
            });
          }
        } catch (error) {
          socket.emit("error", {
            event: "unreact_to_message",
            error,
          });
          throw new Error(`Error in unreact_to_message: ${error}`);
        }
      });

      socket.on("get_messages", async (payload) => {
        try {
          const requiredFields = ["roomId", "skipCount"];
          validatePayload(payload, requiredFields);

          const result = await getMessages(payload);
          const { roomId, skipCount } = payload;
          
          console.log("In get_messages:", payload);

          if (result) {
            emitToRoom(socket, "messages", roomId, {
              ...result,
              roomId,
              skipCount,
            });
          }
        } catch (error) {
          socket.emit("error", { event: "get_messages", error });
          throw new Error(`Error in get_messages: ${error}`);
        }
      });

      socket.on("disconnect", () => {
        if (!socket.user.rooms.length) return;

        socket.user.rooms.forEach((roomId) => {
          socket.leave(roomId);
          socket.broadcast.to(roomId).emit("user_left", socket.user.id);
        });
      });
    } catch (error) {
      socket.emit("error", { event: "connection", error });
      throw new Error(`Error in connection: ${error}`);
    }
  });
});
