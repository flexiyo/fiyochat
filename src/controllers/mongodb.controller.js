import mongoose from "mongoose";
import { MessageStock } from "../models/message.model.js";
import { RoomDetails } from "../models/room.model.js";
import {
  generateDatabaseName,
  generateCollectionName,
  getDatabaseName,
} from "../utils/mongoHandler.js";

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
    const { roomId, senderId, message, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const messageObject = {
      id: messageId,
      senderId,
      content: message,
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
    console.error("Error saving message:", error);
    throw new Error(`Failed to add message: ${error.message}`);
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
    console.error("Error removing message:", error);
    throw new Error(`Failed to remove message: ${error.message}`);
  }
};

export const editMessage = async (payload) => {
  try {
    const { roomId, originalMessage, updatedMessage, messageId } = payload;

    const messageStockModel = getMessageStockModel(roomId);

    const updatedDocument = await messageStockModel.findOneAndUpdate(
      { "messages.id": messageId },
      {
        $set: {
          "messages.$.content": updatedMessage,
          "messages.$.originalMessage": originalMessage,
        },
      },
      { new: true }
    );

    if (!updatedDocument) {
      throw new Error(`Message with ID ${messageId} not found.`);
    }

    return true;
  } catch (error) {
    console.error("Error editing message:", error);
    throw new Error(`Failed to edit message: ${error.message}`);
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
    console.error("Error seeing message:", error);
    throw new Error(`Failed to see message: ${error.message}`);
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
    console.error("Error replying to message:", error);
    throw new Error(`Failed to reply to message: ${error.message}`);
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
    console.error("Error reacting to message:", error);
    throw new Error(`Failed to react to message: ${error.message}`);
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
    console.error("Error unreacting to message:", error);
    throw new Error(`Failed to unreact to message: ${error.message}`);
  }
};

export const getMessages = async (payload) => {
  try {
    const { roomId, page, pageSize } = payload;

    const messageStockModel = getMessageStockModel(roomId);
    const skipCount = page * pageSize;

    const messages = await messageStockModel
      .find({})
      .sort({ _id: -1 })
      .skip(skipCount)
      .limit(pageSize);

    const totalMessages = await messageStockModel.countDocuments();
    const hasMore = skipCount + messages.length < totalMessages;

    return { messages, hasMore };
  } catch (error) {
    console.error("Error getting messages:", error);
    throw new Error(`Failed to get messages: ${error.message}`);
  }
};

/* Room Related Controllers */
export const addToFavourites = (payload) => {
  try {
    const { roomId, senderId, message, messageId } = payload;

    const roomDetailsModel = getRoomDetailsModel(roomId);

    roomDetailsModel.findOneAndUpdate(
      { "members.id": senderId },
      {
        $push: {
          "members.$.favourites": {
            id: messageId,
            senderId,
            content: message,
          },
        },
      },
      { new: true }
    );
  } catch (error) {
    console.error("Error adding to favourites:", error);
    throw new Error(`Failed to add to favourites: ${error.message}`);
  }
};

export const removeFromFavourites = (payload) => {
  try {
    const { roomId, senderId, messageId } = payload;

    const roomDetailsModel = getRoomDetailsModel(roomId);

    roomDetailsModel.findOneAndUpdate(
      { "members.id": senderId },
      {
        $pull: {
          "members.$.favourites": { id: messageId },
        },
      },
      { new: true }
    );
  } catch (error) {
    console.error("Error removing from favourites:", error);
    throw new Error(`Failed to remove from favourites: ${error.message}`);
  }
};

export const createRoomCollection = async (req, res) => {
  try {
    const { members, roomType } = req.body;

    if (!Array.isArray(members) || members.length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid or missing members array." });
    }

    const adminDb = mongoose.connection.db.admin();
    const { databases } = await adminDb.listDatabases();
    const exclusionPattern = /^(admin|local|config|test)$/;

    const currentYear = new Date().getFullYear();
    const chatDatabases = databases.filter(
      (db) =>
        !exclusionPattern.test(db.name) &&
        new RegExp(`^${currentYear}_\\d+$`).test(db.name)
    );

    let lastDatabase;

    if (chatDatabases.length === 0) {
      const newDatabaseName = generateDatabaseName();
      const db = mongoose.connection.useDb(newDatabaseName);

      const collectionName = generateCollectionName(newDatabaseName);
      await db.createCollection(collectionName);

      return { databaseName: newDatabaseName, collectionName };
    } else {
      lastDatabase = chatDatabases[chatDatabases.length - 1].name;
    }

    const db = mongoose.connection.useDb(lastDatabase);
    const collections = await db.listCollections();

    let databaseName = lastDatabase;
    let collectionName;
    let roomDetailsModel;

    if (collections.length >= 1000) {
      databaseName = generateDatabaseName(lastDatabase);
      const newDb = mongoose.connection.useDb(databaseName);
      collectionName = generateCollectionName(databaseName);

      await newDb.createCollection(collectionName);

      roomDetailsModel = await mongoose.connection
        .useDb(databaseName)
        .model(collectionName, RoomDetails.schema);
    } else {
      collectionName = generateCollectionName(lastDatabase);
      const existingCollections = collections.map((col) => col.name);

      while (existingCollections.includes(collectionName)) {
        collectionName = generateCollectionName(lastDatabase);
      }

      await db.createCollection(collectionName);

      roomDetailsModel = await mongoose.connection
        .useDb(lastDatabase)
        .model(collectionName, RoomDetails.schema);
    }

    const roomDetails = await roomDetailsModel.create({
      id: collectionName,
      type: roomType,
      members: members.map((member) => {
        if (!member.userId) {
          throw new Error(
            `Invalid member data: Missing userId for member ${JSON.stringify(
              member
            )}`
          );
        }
        return {
          id: member.userId,
        };
      }),
    });

    return res.status(200).json({
      databaseName,
      roomDetails,
    });
  } catch (error) {
    console.error("Error creating collection:", error);
    throw error;
  }
};

export const deleteRoomCollection = async (collectionName) => {
  try {
    const db = mongoose.connection.useDb(getDatabaseName(collectionName));
    await db.dropCollection(collectionName);
  } catch (error) {
    console.error("Error deleting collection:", error);
    throw new Error(`Failed to delete collection: ${error.message}`);
  }
};

export const updateRoomDetails = async (payload) => {
  try {
    const { roomId, members } = payload;
    const roomDetailsModel = getRoomDetailsModel(roomId);
    await roomDetailsModel.updateOne({ id: roomId }, { $set: { members } });
  } catch (error) {
    console.error("Error updating room details:", error);
    throw new Error(`Failed to update room details: ${error.message}`);
  }
};

export const getRoomDetails = async (roomId) => {
  try {
    const roomDetailsModel = getRoomDetailsModel(roomId);
    const roomDetails = await roomDetailsModel.findOne({ id: roomId });
    return roomDetails;
  } catch (error) {
    console.error("Error getting room details:", error);
    throw new Error(`Failed to get room details: ${error.message}`);
  }
};
