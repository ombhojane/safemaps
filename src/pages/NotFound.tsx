
import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md mx-auto">
        <div className="mb-6">
          <div className="relative w-24 h-24 mx-auto">
            <div className="absolute inset-0 rounded-full bg-primary/10 animate-pulse-slow"></div>
            <h1 className="text-7xl font-bold text-primary relative z-10 flex items-center justify-center h-full">404</h1>
          </div>
        </div>
        
        <h2 className="text-2xl font-semibold mb-4">Page not found</h2>
        
        <p className="text-muted-foreground mb-8">
          Sorry, the page you're looking for doesn't exist or has been moved.
        </p>
        
        <Button asChild className="inline-flex items-center">
          <Link to="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Return to home
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
