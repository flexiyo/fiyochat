import mongoose from "mongoose";
import { MessageStock } from "../models/message.model.js";
import {
  generateDatabaseName,
  generateCollectionName,
  getDatabaseName,
} from "../utils/mongoHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { registerUserRoom, deleteUserRoom } from "../package/pg.handler.js";

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
    const { roomId, senderId, content, type, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const messageObject = {
      id: messageId,
      senderId,
      content: content,
      type,
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
    throw new Error(`Error in addMessage: ${error}`);
  }
};

export const removeMessage = async (payload) => {
  try {
    const { roomId, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const updatedDocument = await messageStockModel.findOneAndUpdate(
      { "messages.id": messageId },
      { $pull: { messages: { id: messageId } } },
      { new: true }
    );

    if (updatedDocument && updatedDocument.messages.length === 0) {
      await messageStockModel.findByIdAndDelete(updatedDocument._id);
    }

    return true;
  } catch (error) {
    throw new Error(`Error in removeMessage: ${error}`);
  }
};

export const editMessage = async (payload) => {
  try {
    const { roomId, originalContent, updatedContent, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const updatedDocument = await messageStockModel.findOneAndUpdate(
      { "messages.id": messageId },
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
    throw new Error(`Error in editMessage: ${error}`);
  }
};

export const seeMessage = async (payload) => {
  try {
    const { roomId, senderId, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const result = await messageStockModel.findOneAndUpdate(
      { 
        "messages.id": messageId, 
        $or: [
          { "seenBy.userId": senderId },
          { "messages.id": messageId }
        ]
      },
      {
        $set: {
          "seenBy.$[user].lastSeenMessageId": messageId,
          "seenBy.$[user].seenAt": new Date(),
        },
        $push: {
          seenBy: {
            userId: senderId,
            lastSeenMessageId: messageId,
            seenAt: new Date(),
          }
        }
      },
      {
        arrayFilters: [{ "user.userId": senderId }],
        upsert: true,
        new: true
      }
    );

    return true;
  } catch (error) {
    throw new Error(`Error in seeMessage: ${error}`);
  }
};

export const replyToMessage = async (payload) => {
  try {
    const { roomId, senderId, parentMessageId, replyContent, replyMessageId } =
      payload;

    const messageStockModel = getMessageStockModel(roomId);

    const replyMessageObject = {
      id: replyMessageId,
      senderId,
      content: replyContent,
      parentMessageId: parentMessageId,
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
    throw new Error(`Error in replyToMessage: ${error}`);
  }
};

export const reactToMessage = async (payload) => {
  try {
    const { roomId, senderId, messageId, reaction } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    await messageStockModel.findOneAndUpdate(
      { "messages.id": messageId },
      {
        $push: {
          "messages.$.reactions": { userId: senderId, content: reaction },
        },
      },
      { new: true }
    );

    return true;
  } catch (error) {
    throw new Error(`Error in reactToMessage: ${error}`);
  }
};

export const unreactToMessage = async (payload) => {
  try {
    const { roomId, senderId, messageId, reaction } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    await messageStockModel.findOneAndUpdate(
      { "messages.id": messageId },
      {
        $pull: {
          "messages.$.reactions": { userId: senderId, content: reaction },
        },
      },
      { new: true }
    );

    return true;
  } catch (error) {
    throw new Error(`Error in unreactToMessage: ${error}`);
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
      throw new Error(`Could not retrieve model for roomId ${roomId}`);
    }

    const messageStock = await messageStockModel
      .findOne({})
      .sort({ serial: -1 })
      .lean();

    if (messageStock && messageStock.id === roomId) {
      return { messageStock: null };
    }

    return { messageStock };
  } catch (error) {
    throw new Error(`Error in getLatestMessages: ${error}`);
  }
};

/* Chat Room Related Controllers */
export const createChatRoom = async (req, res) => {
  try {
    const { roomType, memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({
        status: 400,
        data: null,
        message: "Invalid or missing memberIds array.",
      });
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

    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { roomId: collectionName },
          "Room created successfully."
        )
      );
  } catch (error) {
    throw new Error(`Error in createChatRoom: ${error}`);
  }
};

export const deleteChatRoom = async (collectionName) => {
  try {
    const db = mongoose.connection.useDb(getDatabaseName(collectionName));
    await db.dropCollection(collectionName);

    await deleteUserRoom(collectionName);
  } catch (error) {
    throw new Error(`Error in deleteChatRoom: ${error}`);
  }
};
