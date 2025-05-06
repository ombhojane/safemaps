// Helper function to format duration
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
};

// Format transit time from API format to readable format
export const formatTransitTime = (timeString: string): string => {
  if (!timeString) return '';
  
  try {
    // Expected format: "2023-05-15T15:30:00Z"
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Error formatting transit time:', error);
    return timeString;
  }
}; 