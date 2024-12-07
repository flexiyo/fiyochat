export const emitToRoom = (socket, event, roomId, response) => {
  try {
    socket.to(roomId).emit(event, response);
  } catch (error) {
    console.error(`Error emitting event ${event}:`, error);
  }
};

export const emitToUser = (io, event, socketId, response) => {
  try {
    io.to(socketId).emit(event, response);
  } catch (error) {
    console.error(`Error emitting event ${event}:`, error);
  }
};