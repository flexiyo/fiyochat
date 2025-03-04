import mongoose from "mongoose";
import { MessageStock } from "../models/message.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import {
  generateDatabaseName,
  generateCollectionName,
  getDatabaseName,
} from "../utils/mongoHandler.js";
import { registerUserRoom, deleteUserRoom } from "../utils/pgHandler.js";

/* Utility Functions */
const getMessageStockModel = (collectionName) => {
  const dbName = getDatabaseName(collectionName);
  return mongoose.connection
    .useDb(dbName)
    .model(collectionName, MessageStock.schema);
};

/* Message Related Controllers */
export const addMessage = async (payload) => {
  try {
    const { roomId, senderId, content, type, id, sentAt } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const messageObject = {
      id,
      senderId,
      content: content,
      type,
      sentAt,
    };

    const lastDocument = await messageStockModel
      .findOne({})
      .sort({ serial: -1 })
      .limit(1)
      .exec();

    if (lastDocument && lastDocument.messages.length <= 30) {
      lastDocument.messages.push(messageObject);
      await lastDocument.save();
    } else {
      const newDocument = new messageStockModel({
        messages: [messageObject],
      });
      await newDocument.save();
    }

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in addMessage.");
  }
};

export const removeMessage = async (payload) => {
  try {
    const { roomId, id } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const updatedDocument = await messageStockModel.findOneAndUpdate(
      { "messages.id": id },
      { $pull: { messages: { id } } },
      { new: true }
    );

    if (updatedDocument && updatedDocument.messages.length === 0) {
      await messageStockModel.findByIdAndDelete(updatedDocument._id);
    }

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in removeMessage.");
  }
};

export const editMessage = async (payload) => {
  try {
    const { roomId, originalContent, updatedContent, id } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const updatedDocument = await messageStockModel.findOneAndUpdate(
      { "messages.id": id },
      {
        $set: {
          "messages.$.content": updatedContent,
          "messages.$.originalContent": originalContent,
        },
      },
      { new: true }
    );

    if (!updatedDocument) {
      return res
        .status(404)
        .json(new ApiResponse(404, null, "Unable to find or edit the message"));
    }

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in editMessage.");
  }
};

export const seeMessage = async (payload) => {
  try {
    const { roomId, senderId, id, seenAt } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const updatedMessage = await messageStockModel.findOneAndUpdate(
      {
        "messages.id": id,
        "seenBy.userId": senderId,
      },
      {
        $set: {
          "seenBy.$.lastSeenMessageId": id,
          "seenBy.$.seenAt": seenAt,
        },
      },
      { new: true }
    );

    if (!updatedMessage) {
      await messageStockModel.updateOne(
        { "messages.id": id },
        {
          $push: {
            seenBy: {
              userId: senderId,
              lastSeenMessageId: id,
              seenAt: new Date(),
            },
          },
        }
      );
    }

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in seeMessage.");
  }
};

export const replyToMessage = async (payload) => {
  try {
    const {
      roomId,
      senderId,
      parentMessageId,
      replyContent,
      replyMessageId,
      sentAt,
    } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const replyMessageObject = {
      id: replyMessageId,
      senderId,
      content: replyContent,
      parentMessageId: parentMessageId,
      sentAt,
    };

    const lastDocument = await messageStockModel
      .findOne({})
      .sort({ serial: -1 })
      .limit(1)
      .exec();

    if (lastDocument && lastDocument.messages.length <= 30) {
      lastDocument.messages.push(replyMessageObject);
      await lastDocument.save();
    } else {
      const newDocument = new messageStockModel({
        messages: [replyMessageObject],
      });
      await newDocument.save();
    }

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in replyToMessage.");
  }
};

export const reactToMessage = async (payload) => {
  try {
    const { roomId, senderId, id, reaction } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    await messageStockModel.findOneAndUpdate(
      { "messages.id": id },
      {
        $push: {
          "messages.$.reactions": { userId: senderId, content: reaction },
        },
      },
      { new: true }
    );

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in reactToMessage.");
  }
};

