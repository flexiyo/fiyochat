import {
  addMessage,
  removeMessage,
  editMessage,
  seeMessage,
  replyToMessage,
  reactToMessage,
  unreactToMessage,
  addToFavourites,
  getMessages,
} from "./mongodb.controller.js";

import { fetchUserRooms } from "../utils/mongoHandler.js";
import { validatePayload } from "../utils/validatePayload.js";
import { emitToRoom } from "../utils/SocketEventEmitter.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { checkAccessToken } from "../package/index.d.js";

export const setupSocketHandlers = asyncHandler(async (io) => {
  io.on("connection", async (socket) => {
    const accessToken = socket.handshake.auth.fiyoat;

    if (!accessToken) {
      socket.emit("error", { event: "connection", error: "Missing Access Token" });
      console.log("Missing Access Token");
      socket.disconnect();
      return;
    }

    try {
      const { message, data } = await checkAccessToken(accessToken);

      if (message !== "ok") {
        socket.emit("error", { event: "connection", error: message });
        console.log(message);
        socket.disconnect();
        return;
      }

      socket.user = data;

      socket.userRooms = await fetchUserRooms(socket.user.id);

      if (!socket.userRooms.length) {
        socket.emit("error", { event: "connection", error: "No rooms found" });
        console.log("No rooms found");
        socket.disconnect();
        return;
      }

      socket.userRooms.forEach((roomId) => {
        socket.join(roomId);
        socket.broadcast.to(roomId).emit("user_joined", socket.user.id);
      });

      socket.to(socket.id).emit("roomsListResponse", socket.userRooms);

      // Handle Message Events
      socket.on("is_typing", (payload) => {
        try {
          const requiredFields = ["roomId", "senderId"];
          validatePayload(payload, requiredFields);

          const { roomId, senderId } = payload;
          emitToRoom(socket, "typing", roomId, { senderId });
        } catch (error) {
          console.error("Error in is_typing:", error);
          socket.emit("error", { event: "is_typing", error: error.message });
        }
      });

      socket.on("send_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "message", "messageId"];
          validatePayload(payload, requiredFields);

          const result = await addMessage(payload);
          const { roomId, senderId, message, messageId } = payload;

          if (result) {
            emitToRoom(socket, "message_received", roomId, {
              senderId,
              message,
              messageId,
            });
          }
        } catch (error) {
          console.error("Error in send_message:", error);
          socket.emit("error", { event: "send_message", error: error.message });
        }
      });

      socket.on("unsend_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "messageId"];
          validatePayload(payload, requiredFields);

          const result = await removeMessage(payload);
          const { roomId, senderId, messageId } = payload;

          if (result) {
            emitToRoom(socket, "message_unsent", roomId, {
              senderId,
              messageId,
            });
          }
        } catch (error) {
          console.error("Error in unsend_message:", error);
          socket.emit("error", {
            event: "unsend_message",
            error: error.message,
          });
        }
      });

      socket.on("edit_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "originalMessage",
            "updatedMessage",
            "messageId",
          ];
          validatePayload(payload, requiredFields);

          const result = await editMessage(payload);
          const {
            roomId,
            senderId,
            originalMessage,
            updatedMessage,
            messageId,
          } = payload;

          if (result) {
            emitToRoom(socket, "message_edited", roomId, {
              senderId,
              originalMessage,
              updatedMessage,
              messageId,
            });
          }
        } catch (error) {
          console.error("Error in edit_message:", error);
          socket.emit("error", { event: "edit_message", error: error.message });
        }
      });

      socket.on("see_message", async (payload) => {
        try {
          const requiredFields = ["roomId", "senderId", "messageId"];
          validatePayload(payload, requiredFields);

          const result = await seeMessage(payload);
          const { roomId, senderId, messageId } = payload;

          if (result) {
            emitToRoom(socket, "message_seen", roomId, { senderId, messageId });
          }
        } catch (error) {
          console.error("Error in see_message:", error);
          socket.emit("error", { event: "see_message", error: error.message });
        }
      });

      socket.on("reply_to_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "parentMessageId",
            "replyMessage",
            "replyMessageId",
          ];
          validatePayload(payload, requiredFields);

          const result = await replyToMessage(payload);
          const {
            roomId,
            senderId,
            parentMessageId,
            replyMessage,
            replyMessageId,
          } = payload;

          if (result) {
            emitToRoom(socket, "message_replied", roomId, {
              senderId,
              parentMessageId,
              replyMessage,
              replyMessageId,
            });
          }
        } catch (error) {
          console.error("Error in reply_to_message:", error);
          socket.emit("error", {
            event: "reply_to_message",
            error: error.message,
          });
        }
      });

      socket.on("react_to_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "messageId",
            "reaction",
          ];
          validatePayload(payload, requiredFields);

          const result = await reactToMessage(payload);
          const { roomId, senderId, messageId, reaction } = payload;

          if (result) {
            emitToRoom(socket, "message_reacted", roomId, {
              senderId,
              messageId,
              reaction,
            });
          }
        } catch (error) {
          console.error("Error in react_to_message:", error);
          socket.emit("error", {
            event: "react_to_message",
            error: error.message,
          });
        }
      });

      socket.on("unreact_to_message", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "senderId",
            "messageId",
            "reaction",
          ];
          validatePayload(payload, requiredFields);

          const result = await unreactToMessage(payload);
          const { roomId, senderId, messageId, reaction } = payload;

          if (result) {
            emitToRoom(socket, "message_unreacted", roomId, {
              senderId,
              messageId,
              reaction,
            });
          }
        } catch (error) {
          console.error("Error in unreact_to_message:", error);
          socket.emit("error", {
            event: "unreact_to_message",
            error: error.message,
          });
        }
      });

      socket.on("add_to_favourites", async (payload) => {
        try {
          const requiredFields = [
            "roomId",
            "userId",
            "senderId",
            "message",
            "messageId",
          ];
          validatePayload(payload, requiredFields);

          const result = await addToFavourites(payload);
          const { userId, messageId } = payload;

          if (result) {
            socket.emit("message_favourited", { userId, messageId });
          }
        } catch (error) {
          console.error("Error in add_to_favourites:", error);
          socket.emit("error", {
            event: "add_to_favourites",
            error: error.message,
          });
        }
      });

      socket.on("get_messages", async (payload) => {
        try {
          const requiredFields = ["roomId"];
          validatePayload(payload, requiredFields);

          const result = await getMessages(payload);
          const { roomId } = payload;

          if (result) {
            emitToRoom(socket, "messages", roomId, result);
          }
        } catch (error) {
          console.error("Error in get_messages:", error);
          socket.emit("error", { event: "get_messages", error: error.message });
        }
      });

      // Handle Disconnection
      socket.on("disconnect", () => {
        // socket.userRooms.forEach((roomId) => {
        //   socket.leave(roomId);
        //   socket.broadcast.to(roomId).emit("user_left", userId);
        // });
      });
    } catch (error) {
      console.error("Error during socket connection:", error);
      socket.emit("error", { event: "connection", error: error.message });
    }
  });
});
