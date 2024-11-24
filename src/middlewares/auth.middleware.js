import { checkAccessToken } from "../package/index.d.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const accessToken =
      req.cookies?.fiyoat ||
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.split(" ")[1]
        : null);

    if (!accessToken) {
      return res.status(401).json({
        status: 401,
        message: "Access token is required",
      });
    }

    const tokenResponse = await checkAccessToken(accessToken);

    if (tokenResponse.status === 200 && tokenResponse.message === "ok") {
      req.user = tokenResponse.data;
      return next();
    }

    return res.status(tokenResponse.status).json({
      status: tokenResponse.status,
      message: tokenResponse.message,
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      message: "Internal server error: " + error.message,
    });
  }
};