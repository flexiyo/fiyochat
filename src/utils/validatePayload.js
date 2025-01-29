import { ApiResponse } from "./ApiResponse.js";

export const validatePayload = (payload, requiredFields, res) => {
  requiredFields.forEach((field) => {
    if (!payload[field]) {
      return res
        .status(400)
        .json(new ApiResponse(400, null, `'${field}' is required.`));
    }
  });
};
