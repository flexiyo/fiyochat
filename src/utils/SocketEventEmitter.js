export const emitToRoom = (socket, event, roomId, response) => {
  try {
    socket.broadcast.to(roomId).emit(event, response);
  } catch (error) {
    console.error(`Error emitting event ${event}:`, error);
  }
};

export const emitToUser = (socket, event, socketId, response) => {
  try {
    socket.to(socketId).emit(event, response);
  } catch (error) {
    console.error(`Error emitting event ${event}:`, error);
  }
};