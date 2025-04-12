import { useEffect, useState } from "react";
import FileUpload from "../components/expand";

function Home() {
  const [devToolsOpen, setDevToolsOpen] = useState(false);

  useEffect(() => {
    // Method 1: Console timing difference detection
    let lastCheck = Date.now();
    let checkInterval;
    
    const startDevToolsDetection = () => {
      checkInterval = setInterval(() => {
        const now = Date.now();
        const delta = now - lastCheck;
        
        // If the delta is significantly larger than our interval, 
        // console might have been paused due to devtools being open
        if (delta > 100) {
          setDevToolsOpen(true);
        }
        
        lastCheck = now;
      }, 50);
    };

    // Method 2: Window size detection for devtools opening
    const windowResizeCheck = () => {
      // Checking if window outer dimensions are significantly larger than inner
      // which can indicate devtools are open
      if (
        window.outerWidth - window.innerWidth > 160 ||
        window.outerHeight - window.innerHeight > 160
      ) {
        setDevToolsOpen(true);
      } else {
        setDevToolsOpen(false);
      }
    };

    startDevToolsDetection();
    window.addEventListener('resize', windowResizeCheck);
    // Initial check
    windowResizeCheck();

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('resize', windowResizeCheck);
    };
  }, []);

  return (
    <div>
      {devToolsOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'red',
            fontSize: '32px',
            fontWeight: 'bold',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            padding: '20px',
            textAlign: 'center'
          }}
        >
          <span role="img" aria-label="eyes" style={{ fontSize: '60px' }}>👀</span>
          <div>Watchu doing snooping here?</div>
          <div style={{ fontSize: '18px', marginTop: '20px', color: 'yellow' }}>
            
          </div>
        </div>
      )}
      <FileUpload />
    </div>
  );
}

export default Home;