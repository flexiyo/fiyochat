import mongoose, { model, Schema } from "mongoose";
import mongooseSequence from "mongoose-sequence";

const autoIncrement = mongooseSequence(mongoose);
export const messageSchema = new Schema({
  _id: false,
  id: {
    type: String,
    unique: true,
    required: true,
  },
  senderId: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  originalMessage: {
    type: String,
    default: null,
  },
  parentMessageId: {
    type: String,
    default: null,
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
  seenBy: [
    {
      userId: {
        type: String,
        required: true,
      },
      seenAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  reactions: [
    {
      userId: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      reactedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

export const Message = model("Message", messageSchema);

const messageStockSchema = new Schema(
  {
    serial: {
      type: Number,
      unique: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
);
messageStockSchema.plugin(autoIncrement, { inc_field: "serial" });

export const MessageStock = model("MessageStock", messageStockSchema);
