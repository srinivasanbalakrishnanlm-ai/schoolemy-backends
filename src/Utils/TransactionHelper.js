
import mongoose from "mongoose";

/**
 * Execute a function within a MongoDB transaction
 * Automatically handles session creation, transaction management, and cleanup
 * 
 * @param {Function} callback - Async function that receives a session parameter
 * @returns {Promise} Result of the callback function
 * @throws {Error} Re-throws any error that occurs during the transaction
 * 
 * @example
 * const result = await withTransaction(async (session) => {
 *   const user = await User.findById(userId).session(session);
 *   await user.save({ session });
 *   return user;
 * });
 */
export const withTransaction = async (callback) => {
  const session = await mongoose.startSession();
  
  try {
    session.startTransaction();
    
    // Execute the callback with the session
    const result = await callback(session);
    
    // Commit the transaction if everything succeeds
    await session.commitTransaction();
    
    return result;
  } catch (error) {
    // Abort transaction on any error
    await session.abortTransaction();
    throw error;
  } finally {
    // Always end the session
    session.endSession();
  }
};

export default withTransaction;

