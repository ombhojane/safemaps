
import React from 'react';
import { EmergencyContact } from '@/types';
import { Phone, MapPin, Heart, Shield, Flame, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmergencyContactsProps {
  contacts: EmergencyContact[];
}

const EmergencyContacts = ({ contacts }: EmergencyContactsProps) => {
  if (!contacts || contacts.length === 0) {
    return (
      <div className="text-sm text-muted-foreground italic px-4 py-2">
        No emergency contacts available for this area.
      </div>
    );
  }

  const getIconForType = (type: string) => {
    switch (type) {
      case 'hospital':
        return <Heart className="h-4 w-4" />;
      case 'police':
        return <Shield className="h-4 w-4" />;
      case 'fire':
        return <Flame className="h-4 w-4" />;
      case 'roadside':
        return <Car className="h-4 w-4" />;
      default:
        return <Phone className="h-4 w-4" />;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'hospital':
        return 'text-red-500 bg-red-50 border-red-100 dark:bg-red-950/30 dark:border-red-900/50';
      case 'police':
        return 'text-blue-500 bg-blue-50 border-blue-100 dark:bg-blue-950/30 dark:border-blue-900/50';
      case 'fire':
        return 'text-orange-500 bg-orange-50 border-orange-100 dark:bg-orange-950/30 dark:border-orange-900/50';
      case 'roadside':
        return 'text-yellow-500 bg-yellow-50 border-yellow-100 dark:bg-yellow-950/30 dark:border-yellow-900/50';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-100 dark:bg-gray-900/30 dark:border-gray-800/50';
    }
  };

  return (
    <div className="space-y-3 p-1">
      <div className="text-sm font-medium px-4 pt-2">
        Nearby Emergency Services
      </div>
      <div className="space-y-2">
        {contacts.map((contact) => (
          <div 
            key={contact.id} 
            className="px-4 py-3 border rounded-md bg-card/50 hover:bg-card transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "mt-0.5 flex-shrink-0 p-2 rounded-full", 
                getColorForType(contact.type)
              )}>
                {getIconForType(contact.type)}
              </div>
              
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">
                    {contact.name}
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    {contact.distance}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {contact.address}
                </p>
                
                <div className="flex items-center pt-1 gap-2">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-7 rounded-full text-xs px-3 gap-1"
                    onClick={() => window.open(`tel:${contact.phoneNumber}`)}
                  >
                    <Phone className="h-3 w-3" />
                    {contact.phoneNumber}
                  </Button>
                  
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="h-7 rounded-full text-xs"
                    onClick={() => window.open(`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`)}
                  >
                    <MapPin className="h-3 w-3 mr-1" />
                    Directions
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EmergencyContacts;
