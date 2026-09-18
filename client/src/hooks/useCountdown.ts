import { useEffect, useRef, useState } from "react";

export const useCountdown = (seconds: number, resetKey: string, active: boolean, onExpire: () => void) => {
  const [remaining, setRemaining] = useState(seconds);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  useEffect(() => {
    setRemaining(seconds);
  }, [resetKey, seconds]);

  useEffect(() => {
    if (!active) return;
    if (remaining <= 0) {
      onExpireRef.current();
      return;
    }
    const timer = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(timer);
  }, [remaining, active]);

  return remaining;
};
