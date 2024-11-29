import mongoose from "mongoose";
import { messageSchema } from "./message.model.js";

const { Schema, model } = mongoose;

const memberSchema = new Schema({
  _id: false,
  id: {
    type: String,
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
});

const roomDetailsSchema = new Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
    },
    type: {
      type: String,
      enum: ["private", "group", "broadcast"],
      required: true,
    },
    name: {
      type: String,
      default: null,
    },
    theme: {
      type: String,
      default: "default",
    },
    avatar: {
      type: String,
      default: null,
    },
    members: {
      type: [memberSchema],
      required: true,
    },
  },
  { timestamps: true }
);

export const RoomDetails = model("RoomDetails", roomDetailsSchema);
