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

export const getMessages = async (payload) => {
  try {
    const { roomId, page = 0, pageSize = 10 } = payload;

    if (!roomId) {
      throw new Error("roomId is required.");
    }

    const messageStockModel = getMessageStockModel(roomId);
    if (!messageStockModel) {
      throw new Error(`Could not retrieve model for roomId ${roomId}`);
    }

    const skipCount = page * pageSize;

    const messages = await messageStockModel
      .find({})
      .sort({ _id: -1 })
      .skip(skipCount)
      .limit(pageSize)
      .lean();

    if (!messages.length) {
      return null;
    }

    return messages;
  } catch (error) {
    throw new Error(`Error in getMessages: ${error}`);
  }
};


/* Room Related Controllers */
export const addToFavourites = async (payload) => {
  try {
    const { roomId, senderId, message, messageId } = payload;

    const roomDetailsModel = getRoomDetailsModel(roomId);

    await roomDetailsModel.findOneAndUpdate(
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
    throw new Error(`Error in addToFavourites: ${error}`);
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
    throw new Error(`Error in removeFromFavourites: ${error}`);
  }
};

export const createRoomCollection = async (req, res) => {
  try {
    const { roomType, memberIds } = req.body;

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, "Invalid or missing memberIds array."));
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
      members: memberIds.map((memberId) => {
        if (!memberId) {
          throw new Error("Missing member id");
        }
        return {
          id: memberId,
        };
      }),
    });

    await registerUserRooms(collectionName, memberIds);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          databaseName,
          roomDetails,
        },
        "Room created successfully"
      )
    );
  } catch (error) {
    throw new Error(`Error in createRoomCollection: ${error}`);
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
