import mongoose from "mongoose";

const GrammarExclusionsSchema = new mongoose.Schema(
  {
    _id: { type: String, default: "global" },
    phrases: { type: [String], default: [] },
  },
  { versionKey: false },
);

export default mongoose.models.GrammarExclusions ||
  mongoose.model("GrammarExclusions", GrammarExclusionsSchema);
