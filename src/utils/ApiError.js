import { ApiResponse } from "./ApiResponse.js";

export const ApiError = (res, error, location) => {
  console.error(location, error);
  return res
    .status(500)
    .json(new ApiResponse(500, null, "Something went wrong."));
};
