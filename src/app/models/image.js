import mongoose from "mongoose";

export const ImageSchema = new mongoose.Schema({
  data: Buffer,
  contentType: String,
});

export const Image =
  mongoose.models.Image || mongoose.model("Image", ImageSchema);
