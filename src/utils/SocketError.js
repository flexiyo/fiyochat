export const SocketError = (
  socket,
  error,
  event,
) => {
  console.error(`Error in ${event}.`, error);
  socket.emit("error", { event, message: "Something went wrong." });
};
