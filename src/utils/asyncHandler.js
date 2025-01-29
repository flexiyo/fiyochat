import { checkAccessToken } from "../package/checkAccessToken.js";
import { ApiResponse } from "./ApiResponse.js";

const asyncHandler = (requestHandler, checkAccessTokenFlag = false) => {
  return async (req, res, next) => {
    if (checkAccessTokenFlag) {
      const access_token = req.headers?.fiyoat;
      const device_id = req.headers?.fiyodid;

      if (!access_token || !device_id) {
        return res
          .status(401)
          .json(
            new ApiResponse(401, null, "MissingHeaders: 'fiyoat' or 'fiyodid'")
          );
      }

      const tokenResponse = await checkAccessToken({ access_token, device_id });

      if (!tokenResponse) {
        return res
          .status(401)
          .json(new ApiResponse(401, null, "ATInvalidError"));
      }

      req.user = {
        id: tokenResponse.user_id,
      };
    }

    try {
      await requestHandler(req, res, next);
    } catch (err) {
      next(err);
    }
  };
};

export { asyncHandler };
