import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats distance and time for display in transit details
 * @param distance Distance string (e.g., "2.1 mi")
 * @param duration Duration string in seconds (e.g., "340s")
 * @returns Formatted string (e.g., "2.1 mi • 5 min")
 */
export function formatDistanceTime(distance?: string, duration?: string): string {
  let result = '';
  
  if (distance) {
    result += distance;
  }
  
  if (duration) {
    const durationInSeconds = parseInt(duration.replace('s', '') || '0');
    const minutes = Math.round(durationInSeconds / 60);
    
    if (result) {
      result += ' • ';
    }
    
    result += `${minutes} min`;
  }
  
  return result;
}
