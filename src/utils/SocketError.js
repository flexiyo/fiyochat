export const SocketError = (
  socket,
  error,
  event,
  message = "Something went wrong.",
  disconnectFlag = false
) => {
  console.error(`Error in ${event}.`, error);
  socket.emit("error", { event, error: { message } });
  if (disconnectFlag) socket.disconnect();
};