export const unreactToMessage = async (payload) => {
  try {
    const { roomId, senderId, id, reaction } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    await messageStockModel.findOneAndUpdate(
      { "messages.id": id },
      {
        $pull: {
          "messages.$.reactions": { userId: senderId, content: reaction },
        },
      },
      { new: true }
    );

    return true;
  } catch (error) {
    return ApiError(res, error, "Error in unreactToMessage.");
  }
};

export const getMessages = async (payload) => {
  try {
    const { roomId, skipCount } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const messageStock = await messageStockModel
      .find({})
      .sort({ serial: -1 })
      .skip(skipCount)
      .limit(1)
      .exec();

    return { messageStock: messageStock[0] };
  } catch (error) {
    return ApiError(res, error, "Error in getMessages.");
  }
};

export const getLatestMessages = async (payload) => {
  try {
    const { roomId } = payload;

    if (!roomId) {
      throw new Error("roomId is required.");
    }

    const messageStockModel = getMessageStockModel(roomId);
    if (!messageStockModel) {
      return ApiError(
        res,
        error,
        "Could not retrieve model for roomId ${roomId}"
      );
    }

    const messageStock = await messageStockModel
      .findOne({})
      .sort({ serial: -1 })
      .lean();

    return { messageStock };
  } catch (error) {
    return ApiError(res, error, "Error in getLatestMessages.");
  }
};

/* Chat Room Related Controllers */
export const createChatRoom = async (req, res) => {
  try {
    const { roomType, memberIds } = req.body;

    if (!roomType) {
      return res.status(400).json(
        new ApiResponse(400, null, "roomType is required")
      );
    }
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json(
        new ApiResponse(400, null, "Invalid or missing memberIds array")
      );
    }
    if (memberIds.some(id => typeof id !== "string")) {
      return res.status(400).json(
        new ApiResponse(400, null, "memberIds must be an array of strings")
      );
    }

    const adminDb = mongoose.connection.db.admin();
    const exclusionPattern = /^(admin|local|config|test)$/;
    const currentYear = new Date().getFullYear();

    const { databases } = await adminDb.listDatabases();
    const lastDatabase = databases
      .filter(
        (db) =>
          !exclusionPattern.test(db.name) &&
          new RegExp(`^${currentYear}_\\d+$`).test(db.name)
      )
      .sort((a, b) => b.name.localeCompare(a.name))[0]?.name;

    let databaseName = lastDatabase;
    let collectionName;

    if (!databaseName) {
      databaseName = generateDatabaseName();
      const db = mongoose.connection.useDb(databaseName);
      collectionName = generateCollectionName(databaseName);
      await db.createCollection(collectionName);
    } else {
      const db = mongoose.connection.useDb(databaseName);
      const collections = await db.listCollections();

      if (collections.length >= 1000) {
        databaseName = generateDatabaseName(databaseName);
        const newDb = mongoose.connection.useDb(databaseName);
        collectionName = generateCollectionName(databaseName);
        await newDb.createCollection(collectionName);
      } else {
        collectionName = generateCollectionName(databaseName);
        await db.createCollection(collectionName);
      }
    }

    await registerUserRoom(collectionName, { roomType, memberIds });

    return res.status(200).json(
      new ApiResponse(
        200,
        { roomId: collectionName },
        "Room created successfully"
      )
    );
  } catch (error) {
    return ApiError(res, error, "Error in createChatRoom");
  }
};

export const deleteChatRoom = async (collectionName) => {
  try {
    const db = mongoose.connection.useDb(getDatabaseName(collectionName));
    await db.dropCollection(collectionName);

    await deleteUserRoom(collectionName);
  } catch (error) {
    return ApiError(res, error, "Error in deleteChatRoom.");
  }
};
