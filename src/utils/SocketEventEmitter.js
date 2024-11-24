export const emitToRoom = (socket, event, roomId, response) => {
  try {
    socket.broadcast.to(roomId).emit(event, response);
  } catch (error) {
    console.error(`Error emitting event ${event}:`, error);
  }
};

export const emitToUser = (socket, event, userId, response) => {
  try {
    socket.broadcast.to(userId).emit(event, response);
  } catch (error) {
    console.error(`Error emitting event ${event}:`, error);
  }
};