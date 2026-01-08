export const getLastDayOfMonth = (date) => {
  const result = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return result;
};

export const getMonthName = (date) => {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const result = months[date.getMonth()];
  return result;
};

export const getNextDueDate = (startDate, dueDay, monthsOffset) => {
  const nextDate = new Date(startDate);
  
  nextDate.setMonth(nextDate.getMonth() + monthsOffset);
  
  const lastDay = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
  
  const adjustedDay = Math.min(dueDay, lastDay);
  
  const result = new Date(nextDate.getFullYear(), nextDate.getMonth(), adjustedDay);
  
  return result;
};

export const getMonthNameFromDate = (date) => {
  const result = getMonthName(date);
  return result;
};
