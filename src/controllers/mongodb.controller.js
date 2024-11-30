import mongoose from "mongoose";
import { MessageStock } from "../models/message.model.js";
import { RoomDetails } from "../models/room.model.js";
import {
  generateDatabaseName,
  generateCollectionName,
  getDatabaseName,
} from "../utils/mongoHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { registerUserRooms } from "../package/pg.handler.js";

/* Utility Functions */
const getMessageStockModel = (collectionName) => {
  const dbName = getDatabaseName(collectionName);
  return mongoose.connection
    .useDb(dbName)
    .model(collectionName, MessageStock.schema);
};

const getRoomDetailsModel = (collectionName) => {
  const dbName = getDatabaseName(collectionName);
  return mongoose.connection
    .useDb(dbName)
    .model(collectionName, RoomDetails.schema);
};

/* Message Related Controllers */
export const addMessage = async (payload) => {
  try {
    const { roomId, senderId, content, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const messageObject = {
      id: messageId,
      senderId,
      content: content,
    };

    const lastDocument = await messageStockModel
      .findOne({ messages: { $exists: true } })
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

    await messageStockModel.findOneAndUpdate(
      { "messages.id": messageId },
      { $push: { "messages.$.seenBy": { userId: senderId } } },
      { new: true }
    );

    return true;
  } catch (error) {
    throw new Error(`Error in seeMessage: ${error}`);
  }
};

export const replyToMessage = async (payload) => {
  try {
    const { roomId, senderId, parentMessageId, replyMessage, replyMessageId } =
      payload;

    const messageStockModel = getMessageStockModel(roomId);

    const replyMessageObject = {
      id: replyMessageId,
      senderId,
      content: replyMessage,
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

/* Room Related Controllers */
export const createRoomCollection = async (req, res) => {
  try {
    const { roomType, memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json({ status: 400, data: null, message: "Invalid or missing memberIds array." });
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
    let roomDetailsModel;

    if (!databaseName) {
      databaseName = generateDatabaseName();
      const db = mongoose.connection.useDb(databaseName);
      collectionName = generateCollectionName(databaseName);

      await db.createCollection(collectionName);
      roomDetailsModel = db.model(collectionName, RoomDetails.schema);
    } else {
      const db = mongoose.connection.useDb(databaseName);

      const collections = await db.listCollections();

      if (collections.length >= 1000) {
        databaseName = generateDatabaseName(databaseName);
        const newDb = mongoose.connection.useDb(databaseName);
        collectionName = generateCollectionName(databaseName);

        await newDb.createCollection(collectionName);
        roomDetailsModel = newDb.model(collectionName, RoomDetails.schema);
      } else {
        collectionName = generateUniqueCollectionName(collections);
        await db.createCollection(collectionName);
        roomDetailsModel = db.model(collectionName, RoomDetails.schema);
      }
    }

    await registerUserRooms(collectionName, memberIds);

    const roomDetails = await roomDetailsModel.create({
      id: collectionName,
      type: roomType,
      members: memberIds.map((memberId) => ({
        id: memberId,
      })),
    });

    return res.status(200).json({
      status: 200,
      data: { databaseName, roomDetails },
      message: "Room created successfully",
    });
  } catch (error) {
    console.error(`Error in createRoomCollection: ${error}`);
    return res
      .status(500)
      .json({ status: 500, data: null, message: "Internal Server Error" });
  }
};

export const deleteRoomCollection = async (collectionName) => {
  try {
    const db = mongoose.connection.useDb(getDatabaseName(collectionName));
    await db.dropCollection(collectionName);
  } catch (error) {
    throw error;
  }
};

export const updateRoomDetails = async (payload) => {
  try {
    const { roomId, memberIds } = payload;
    const roomDetailsModel = getRoomDetailsModel(roomId);
    await roomDetailsModel.updateOne({ id: roomId }, { $set: { memberIds } });
  } catch (error) {
    throw new Error(`Error in updateRoomDetails: ${error}`);
  }
};

export const getRoomDetails = async (roomId) => {
  try {
    const roomDetailsModel = getRoomDetailsModel(roomId);
    const roomDetails = await roomDetailsModel.findOne({ id: roomId });
    return roomDetails;
  } catch (error) {
    throw new Error(`Error in getRoomDetails: ${error}`);
  }
};

