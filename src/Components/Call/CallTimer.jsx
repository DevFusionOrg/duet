import React, { useState, useEffect } from 'react';

const CallTimer = ({ duration }) => {
  const [time, setTime] = useState(duration || 0);

  useEffect(() => {
    let interval;
    if (duration === 0) {
      interval = setInterval(() => {
        setTime(prev => prev + 1);
      }, 1000);
    } else {
      setTime(duration);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [duration]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="call-timer">
      {formatTime(time)}
    </div>
  );
};

export default CallTimer;